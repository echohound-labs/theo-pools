use anchor_lang::prelude::*;

// ─────────────────────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────────────────────
//
// Single program-wide error enum. Every instruction imports this, so each
// variant has a unique error code (6000 + index) that clients can decode
// without knowing which instruction raised it.
//
// Append new variants at the END — inserting in the middle renumbers the rest.

#[error_code]
pub enum ErrorCode {
    // ── Shared ───────────────────────────────────────────────────────────────
    #[msg("Math overflow or underflow.")]
    MathOverflow,
    #[msg("Timestamp arithmetic overflowed.")]
    TimestampOverflow,
    #[msg("Player count overflowed.")]
    PlayerCountOverflow,
    #[msg("Player count underflowed.")]
    CountUnderflow,
    #[msg("Signer is not the position owner.")]
    Unauthorized,
    #[msg("Position does not belong to this pool.")]
    PositionPoolMismatch,
    #[msg("This pool is not the active filling pool.")]
    NotActiveFillingPool,

    // ── initialize ───────────────────────────────────────────────────────────
    #[msg("Mint account data could not be parsed.")]
    InvalidMint,
    #[msg("Mint uses a Token-2022 extension this program does not support.")]
    UnsupportedMintExtension,
    #[msg("Mint has a freeze authority. Vaults could be frozen — refusing this mint.")]
    MintHasFreezeAuthority,

    // ── create_pool ──────────────────────────────────────────────────────────
    #[msg("A Filling pool already exists. Only one Filling pool is allowed at a time.")]
    FillingPoolExists,
    #[msg("Pool count overflowed u64. This should never happen.")]
    PoolCountOverflow,

    // ── deposit ──────────────────────────────────────────────────────────────
    #[msg("Pool is not in Filling state.")]
    PoolNotFilling,
    #[msg("Fill timer has expired. This pool is stalled.")]
    FillTimerExpired,
    #[msg("Pool is already full.")]
    PoolFull,

    // ── withdraw ─────────────────────────────────────────────────────────────
    #[msg("Pool is not in a withdrawable state (must be Filling or Closed).")]
    PoolNotWithdrawable,
    #[msg("Position has already been withdrawn.")]
    AlreadyWithdrawn,

    // ── early_exit ───────────────────────────────────────────────────────────
    #[msg("Pool is not in Active state.")]
    PoolNotActive,
    #[msg("Lock window has expired. Early exit is no longer available.")]
    LockExpired,
    #[msg("Player has already exited early.")]
    AlreadyExited,

    // ── claim ────────────────────────────────────────────────────────────────
    #[msg("Player exited early and is not eligible to claim.")]
    ExitedEarly,
    #[msg("Player withdrew during Filling and is not eligible to claim.")]
    WithdrewDuringFilling,
    #[msg("Player has already claimed their reward.")]
    AlreadyClaimed,
    #[msg("Pool is not in Claiming state.")]
    PoolNotClaiming,
    #[msg("Claim window is closed.")]
    ClaimWindowClosed,

    // ── finalize ─────────────────────────────────────────────────────────────
    #[msg("Pool has already been finalized.")]
    AlreadyFinalized,
    #[msg("Claim window is still open. Cannot finalize yet.")]
    ClaimWindowStillOpen,

    // ── collect_redistribution ───────────────────────────────────────────────
    #[msg("Pool is not in Finalized state.")]
    PoolNotFinalized,
    #[msg("Pool status is Finalized but finalized flag is not set — invariant violation.")]
    FinalizedFlagNotSet,
    #[msg("No redistribution available -- claimed_count was zero at finalize time.")]
    NoRedistributionAvailable,
    #[msg("Player did not claim during the claim window and is not eligible for redistribution.")]
    NotAClaimer,
    #[msg("Player has already collected their redistribution bonus.")]
    AlreadyCollected,

    // ── close_stalled_pool ───────────────────────────────────────────────────
    #[msg("Fill timer has not expired yet. Pool is still active.")]
    FillTimerNotExpired,

    // ── sweep_empty_vault ────────────────────────────────────────────────────
    #[msg("Pool is not in Closed state.")]
    PoolNotClosed,
    #[msg("Pool still has players — use withdraw instead.")]
    PoolNotEmpty,
    #[msg("Vault is already empty.")]
    VaultAlreadyEmpty,

    // ── close_position ───────────────────────────────────────────────────────
    #[msg("Position still has redistribution to collect. Call collect_redistribution first.")]
    RedistributionNotCollected,
}
