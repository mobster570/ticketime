use crate::error::AppError;

/// Trait for extracting server time from an HTTP response.
/// Implement this trait to support different time source strategies.
pub trait TimeExtractor: Send + Sync {
    /// Human-readable name of this extraction strategy.
    fn name(&self) -> &str;

    /// Extract the server's unix timestamp (whole seconds) from the response.
    fn extract_time(&self, response: &reqwest::Response) -> Result<i64, AppError>;
}

/// Default extractor: parses the standard HTTP `Date` response header.
pub struct DateHeaderExtractor;

impl TimeExtractor for DateHeaderExtractor {
    fn name(&self) -> &str {
        "Date Header"
    }

    fn extract_time(&self, response: &reqwest::Response) -> Result<i64, AppError> {
        let date_str = response
            .headers()
            .get("date")
            .ok_or(AppError::NoDateHeader)?
            .to_str()
            .map_err(|_| AppError::InvalidDateHeader("non-ASCII header value".into()))?;

        let dt = chrono::DateTime::parse_from_rfc2822(date_str)
            .map_err(|e| AppError::InvalidDateHeader(e.to_string()))?;

        Ok(dt.timestamp())
    }
}
