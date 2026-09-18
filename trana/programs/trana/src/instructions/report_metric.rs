use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::TranaError,
    events::MetricReported,
    state::{MetricReport, PoolConfig},
};

#[derive(Accounts)]
#[instruction(target_id: u64, period_id: u64)]
pub struct ReportMetric<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED, config.usdc_mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, PoolConfig>,
    #[account(
        init,
        payer = reporter,
        seeds = [METRIC_SEED, target_id.to_le_bytes().as_ref(), period_id.to_le_bytes().as_ref()],
        bump,
        space = 8 + MetricReport::INIT_SPACE,
    )]
    pub metric_report: Account<'info, MetricReport>,
    pub system_program: Program<'info, System>,
}

impl<'info> ReportMetric<'info> {
    pub fn report_metric(
        &mut self,
        target_id: u64,
        period_id: u64,
        observed_value: u64,
        bumps: ReportMetricBumps,
    ) -> Result<()> {
        require_keys_eq!(
            self.reporter.key(),
            self.config.oracle_authority,
            TranaError::Unauthorized
        );

        self.metric_report.set_inner(MetricReport {
            target_id,
            period_id,
            observed_value,
            timestamp: Clock::get()?.unix_timestamp,
            reporter: self.reporter.key(),
            bump: bumps.metric_report,
        });

        emit!(MetricReported {
            config: self.config.key(),
            target_id,
            period_id,
            observed_value,
            timestamp: self.metric_report.timestamp,
            reporter: self.reporter.key(),
        });

        Ok(())
    }
}
