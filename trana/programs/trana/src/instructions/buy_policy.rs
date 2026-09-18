use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::*,
    error::TranaError,
    events::PolicyPurchased,
    state::{Policy, PoolConfig},
};

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct BuyPolicy<'info> {
    #[account(mut)]
    pub insured: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED, config.usdc_mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, PoolConfig>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = config,
    )]
    pub treasury: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = insured,
    )]
    pub insured_usdc: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = insured,
        seeds = [POLICY_SEED, config.key().as_ref(), policy_id.to_le_bytes().as_ref()],
        bump,
        space = 8 + Policy::INIT_SPACE,
    )]
    pub policy: Account<'info, Policy>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> BuyPolicy<'info> {
    #[allow(clippy::too_many_arguments)]
    pub fn buy_policy(
        &mut self,
        policy_id: u64,
        target_id: u64,
        period_id: u64,
        threshold: u64,
        payout_amount: u64,
        premium_amount: u64,
        expiry_ts: i64,
        bumps: BuyPolicyBumps,
    ) -> Result<()> {
        require_neq!(payout_amount, 0, TranaError::InvalidAmount);
        require_neq!(premium_amount, 0, TranaError::InvalidAmount);
        require!(
            expiry_ts > Clock::get()?.unix_timestamp,
            TranaError::InvalidExpiry
        );
        require!(
            self.config.free_capital() >= payout_amount,
            TranaError::Insolvent
        );

        let fee = (premium_amount as u128)
            .checked_mul(self.config.fee_bps as u128)
            .and_then(|v| v.checked_div(FEE_DENOMINATOR as u128))
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(TranaError::MathOverflow)?;
        let net_premium = premium_amount
            .checked_sub(fee)
            .ok_or(TranaError::MathOverflow)?;

        self.config.total_capital = self
            .config
            .total_capital
            .checked_add(net_premium)
            .ok_or(TranaError::MathOverflow)?;
        self.config.total_fees = self
            .config
            .total_fees
            .checked_add(fee)
            .ok_or(TranaError::MathOverflow)?;
        self.config.total_locked_risk = self
            .config
            .total_locked_risk
            .checked_add(payout_amount)
            .ok_or(TranaError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                self.token_program.key(),
                Transfer {
                    from: self.insured_usdc.to_account_info(),
                    to: self.treasury.to_account_info(),
                    authority: self.insured.to_account_info(),
                },
            ),
            premium_amount,
        )?;

        self.policy.set_inner(Policy {
            insured: self.insured.key(),
            policy_id,
            target_id,
            period_id,
            threshold,
            payout_amount,
            premium_amount,
            expiry_ts,
            is_settled: false,
            is_paid: false,
            bump: bumps.policy,
        });

        self.config.assert_solvent()?;

        emit!(PolicyPurchased {
            config: self.config.key(),
            policy: self.policy.key(),
            insured: self.insured.key(),
            policy_id,
            target_id,
            period_id,
            threshold,
            payout_amount,
            premium_amount,
            expiry_ts,
        });

        Ok(())
    }
}
