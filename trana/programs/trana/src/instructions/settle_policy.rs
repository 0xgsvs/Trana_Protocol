use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::TranaError,
    events::PolicySettled,
    instructions::shared,
    state::{MetricReport, Policy, PoolConfig},
};

#[derive(Accounts)]
pub struct SettlePolicy<'info> {
    #[account(mut)]
    pub crank: Signer<'info>,
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
        seeds = [POLICY_SEED, config.key().as_ref(), policy.policy_id.to_le_bytes().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,
    #[account(
        seeds = [METRIC_SEED, policy.target_id.to_le_bytes().as_ref(), policy.period_id.to_le_bytes().as_ref()],
        bump = metric_report.bump,
    )]
    pub metric_report: Account<'info, MetricReport>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = policy.insured,
    )]
    pub insured_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> SettlePolicy<'info> {
    pub fn settle_policy(&mut self) -> Result<()> {
        require!(!self.policy.is_settled, TranaError::PolicyAlreadySettled);
        require!(
            Clock::get()?.unix_timestamp >= self.policy.expiry_ts,
            TranaError::PolicyNotExpired
        );
        require!(
            self.metric_report.target_id == self.policy.target_id
                && self.metric_report.period_id == self.policy.period_id,
            TranaError::MetricMismatch
        );

        let payout = self.policy.payout_amount;
        let triggered = self.metric_report.observed_value < self.policy.threshold;

        self.config.total_locked_risk = self
            .config
            .total_locked_risk
            .checked_sub(payout)
            .ok_or(TranaError::MathOverflow)?;

        if triggered {
            self.config.total_capital = self
                .config
                .total_capital
                .checked_sub(payout)
                .ok_or(TranaError::InsufficientFreeCapital)?;

            shared::transfer_from_treasury(
                &self.token_program,
                &self.treasury,
                &self.insured_usdc,
                &self.config,
                payout,
            )?;

            self.policy.is_paid = true;
        }

        self.policy.is_settled = true;
        self.config.assert_solvent()?;

        emit!(PolicySettled {
            config: self.config.key(),
            policy: self.policy.key(),
            insured: self.policy.insured,
            triggered,
            payout_amount: payout,
            observed_value: self.metric_report.observed_value,
            threshold: self.policy.threshold,
        });

        Ok(())
    }
}
