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

#[cfg(test)]
mod tests {
    use super::*;

    // ── Display ──

    #[test]
    fn no_date_header_display() {
        assert_eq!(AppError::NoDateHeader.to_string(), "server returned no Date header");
    }

    #[test]
    fn invalid_date_header_display() {
        let e = AppError::InvalidDateHeader("bad value".to_string());
        assert_eq!(e.to_string(), "invalid Date header format: bad value");
    }

    #[test]
    fn cancelled_display() {
        assert_eq!(AppError::Cancelled.to_string(), "sync cancelled");
    }

    #[test]
    fn max_retries_exceeded_display() {
        let e = AppError::MaxRetriesExceeded(5);
        assert_eq!(e.to_string(), "max retries exceeded (5 attempts)");
    }

    #[test]
    fn invalid_url_display() {
        let e = AppError::InvalidUrl("not-a-url".to_string());
        assert_eq!(e.to_string(), "invalid URL: not-a-url");
    }

    // ── Serialize ──

    #[test]
    fn app_error_serializes_to_its_display_string() {
        let e = AppError::NoDateHeader;
        let json = serde_json::to_string(&e).unwrap();
        assert_eq!(json, "\"server returned no Date header\"");
    }

    #[test]
    fn invalid_date_header_serializes_to_display_string() {
        let e = AppError::InvalidDateHeader("garbage".to_string());
        let json = serde_json::to_string(&e).unwrap();
        assert_eq!(json, "\"invalid Date header format: garbage\"");
    }

    #[test]
    fn max_retries_exceeded_serializes_to_display_string() {
        let e = AppError::MaxRetriesExceeded(3);
        let json = serde_json::to_string(&e).unwrap();
        assert_eq!(json, "\"max retries exceeded (3 attempts)\"");
    }
}
