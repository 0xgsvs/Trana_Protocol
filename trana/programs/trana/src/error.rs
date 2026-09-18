use anchor_lang::prelude::*;

#[error_code]
pub enum TranaError {
    #[msg("Only the configured authority may perform this action.")]
    Unauthorized,
    #[msg("Fee must be between 0 and 10,000 basis points.")]
    InvalidFee,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Policy expiry must be in the future.")]
    InvalidExpiry,
    #[msg("Pool is insolvent: locked risk would exceed total capital.")]
    Insolvent,
    #[msg("Pool does not have enough unencumbered capital for this withdrawal.")]
    InsufficientFreeCapital,
    #[msg("Policy has not expired yet.")]
    PolicyNotExpired,
    #[msg("Policy has already been settled.")]
    PolicyAlreadySettled,
    #[msg("Metric report does not match the policy target or period.")]
    MetricMismatch,
    #[msg("Not enough shares to redeem.")]
    InsufficientShares,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}
