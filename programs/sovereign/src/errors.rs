use anchor_lang::prelude::*;

#[error_code]
pub enum SovereignError {
    #[msg("Unauthorized: caller is not the authorized authority for this dimension")]
    Unauthorized,

    #[msg("Identity already exists for this owner")]
    IdentityAlreadyExists,

    #[msg("Identity not found")]
    IdentityNotFound,

    #[msg("Invalid score: must be between 0 and 10000")]
    InvalidScore,

    #[msg("Invalid authority: cannot set zero address as authority")]
    InvalidAuthority,

    #[msg("Authority not set: must set authority before updating score")]
    AuthorityNotSet,

    #[msg("Owner mismatch: signer is not the identity owner")]
    OwnerMismatch,

    #[msg("Score details already initialized")]
    DetailsAlreadyInitialized,

    #[msg("Score details not initialized")]
    DetailsNotInitialized,
}
