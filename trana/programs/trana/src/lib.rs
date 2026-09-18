pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("En2EGbw2JuJkQbmgueXEN2XaiBjHvzf4bPwCrUyTqMNf");

#[program]
pub mod trana {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        fee_bps: u16,
        oracle_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts
            .initialize_pool(fee_bps, oracle_authority, ctx.bumps)
    }

    pub fn deposit_capital(ctx: Context<DepositCapital>, amount: u64) -> Result<()> {
        ctx.accounts.deposit_capital(amount, ctx.bumps)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn buy_policy(
        ctx: Context<BuyPolicy>,
        policy_id: u64,
        target_id: u64,
        period_id: u64,
        threshold: u64,
        payout_amount: u64,
        premium_amount: u64,
        expiry_ts: i64,
    ) -> Result<()> {
        ctx.accounts.buy_policy(
            policy_id,
            target_id,
            period_id,
            threshold,
            payout_amount,
            premium_amount,
            expiry_ts,
            ctx.bumps,
        )
    }

    pub fn report_metric(
        ctx: Context<ReportMetric>,
        target_id: u64,
        period_id: u64,
        observed_value: u64,
    ) -> Result<()> {
        ctx.accounts
            .report_metric(target_id, period_id, observed_value, ctx.bumps)
    }

    pub fn settle_policy(ctx: Context<SettlePolicy>) -> Result<()> {
        ctx.accounts.settle_policy()
    }

    pub fn withdraw_capital(ctx: Context<WithdrawCapital>, shares: u64) -> Result<()> {
        ctx.accounts.withdraw_capital(shares)
    }
}
