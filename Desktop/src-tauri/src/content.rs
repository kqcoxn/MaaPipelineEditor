use crate::{engine, settings::data_dir};
use serde_json::Value;
fn valid(v: &Value) -> bool {
    v["schemaVersion"] == 1
        && ["slides", "news", "projects"].iter().all(|key| {
            v[key].as_array().is_some_and(|items| {
                !items.is_empty()
                    && items.len() <= 30
                    && items.iter().all(|i| {
                        i["title"].as_str().is_some_and(|s| s.len() < 512)
                            && i["description"].as_str().is_some_and(|s| s.len() < 4096)
                            && i["url"].as_str().is_some_and(|u| u.starts_with("https://"))
                            && (i["image"].is_null()
                                || i["image"]
                                    .as_str()
                                    .is_some_and(|u| u.starts_with("https://")))
                    })
            })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_malformed_remote_content_without_replacing_fallback() {
        let mut value: Value =
            serde_json::from_str(include_str!("../../../Landing/public/mpe-desktop.json")).unwrap();
        assert!(valid(&value));
        value["slides"][0]["description"] = serde_json::json!({"unexpected":"object"});
        assert!(!valid(&value));
        value["slides"][0]["description"] = "text".into();
        value["slides"][0]["image"] = "javascript:alert(1)".into();
        assert!(!valid(&value));
    }
}
pub fn load(app: &tauri::AppHandle) -> Value {
    let cache = data_dir(app).join("homepage.json");
    let remote = engine::client()
        .ok()
        .and_then(|c| {
            c.get("https://mpe.codax.site/landing/mpe-desktop.json")
                .timeout(std::time::Duration::from_secs(8))
                .send()
                .ok()
        })
        .and_then(|r| r.error_for_status().ok())
        .and_then(|r| r.json::<Value>().ok())
        .filter(valid);
    if let Some(value) = remote {
        let _ = std::fs::write(&cache, serde_json::to_vec(&value).unwrap());
        return value;
    }
    std::fs::read(cache)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .filter(valid)
        .unwrap_or_else(|| {
            serde_json::from_str(include_str!("../../../Landing/public/mpe-desktop.json")).unwrap()
        })
}
