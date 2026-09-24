use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;

use instructions::initialize::*;
use instructions::create_pool::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use instructions::early_exit::*;
use instructions::claim::*;
use instructions::finalize::*;
use instructions::collect_redistribution::*;
use instructions::close_stalled_pool::*;
use instructions::sweep_empty_vault::*;
use instructions::close_position::*;

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM ID
// ─────────────────────────────────────────────────────────────────────────────

declare_id!("8QGfTSEwKvzr8NKLHw2xEigz18KDfdkiFJeM3ALnvbVH");

// ─────────────────────────────────────────────────────────────────────────────
// THEO COMMITMENT POOL PROGRAM
// ─────────────────────────────────────────────────────────────────────────────
//
// Instruction summary:
//
//   initialize            — One-time setup. Creates GlobalState and rollover vault.
//                           Rejects mints with a freeze authority or unsupported
//                           Token-2022 extensions.
//   create_pool           — Permissionless. Creates a new Filling pool. Seeds it
//                           from GlobalState rollover vault atomically. Sets the
//                           fill deadline (resets to now + FILL_TIMEOUT on every join).
//   deposit               — Join a Filling pool. Transfers STAKE_AMOUNT (0.20 THEO).
//                           Transitions pool to Active when MAX_PLAYERS reached.
//   withdraw              — Exit a Filling or Closed pool. Full stake returned,
//                           position closed (rent refunded). Auto-closes a stalled
//                           pool and returns rollover seed on last withdrawal.
//   early_exit            — Exit an Active pool with penalty. Returns 0.10 THEO,
//                           forfeits 0.10 THEO to penalty vault. Position closed.
//   claim                 — Claim base reward during Claiming phase (Days 90–95).
//                           Lazy transition: triggers Active → Claiming on first call.
//   finalize              — Permissionless. Closes claim window, computes redistribution,
//                           rolls unclaimed funds to GlobalState. callable after Day 95.
//   collect_redistribution — Pull redistribution bonus after finalization.
//                           Only callable by survivors who claimed during claim window.
//   close_stalled_pool    — Permissionless escape hatch. Closes a Filling pool whose
//                           fill timer expired (with or without players inside).
//                           Unblocks protocol so new pools can be created.
//   sweep_empty_vault     — Permissionless. Moves whatever is left in the vault of a
//                           Closed, empty pool (rollover seed, stray transfers) back
//                           to the GlobalState rollover vault.
//   close_position        — Owner closes their UserPosition in a Finalized pool and
//                           recovers its rent.
//
// Lifecycle:
//   initialize → [create_pool → deposit(xMAX_PLAYERS) → early_exit* → claim* →
//                 finalize → collect_redistribution* → close_position*] → repeats forever
//
//   Stalled path (fill timer expired before the pool filled):
//   create_pool → deposit* → close_stalled_pool → withdraw* → sweep_empty_vault
//
// All funds stay in the system. Zero protocol fees. Zero extraction.

#[program]
pub mod theo_commitment_pool {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        instructions::create_pool::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        instructions::deposit::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::handler(ctx)
    }

    pub fn early_exit(ctx: Context<EarlyExitCtx>) -> Result<()> {
        instructions::early_exit::handler(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    pub fn finalize(ctx: Context<FinalizePool>) -> Result<()> {
        instructions::finalize::handler(ctx)
    }

    pub fn collect_redistribution(ctx: Context<CollectRedistribution>) -> Result<()> {
        instructions::collect_redistribution::handler(ctx)
    }

    pub fn close_stalled_pool(ctx: Context<CloseStalledPool>) -> Result<()> {
        instructions::close_stalled_pool::handler(ctx)
    }

    pub fn sweep_empty_vault(ctx: Context<SweepEmptyVault>) -> Result<()> {
        instructions::sweep_empty_vault::handler(ctx)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }
}
