use anchor_lang::prelude::*;

use crate::state::{GlobalState, Pool, PoolStatus};
use crate::events::PoolClosed;
use crate::errors::ErrorCode;

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION: close_stalled_pool
// ─────────────────────────────────────────────────────────────────────────────
//
// Permissionless escape hatch. Anyone can call this.
//
// Purpose:
//   Handles the edge case where a pool's fill timer has expired without the
//   pool filling — whether players are still inside or it is empty.
//   Without this instruction, active_filling_pool
//   would remain set and the protocol would be permanently blocked from
//   creating new pools.
//
// What it does:
//   1. Validates pool is in Filling state.
//   2. Validates this is the active filling pool.
//   3. Validates fill timer has expired.
//   4. Sets pool.status = Closed.
//   5. Clears GlobalState.active_filling_pool → None.
//   6. Emits PoolClosed.
//
// What it does NOT do:
//   — Does NOT transfer any tokens.
//   — Does NOT return stakes to players.
//   — Does NOT touch rollover_seed.
//
// Players must still call withdraw.rs individually to recover their stake.
// The rollover_seed is returned to GlobalState when the last player withdraws
// (handled in withdraw.rs), or via sweep_empty_vault if the pool was empty.
//
// Bot flow:
//   Bot polls fill_deadline on a schedule.
//   When expired and pool still has players → call close_stalled_pool.
//   Bot then notifies stranded players to call withdraw.
//
// PDA seeds:
//   Pool: ["pool", pool_id.to_le_bytes()]

pub fn handler(ctx: Context<CloseStalledPool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let global = &mut ctx.accounts.global_state;
    let now = Clock::get()?.unix_timestamp;

    // ── Guard 1: Pool must be in Filling state ────────────────────────────────
    require!(
        pool.status == PoolStatus::Filling,
        ErrorCode::PoolNotFilling
    );

    // ── Guard 2: This must be the active filling pool ─────────────────────────
    require!(
        global.active_filling_pool == Some(pool.id),
        ErrorCode::NotActiveFillingPool
    );

    // ── Guard 3: Fill timer must have expired ─────────────────────────────────
    //
    // fill_deadline is set at pool creation, so every pool — joined or not —
    // gets the full FILL_TIMEOUT before anyone can close it. An empty expired
    // pool is closable too; its rollover seed is recovered via sweep_empty_vault.
    //
    // Legacy only: pools created before fill_deadline was set at creation have
    // fill_deadline == 0 until their first join and could never expire, so an
    // unjoined legacy pool may still be closed immediately. New pools never
    // have fill_deadline == 0.
    let legacy_never_joined = pool.fill_deadline == 0 && pool.player_count == 0;
    require!(
        legacy_never_joined || pool.fill_timer_expired(now),
        ErrorCode::FillTimerNotExpired
    );

    // ── Step 1: Close the pool ────────────────────────────────────────────────
    pool.status = PoolStatus::Closed;

    // ── Step 2: Clear the global filling pool pointer ─────────────────────────
    //
    // This is the critical step — unblocks the protocol.
    // Once cleared, create_pool can be called again.
    // Players with remaining stakes must call withdraw to recover funds.
    global.active_filling_pool = None;

    // ── Step 3: Emit PoolClosed ───────────────────────────────────────────────
    //
    // rollover_returned = 0 here because no tokens are moved.
    // The actual rollover seed return happens in withdraw.rs when the last
    // player withdraws, or in sweep_empty_vault if the pool was already empty.
    emit!(PoolClosed {
        pool_id: pool.id,
        rollover_returned: 0,
    });

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct CloseStalledPool<'info> {
    /// Permissionless — any wallet can close a stalled pool.
    /// No funds at risk — this instruction only changes state.
    pub caller: Signer<'info>,

    /// GlobalState — mutable to clear active_filling_pool.
    #[account(
        mut,
        seeds = [b"global"],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The stalled Filling pool to close.
    #[account(
        mut,
        seeds = [b"pool", pool.id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}
