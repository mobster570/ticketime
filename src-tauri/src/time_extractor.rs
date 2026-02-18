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

#[cfg(test)]
mod tests {
    use super::*;
    use http::response::Builder as HttpResponseBuilder;

    fn mock_response_with_date(date_str: &str) -> reqwest::Response {
        let http_resp = HttpResponseBuilder::new()
            .status(200)
            .header("date", date_str)
            .body(b"".to_vec())
            .unwrap();
        reqwest::Response::from(http_resp)
    }

    fn mock_response_no_date() -> reqwest::Response {
        let http_resp = HttpResponseBuilder::new()
            .status(200)
            .body(b"".to_vec())
            .unwrap();
        reqwest::Response::from(http_resp)
    }

    #[test]
    fn date_header_extractor_name() {
        assert_eq!(DateHeaderExtractor.name(), "Date Header");
    }

    #[test]
    fn extract_time_valid_date_header() {
        // Wed, 21 Oct 2015 07:28:00 GMT  ->  unix timestamp 1445412480
        let resp = mock_response_with_date("Wed, 21 Oct 2015 07:28:00 GMT");
        let ts = DateHeaderExtractor.extract_time(&resp).unwrap();
        assert_eq!(ts, 1_445_412_480);
    }

    #[test]
    fn extract_time_missing_date_header_returns_no_date_header_error() {
        let resp = mock_response_no_date();
        let err = DateHeaderExtractor.extract_time(&resp).unwrap_err();
        assert!(
            matches!(err, AppError::NoDateHeader),
            "expected NoDateHeader, got: {err}"
        );
    }

    #[test]
    fn extract_time_invalid_date_format_returns_invalid_date_header_error() {
        let resp = mock_response_with_date("not-a-real-date");
        let err = DateHeaderExtractor.extract_time(&resp).unwrap_err();
        assert!(
            matches!(err, AppError::InvalidDateHeader(_)),
            "expected InvalidDateHeader, got: {err}"
        );
    }
}
