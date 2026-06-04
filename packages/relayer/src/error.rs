//! Typed errors for the relay flow, each mapped to an HTTP status + JSON body.
//!
//! Implementing `IntoResponse` lets a handler simply `return Err(RelayError::...)`
//! and Axum turns it into the right HTTP response. The handler's happy path stays
//! clean; every failure is a named variant you can see and grep for.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug)]
pub enum RelayError {
    /// Malformed input we could reject without touching the chain.
    BadRequest(String),
    UnknownChain(u64),
    FeeTooLow { required: String, provided: String },
    UnknownRoot,
    AlreadySpent,
    /// The same note is already being submitted by another in-flight request.
    InFlight,
    /// The withdraw reverted in simulation (bad proof, etc.) — rejected before gas.
    SimulationFailed(String),
    /// An RPC / node-level problem (their side, not the caller's).
    Chain(String),
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

impl IntoResponse for RelayError {
    fn into_response(self) -> Response {
        let (status, error, detail) = match self {
            RelayError::BadRequest(d) => (StatusCode::BAD_REQUEST, "bad_request", Some(d)),
            RelayError::UnknownChain(id) => (
                StatusCode::BAD_REQUEST,
                "unknown_chain",
                Some(format!("chain {id} is not configured")),
            ),
            RelayError::FeeTooLow { required, provided } => (
                StatusCode::BAD_REQUEST,
                "fee_too_low",
                Some(format!("required {required}, provided {provided}")),
            ),
            RelayError::UnknownRoot => (StatusCode::BAD_REQUEST, "unknown_root", None),
            RelayError::AlreadySpent => (StatusCode::CONFLICT, "already_spent", None),
            RelayError::InFlight => (StatusCode::CONFLICT, "in_flight", None),
            RelayError::SimulationFailed(d) => {
                (StatusCode::BAD_REQUEST, "simulation_failed", Some(d))
            }
            RelayError::Chain(d) => (StatusCode::BAD_GATEWAY, "chain_error", Some(d)),
        };

        (status, Json(ErrorBody { error, detail })).into_response()
    }
}
