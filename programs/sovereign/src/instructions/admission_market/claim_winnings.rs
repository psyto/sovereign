use anchor_lang::prelude::*;
use crate::state::admission_market::{AdmissionMarket, MarketPosition, MarketStatus, MarketOutcome, SurfacingScore};
use crate::state::creator_dao::CreatorScoreDetails;
use crate::instructions::admission_market::create_market::AdmissionMarketError;

// =============================================================================
// CLAIM WINNINGS INSTRUCTION
// =============================================================================
//
// After a nomination vote resolves, winning predictors can claim their share.
//
// Vitalik: "a portion of their proceeds from the DAO are used to burn their
// creator coins"
//
// The burn mechanism creates deflationary pressure tied to quality acceptance,
// not speculative attention.
// =============================================================================

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    /// The predictor claiming winnings
    #[account(mut)]
    pub predictor: Signer<'info>,

    /// The resolved market
    #[account(
        mut,
        constraint = market.status == MarketStatus::Resolved @ AdmissionMarketError::MarketNotResolved,
    )]
    pub market: Account<'info, AdmissionMarket>,

    /// The predictor's position
    #[account(
        mut,
        constraint = position.market == market.key(),
        constraint = position.predictor == predictor.key(),
        constraint = !position.claimed @ AdmissionMarketError::AlreadyClaimed,
    )]
    pub position: Account<'info, MarketPosition>,

    /// The predictor's creator score details (for prediction accuracy update)
    #[account(
        mut,
        constraint = creator_score.identity == predictor.key(),
    )]
    pub creator_score: Option<Account<'info, CreatorScoreDetails>>,

    /// The market creator's surfacing score (for bonus if correct)
    #[account(
        mut,
        constraint = surfacing_score.identity == market.market_creator,
    )]
    pub surfacing_score: Option<Account<'info, SurfacingScore>>,

    /// Treasury for receiving burned tokens
    /// CHECK: Burn address
    #[account(mut)]
    pub burn_treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // Determine if this position won
    let (is_winner, winning_tokens) = match market.outcome {
        MarketOutcome::Accepted => (position.yes_tokens > 0, position.yes_tokens),
        MarketOutcome::Rejected => (position.no_tokens > 0, position.no_tokens),
        MarketOutcome::Cancelled => {
            // Refund on cancellation
            position.claimed = true;
            position.payout = position.total_staked;
            msg!("Market cancelled. Refunding {} lamports", position.total_staked);
            return Ok(());
        }
        MarketOutcome::Pending => {
            return err!(AdmissionMarketError::MarketNotResolved);
        }
    };

    if !is_winner {
        // Losing position - just mark as claimed
        position.claimed = true;
        position.payout = 0;

        // Update prediction accuracy
        if let Some(creator_score) = &mut ctx.accounts.creator_score {
            creator_score.predictions_incorrect += 1;
            let total = creator_score.predictions_correct + creator_score.predictions_incorrect;
            creator_score.prediction_accuracy_bps = if total > 0 {
                ((creator_score.predictions_correct as u32 * 10000) / total as u32) as u16
            } else {
                0
            };
            creator_score.last_updated = clock.unix_timestamp;

            // Vitalik: Good predictors contribute to surfacing quality
            msg!(
                "Prediction incorrect. Updated accuracy: {}%",
                creator_score.prediction_accuracy_bps / 100
            );
        }

        return Ok(());
    }

    // === WINNING POSITION ===

    // Calculate payout
    let is_yes = market.outcome == MarketOutcome::Accepted;
    let payout = market.calculate_payout(winning_tokens, is_yes);

    position.claimed = true;
    position.payout = payout;

    // Update prediction accuracy
    if let Some(creator_score) = &mut ctx.accounts.creator_score {
        creator_score.predictions_correct += 1;
        let total = creator_score.predictions_correct + creator_score.predictions_incorrect;
        creator_score.prediction_accuracy_bps = if total > 0 {
            ((creator_score.predictions_correct as u32 * 10000) / total as u32) as u16
        } else {
            0
        };

        // Calculate P&L in basis points
        let pnl = payout as i64 - position.total_staked as i64;
        let pnl_bps = if position.total_staked > 0 {
            ((pnl * 10000) / position.total_staked as i64) as i32
        } else {
            0
        };
        creator_score.prediction_pnl_bps = creator_score.prediction_pnl_bps.saturating_add(pnl_bps);
        creator_score.last_updated = clock.unix_timestamp;

        msg!(
            "Prediction correct! Accuracy: {}%, P&L: {}%",
            creator_score.prediction_accuracy_bps / 100,
            pnl_bps / 100
        );
    }

    // Bonus for market creator if they predicted correctly
    // Vitalik: Talent scouts who surface accepted creators are rewarded
    if ctx.accounts.predictor.key() == market.market_creator {
        if let Some(surfacing_score) = &mut ctx.accounts.surfacing_score {
            if market.outcome == MarketOutcome::Accepted {
                surfacing_score.successful_surfaces += 1;
                surfacing_score.surfacing_accuracy_bps = if surfacing_score.markets_created > 0 {
                    ((surfacing_score.successful_surfaces as u32 * 10000)
                        / surfacing_score.markets_created as u32) as u16
                } else {
                    0
                };
                surfacing_score.scout_score = surfacing_score.calculate_scout_score();
                surfacing_score.last_updated = clock.unix_timestamp;

                msg!(
                    "Market creator bonus! Surfacing accuracy: {}%, Scout score: {}",
                    surfacing_score.surfacing_accuracy_bps / 100,
                    surfacing_score.scout_score
                );
            }
        }
    }

    msg!(
        "Claimed {} lamports ({}% return on {} staked)",
        payout,
        if position.total_staked > 0 {
            ((payout as i64 - position.total_staked as i64) * 100) / position.total_staked as i64
        } else {
            0
        },
        position.total_staked
    );

    // Note: Burn happens at resolution time in resolve_nomination
    // Vitalik: "a portion of their proceeds from the DAO are used to burn
    // their creator coins"
    msg!("Total burned from this market: {} lamports", market.amount_burned);

    Ok(())
}
