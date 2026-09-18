use serde_json::Value;

// The build script validates and embeds the single release configuration.
pub fn revision() -> u32 {
    env!("MPE_DESKTOP_REVISION").parse().unwrap()
}

pub fn parse_revision(value: &Value) -> Result<u32, String> {
    value
        .as_u64()
        .and_then(|v| u32::try_from(v).ok())
        .filter(|v| *v > 0)
        .ok_or_else(|| "桌面修订号缺失或无效".into())
}

pub fn needs_update(manifest: &Value, current: u32) -> Result<bool, String> {
    Ok(parse_revision(&manifest["desktopRevision"])? > current)
}

pub fn require_supported(value: &Value) -> Result<(), String> {
    let minimum = parse_revision(&value["minimumDesktopRevision"])?;
    if minimum > revision() {
        return Err(format!(
            "请先更新 MPE Desktop，需要桌面修订号 {minimum} 或更高"
        ));
    }
    Ok(())
}

pub fn check_environment(mut value: Value) -> Value {
    if value["ready"] == true {
        if let Err(error) = require_supported(&value) {
            value["ready"] = false.into();
            if !value["problems"].is_array() {
                value["problems"] = serde_json::json!([]);
            }
            value["problems"].as_array_mut().unwrap().push(error.into());
        }
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn revision_controls_updates_independently_of_product_version() {
        assert!(!needs_update(&json!({"version":"99.0.0", "desktopRevision":7}), 7).unwrap());
        assert!(!needs_update(&json!({"desktopRevision":6}), 7).unwrap());
        assert!(needs_update(&json!({"version":"1.10.1", "desktopRevision":8}), 7).unwrap());
    }

    #[test]
    fn malformed_metadata_never_triggers_a_download() {
        for value in [
            Value::Null,
            json!(0),
            json!(-1),
            json!(1.5),
            json!("8"),
            json!(4294967296_u64),
        ] {
            assert!(needs_update(&json!({"desktopRevision":value}), 1).is_err());
        }
    }

    #[test]
    fn installed_environment_also_requires_a_compatible_host() {
        let ready =
            json!({"ready":true,"version":"99.0.0","minimumDesktopRevision":1,"problems":[]});
        assert_eq!(check_environment(ready.clone())["ready"], true);
        let mut future = ready;
        future["minimumDesktopRevision"] = (revision() + 1).into();
        let checked = check_environment(future);
        assert_eq!(checked["ready"], false);
        assert!(checked["problems"][0]
            .as_str()
            .unwrap()
            .contains("请先更新 MPE Desktop"));
        assert_eq!(check_environment(json!({"ready":true}))["ready"], false);
        let broken = json!({"ready":false,"problems":["未安装"]});
        assert_eq!(check_environment(broken.clone()), broken);
    }
}
