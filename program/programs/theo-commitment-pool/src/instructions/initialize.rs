use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    state::Mint as MintState,
};
use anchor_spl::token_interface::{Mint, TokenInterface, TokenAccount};

use crate::state::GlobalState;
use crate::errors::ErrorCode;

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION: initialize
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs once at deployment. Sets up the GlobalState singleton and the global
// rollover vault token account.
//
// One-time only — enforced by Anchor's `init` constraint on GlobalState.
// If GlobalState already exists, this instruction fails with AccountAlreadyInitialized.
//
// What it does:
//   1. Creates GlobalState PDA at seeds = ["global"]
//   2. Sets canonical token_mint for the entire protocol
//   3. Creates rollover_vault token account owned by GlobalState PDA
//   4. Sets rollover_balance = 0, pool_count = 0, active_filling_pool = None
//   5. Records authority (deployer) for future admin operations
//
// Mint validation (the mint is permanent once set, so it is vetted here):
//   — No freeze authority: a frozen vault would strand every stake in it.
//   — Token-2022 extensions are allowlisted. Vault accounting assumes every
//     transfer moves exactly the requested amount and that only the program
//     can move vault funds. Transfer fees, transfer hooks, permanent delegate,
//     pausable, non-transferable, default-frozen accounts and confidential
//     transfers all break that, so any extension not on the allowlist
//     (metadata / group / display-only) is rejected.
//
// Authority:
//   Caller is the authority. Permissioned — only the deployer should call this.
//   Authority is stored in GlobalState for future use (e.g. emergency pause).
//   Protocol remains permissionless for all game operations — authority has no
//   power over active pools, funds, or game mechanics.
//
// PDA seeds:
//   GlobalState:   ["global"]
//   RolloverVault: ["rollover_vault"]

/// Mint extensions that cannot affect transfer amounts or custody of vault funds.
const ALLOWED_MINT_EXTENSIONS: &[ExtensionType] = &[
    ExtensionType::MetadataPointer,
    ExtensionType::TokenMetadata,
    ExtensionType::GroupPointer,
    ExtensionType::TokenGroup,
    ExtensionType::GroupMemberPointer,
    ExtensionType::TokenGroupMember,
    // Display-only: changes the UI amount, never the raw amount transferred.
    ExtensionType::InterestBearingConfig,
    ExtensionType::ScaledUiAmount,
    // Mint can only be closed at zero supply — impossible while vaults hold tokens.
    ExtensionType::MintCloseAuthority,
];

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    // ── Guard 1: Mint must have no freeze authority ───────────────────────────
    require!(
        ctx.accounts.token_mint.freeze_authority.is_none(),
        ErrorCode::MintHasFreezeAuthority
    );

    // ── Guard 2: Only allowlisted Token-2022 extensions ───────────────────────
    //
    // A legacy SPL Token mint parses as a base state with no extensions.
    {
        let mint_ai = ctx.accounts.token_mint.to_account_info();
        let mint_data = mint_ai.try_borrow_data()?;
        let mint_state = StateWithExtensions::<MintState>::unpack(&mint_data)
            .map_err(|_| error!(ErrorCode::InvalidMint))?;
        let extensions = mint_state
            .get_extension_types()
            .map_err(|_| error!(ErrorCode::InvalidMint))?;
        for extension in extensions.iter() {
            require!(
                ALLOWED_MINT_EXTENSIONS.contains(extension),
                ErrorCode::UnsupportedMintExtension
            );
        }
    }

    let global = &mut ctx.accounts.global_state;

    // ── Set all GlobalState fields ────────────────────────────────────────────

    global.authority = ctx.accounts.authority.key();
    global.token_mint = ctx.accounts.token_mint.key();
    global.rollover_vault = ctx.accounts.rollover_vault.key();
    global.rollover_balance = 0;
    global.pool_count = 0;
    global.active_filling_pool = None;
    global.bump = ctx.bumps.global_state;
    global._reserved = [0u8; 23];

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Deployer / authority. Pays for account initialization.
    /// Stored in GlobalState — has no power over game mechanics.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// GlobalState singleton PDA. Init enforces one-time-only execution.
    /// If this account already exists, Anchor rejects the instruction.
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global"],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The canonical THEO token mint for this deployment.
    /// Stored in GlobalState — all pools and deposits validated against this.
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// Global rollover vault token account.
    /// Owned by GlobalState PDA — only program CPIs can move funds.
    /// Initialized here with zero balance.
    /// Must exist before any pool creation — create_pool validates this account.
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = global_state,
        token::token_program = token_program,
        seeds = [b"rollover_vault"],
        bump,
    )]
    pub rollover_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
