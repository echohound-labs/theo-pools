use anchor_lang::prelude::*;

use crate::state::{Pool, PoolStatus, UserPosition};
use crate::errors::ErrorCode;
use crate::events::PositionClosed;

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION: close_position
// ─────────────────────────────────────────────────────────────────────────────
//
// Called by a position owner after the pool is Finalized. Closes the
// UserPosition account and refunds its rent to the owner.
//
// withdraw and early_exit close the position themselves. This instruction
// covers the remaining cases — positions that lived through to finalization:
//   — claimed, and redistribution collected (or none was available)
//   — never claimed (missed the claim window; nothing left to collect)
//   — legacy positions flagged withdrew_filling / exited_early before those
//     instructions started closing the account
//
// No tokens move. The only guard beyond ownership is that a claimer with an
// uncollected redistribution bonus must collect it first, since the position
// is the only proof of eligibility.
//
// PDA seeds:
//   Pool:         ["pool", pool_id.to_le_bytes()]
//   UserPosition: ["position", pool_id.to_le_bytes(), player.key()]

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let position = &ctx.accounts.user_position;

    // ── Guard 1: Pool must be Finalized ───────────────────────────────────────
    require!(pool.status == PoolStatus::Finalized, ErrorCode::PoolNotFinalized);

    // ── Guard 2: No redistribution may be left uncollected ────────────────────
    let redistribution_owed = position.claimed
        && !position.redistribution_collected
        && pool.redistribution_per_claimer > 0;
    require!(!redistribution_owed, ErrorCode::RedistributionNotCollected);

    emit!(PositionClosed {
        pool_id: pool.id,
        player: ctx.accounts.player.key(),
    });

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    /// The position owner. Receives the rent refund.
    #[account(mut)]
    pub player: Signer<'info>,

    /// The Finalized pool.
    #[account(
        seeds = [b"pool", pool.id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    /// Player's position — closed here.
    #[account(
        mut,
        close = player,
        seeds = [b"position", pool.id.to_le_bytes().as_ref(), player.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == player.key() @ ErrorCode::Unauthorized,
        constraint = user_position.pool_id == pool.id @ ErrorCode::PositionPoolMismatch,
    )]
    pub user_position: Account<'info, UserPosition>,
}
