use anchor_lang::prelude::*;
use crate::state::creator_dao::{CreatorDAO, ContentType, MAX_DAO_MEMBERS};

// =============================================================================
// CREATE DAO INSTRUCTION
// =============================================================================
//
// Vitalik: "Hand-pick the initial membership set, in order to maximize its
// alignment with the desired style."
//
// The founder creates the DAO with specific opinionated parameters.
// They then add initial members using add_founder_member instruction.
// =============================================================================

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateDAOParams {
    /// Human-readable name
    pub name: String,
    /// Description/mission
    pub description: String,
    /// Primary content type
    pub content_type: ContentType,
    /// Style tag (opinionated niche)
    pub style_tag: String,
    /// Region code (0 for global)
    pub region_code: u16,
    /// Percentage needed to admit (e.g., 60)
    pub admission_threshold: u8,
    /// Voting period in seconds
    pub voting_period: i64,
    /// Quorum percentage
    pub quorum: u8,
}

#[derive(Accounts)]
#[instruction(params: CreateDAOParams)]
pub struct CreateDAO<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,

    /// The founder's SOVEREIGN identity (must exist)
    /// CHECK: Validated in handler
    pub founder_identity: UncheckedAccount<'info>,

    #[account(
        init,
        payer = founder,
        space = CreatorDAO::SIZE,
        seeds = [
            b"creator_dao",
            founder.key().as_ref(),
            &dao_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub dao: Account<'info, CreatorDAO>,

    #[account(
        mut,
        seeds = [b"dao_counter"],
        bump = dao_counter.bump
    )]
    pub dao_counter: Account<'info, DAOCounter>,

    pub system_program: Program<'info, System>,
}

/// Global counter for unique DAO IDs
#[account]
pub struct DAOCounter {
    pub count: u64,
    pub bump: u8,
}

impl DAOCounter {
    pub const SIZE: usize = 8 + 8 + 1;
}

pub fn handler(ctx: Context<CreateDAO>, params: CreateDAOParams) -> Result<()> {
    // Validate parameters
    require!(
        params.admission_threshold > 0 && params.admission_threshold <= 100,
        CreatorDAOError::InvalidThreshold
    );
    require!(
        params.quorum > 0 && params.quorum <= 100,
        CreatorDAOError::InvalidQuorum
    );
    require!(
        params.voting_period >= 86400, // Minimum 1 day
        CreatorDAOError::VotingPeriodTooShort
    );

    // Convert strings to fixed arrays
    let mut name_bytes = [0u8; 32];
    let name_slice = params.name.as_bytes();
    let name_len = name_slice.len().min(32);
    name_bytes[..name_len].copy_from_slice(&name_slice[..name_len]);

    let mut desc_bytes = [0u8; 128];
    let desc_slice = params.description.as_bytes();
    let desc_len = desc_slice.len().min(128);
    desc_bytes[..desc_len].copy_from_slice(&desc_slice[..desc_len]);

    let mut style_bytes = [0u8; 32];
    let style_slice = params.style_tag.as_bytes();
    let style_len = style_slice.len().min(32);
    style_bytes[..style_len].copy_from_slice(&style_slice[..style_len]);

    // Initialize DAO
    let dao = &mut ctx.accounts.dao;
    let counter = &mut ctx.accounts.dao_counter;

    dao.dao_id = counter.count;
    dao.name = name_bytes;
    dao.description = desc_bytes;
    dao.content_type = params.content_type;
    dao.style_tag = style_bytes;
    dao.region_code = params.region_code;
    dao.member_count = 0; // Founder will be added via add_founder_member
    dao.founder = ctx.accounts.founder.key();
    dao.created_at = Clock::get()?.unix_timestamp;
    dao.admission_threshold = params.admission_threshold;
    dao.voting_period = params.voting_period;
    dao.quorum = params.quorum;
    dao.pending_nominations = 0;
    dao.total_admitted = 0;
    dao.total_removed = 0;
    dao.is_active = true;
    dao.nomination_nonce = 0;
    dao.parent_dao = None;
    dao.split_count = 0;
    dao.bump = ctx.bumps.dao;

    // Increment counter
    counter.count += 1;

    msg!(
        "Created CreatorDAO '{}' with ID {} (type: {:?}, style: {})",
        params.name,
        dao.dao_id,
        params.content_type,
        params.style_tag
    );

    // Vitalik: "If N gets above ~200, consider auto-splitting it"
    msg!("Max members before split recommendation: {}", MAX_DAO_MEMBERS);

    Ok(())
}

#[error_code]
pub enum CreatorDAOError {
    #[msg("Admission threshold must be between 1 and 100")]
    InvalidThreshold,

    #[msg("Quorum must be between 1 and 100")]
    InvalidQuorum,

    #[msg("Voting period must be at least 1 day (86400 seconds)")]
    VotingPeriodTooShort,

    #[msg("DAO has reached maximum members, consider splitting")]
    MaxMembersReached,

    #[msg("Only the founder can add initial members")]
    NotFounder,

    #[msg("Only DAO members can nominate")]
    NotMember,

    #[msg("Already a member of this DAO")]
    AlreadyMember,

    #[msg("Nomination is not open for voting")]
    NominationNotOpen,

    #[msg("Already voted on this nomination")]
    AlreadyVoted,

    #[msg("Voting period has not ended")]
    VotingNotEnded,

    #[msg("Voting period has ended")]
    VotingEnded,

    #[msg("Nomination already resolved")]
    AlreadyResolved,

    #[msg("Quorum not reached")]
    QuorumNotReached,

    #[msg("DAO is not active")]
    DAONotActive,

    #[msg("Creator must have a SOVEREIGN identity")]
    NoSovereignIdentity,

    #[msg("Maximum pending nominations reached")]
    MaxPendingNominations,
}
