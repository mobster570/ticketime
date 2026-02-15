use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Db(#[from] rusqlite::Error),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error("server returned no Date header")]
    NoDateHeader,
    #[error("invalid Date header format: {0}")]
    InvalidDateHeader(String),
    #[error("sync cancelled")]
    Cancelled,
    #[error("max retries exceeded ({0} attempts)")]
    MaxRetriesExceeded(u32),
    #[error("invalid URL: {0}")]
    InvalidUrl(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
