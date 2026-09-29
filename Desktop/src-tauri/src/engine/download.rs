use reqwest::{blocking::Client, Error};
use serde_json::Value;
use std::{error::Error as _, time::Duration};

pub(super) fn describe_error(error: &Error) -> String {
    let category = if error.is_timeout() {
        "请求超时"
    } else if error.is_connect() {
        "连接失败"
    } else if error.is_status() {
        "HTTP 请求失败"
    } else if error.is_decode() {
        "响应解析失败"
    } else {
        "网络请求失败"
    };
    let mut details = vec![error.to_string()];
    let mut source = error.source();
    while let Some(cause) = source {
        details.push(cause.to_string());
        source = cause.source();
    }
    format!("{category}：{}", details.join("；原因："))
}

pub(super) fn manifest(
    client: &Client,
    address: &str,
    report: impl FnMut(&str),
) -> Result<Value, String> {
    request_manifest(client, address, Duration::from_secs(20), report)
}

fn request_manifest(
    client: &Client,
    address: &str,
    timeout: Duration,
    mut report: impl FnMut(&str),
) -> Result<Value, String> {
    const ATTEMPTS: u32 = 3;
    for attempt in 1..=ATTEMPTS {
        report(&format!(
            "正在获取 MPE 更新清单（第 {attempt}/{ATTEMPTS} 次）"
        ));
        let result = client
            .get(address)
            .timeout(timeout)
            .send()
            .and_then(|response| response.error_for_status())
            .and_then(|response| response.json());
        match result {
            Ok(value) => return Ok(value),
            Err(error) => {
                let retryable = error.is_timeout()
                    || error.is_connect()
                    || error.status().is_some_and(|status| {
                        matches!(status.as_u16(), 408 | 500 | 502 | 503 | 504)
                    });
                let message = format!(
                    "获取 MPE 更新清单失败（第 {attempt}/{ATTEMPTS} 次）：{}",
                    describe_error(&error)
                );
                if attempt == ATTEMPTS || !retryable {
                    return Err(message);
                }
                report(&format!("{message}；即将重试"));
                std::thread::sleep(Duration::from_millis(500 * u64::from(attempt)));
            }
        }
    }
    unreachable!()
}

#[cfg(test)]
mod tests;
