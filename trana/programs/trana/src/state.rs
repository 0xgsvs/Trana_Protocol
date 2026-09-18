use anchor_lang::prelude::*;

use crate::error::TranaError;

/// Global pool state. One pool per USDC mint.
#[account]
#[derive(InitSpace)]
pub struct PoolConfig {
    pub admin: Pubkey,
    /// Sole signer allowed to write `MetricReport` accounts.
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    /// Program-owned token account that holds all pool liquidity.
    pub treasury: Pubkey,
    /// Deposited capital plus net premiums, minus realised payouts.
    pub total_capital: u64,
    /// Sum of `payout_amount` across unsettled policies.
    pub total_locked_risk: u64,
    pub total_shares: u64,
    pub total_fees: u64,
    pub fee_bps: u16,
    pub bump: u8,
}

impl PoolConfig {
    /// Capital not reserved against an outstanding policy payout.
    pub fn free_capital(&self) -> u64 {
        self.total_capital.saturating_sub(self.total_locked_risk)
    }

    /// Full-collateralisation invariant: every payout must be backed by capital.
    pub fn assert_solvent(&self) -> Result<()> {
        require!(
            self.total_locked_risk <= self.total_capital,
            TranaError::Insolvent
        );
        Ok(())
    }
}

/// Per-liquidity-provider share position.
#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub lp: Pubkey,
    pub shares: u64,
    pub bump: u8,
}

/// A single parametric drought hedge written against a district weather feed.
#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub insured: Pubkey,
    pub policy_id: u64,
    /// District / region identifier matched against a `MetricReport`.
    pub target_id: u64,
    /// Reporting period (e.g. a season) matched against a `MetricReport`.
    pub period_id: u64,
    pub threshold: u64,
    pub payout_amount: u64,
    pub premium_amount: u64,
    pub expiry_ts: i64,
    pub is_settled: bool,
    pub is_paid: bool,
    pub bump: u8,
}

/// Oracle-attested weather observation for a district and reporting period.
#[account]
#[derive(InitSpace)]
pub struct MetricReport {
    pub target_id: u64,
    pub period_id: u64,
    pub observed_value: u64,
    pub timestamp: i64,
    pub reporter: Pubkey,
    pub bump: u8,
}
