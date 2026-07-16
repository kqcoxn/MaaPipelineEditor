use serde::Serializer;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON 错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Python 环境错误: {0}")]
    Python(String),
    #[error("LocalBridge 错误: {0}")]
    Bridge(String),
    #[error("桌面能力错误: {0}")]
    Desktop(String),
    #[error("操作超时: {0}")]
    Timeout(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
