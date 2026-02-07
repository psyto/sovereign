// =============================================================================
// SOVEREIGN STATE MODULE
// =============================================================================
//
// Core identity and reputation state, extended with Vitalik's Creator Coin model.
//
// Architecture:
// - SovereignIdentity: Core identity with multi-dimensional reputation
// - CreatorDAO: Peer collectives that judge creator quality
// - AdmissionMarket: Prediction markets for DAO acceptance
//
// Vitalik's key insight: "the token speculators are NOT participating in a
// recursive-speculation attention game backed only by itself. Instead, they
// are specifically being predictors of what new creators the high-value
// creator DAOs will be willing to accept."
// =============================================================================

// Re-export from parent state.rs for backwards compatibility
mod identity;
pub use identity::*;

// Vitalik's Creator Coin Extension
pub mod creator_dao;
pub mod admission_market;

pub use creator_dao::*;
pub use admission_market::*;
