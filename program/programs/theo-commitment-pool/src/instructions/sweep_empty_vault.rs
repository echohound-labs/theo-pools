use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenInterface, TokenAccount, TransferChecked};
use crate::state::{GlobalState, Pool, PoolStatus};
use crate::errors::ErrorCode;
use crate::events::VaultSwept;

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION: sweep_empty_vault
// ─────────────────────────────────────────────────────────────────────────────
//
// Permissionless. Moves the entire remaining vault balance of a Closed pool
// with no players (rollover seed of a pool that stalled empty, plus any tokens
// sent to the vault directly) into the GlobalState rollover vault.
//
// Zeroes pool.rollover_seed and pool.penalty_vault_balance so the pool's
// bookkeeping never claims tokens the vault no longer holds.

pub fn handler(ctx: Context<SweepEmptyVault>) -> Result<()> {
    let pool_ai = ctx.accounts.pool.to_account_info();
    let pool_vault_ai = ctx.accounts.pool_vault.to_account_info();
    let rollover_vault_ai = ctx.accounts.rollover_vault.to_account_info();
    let token_program_ai = ctx.accounts.token_program.to_account_info();
    let mint_ai = ctx.accounts.token_mint.to_account_info();
    let pool = &mut ctx.accounts.pool;
    let global = &mut ctx.accounts.global_state;

    require!(pool.status == PoolStatus::Closed, ErrorCode::PoolNotClosed);
    require!(pool.player_count == 0, ErrorCode::PoolNotEmpty);

    let vault_balance = ctx.accounts.pool_vault.amount;
    require!(vault_balance > 0, ErrorCode::VaultAlreadyEmpty);

    let pool_id_bytes = pool.id.to_le_bytes();
    let bump = pool.bump;
    let pool_seeds = &[b"pool".as_ref(), pool_id_bytes.as_ref(), &[bump]];
    let signer_seeds = &[&pool_seeds[..]];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            token_program_ai.clone(),
            TransferChecked {
                from: pool_vault_ai.clone(),
                to: rollover_vault_ai.clone(),
                authority: pool_ai.clone(),
                mint: mint_ai.clone(),
            },
            signer_seeds,
        ),
        vault_balance,
        2,
    )?;

    global.rollover_balance = global.rollover_balance
        .checked_add(vault_balance)
        .ok_or(ErrorCode::MathOverflow)?;

    pool.rollover_seed = 0;
    pool.penalty_vault_balance = 0;

    emit!(VaultSwept {
        pool_id: pool.id,
        amount: vault_balance,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SweepEmptyVault<'info> {
    pub caller: Signer<'info>,

    #[account(mut, seeds = [b"global"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut, seeds = [b"pool", pool.id.to_le_bytes().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(address = global_state.token_mint)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = token_mint, token::authority = pool, token::token_program = token_program, address = pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = token_mint, token::authority = global_state, token::token_program = token_program, address = global_state.rollover_vault)]
    pub rollover_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}
