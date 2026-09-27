pub fn parse(value: &serde_json::Value) -> Result<semver::Version, String> {
    let version = value
        .as_str()
        .and_then(|s| semver::Version::parse(s).ok())
        .filter(|v| v.pre.is_empty() && v.build.is_empty());
    version.ok_or_else(|| "桌面标识版号缺失或无效（应为 X.Y.Z）".into())
}
