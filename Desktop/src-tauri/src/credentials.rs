use std::sync::Mutex;

static LOCK: Mutex<()> = Mutex::new(());
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("site.codax.mpe.desktop", "github-token")
        .map_err(|_| "无法访问系统凭据库".into())
}
pub fn read() -> Result<Option<String>, String> {
    let _lock = LOCK.lock().unwrap();
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("无法读取 GitHub Token，请检查系统凭据库权限".into()),
    }
}
pub fn save(token: &str) -> Result<(), String> {
    let _lock = LOCK.lock().unwrap();
    let token = token.trim();
    if token.is_empty() {
        return match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("无法清除 GitHub Token".into()),
        };
    }
    if token.len() > 1024
        || !token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
    {
        return Err("Token 格式无效，请只粘贴 Token 本身".into());
    }
    entry()?
        .set_password(token)
        .map_err(|_| "无法将 GitHub Token 保存到系统凭据库".into())
}
