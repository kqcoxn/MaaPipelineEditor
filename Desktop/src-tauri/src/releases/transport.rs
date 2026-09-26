use super::Index;
use crate::{engine, state::now};
use reqwest::blocking::{Client, Response};
use serde_json::{json, Value};
use std::{io::Read, path::Path, time::Duration};

const SITE: &str = "https://mpe.codax.site/landing/mpe-versions.json";
const API: &str = "https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases";
pub(super) fn notes(version: &str) -> Result<String, String> {
    let parsed = semver::Version::parse(version).map_err(|_| "版本号无效")?;
    if !parsed.pre.is_empty() || !parsed.build.is_empty() {
        return Err("请选择正式发布版本".into());
    }
    let client = Client::builder()
        .user_agent("MPE-Desktop")
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "无法创建更新日志客户端")?;
    let mut request = client
        .get(format!("{API}/tags/v{parsed}"))
        .header("Accept", "application/vnd.github+json");
    if let Ok(Some(token)) = crate::credentials::read() {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .map_err(|_| "无法获取更新日志，请检查网络或代理")?;
    match response.status().as_u16() {
        200 => {}
        404 => return Err("此版本尚未发布更新日志".into()),
        401 => return Err("GitHub Token 无效，请在设置中更新或清除".into()),
        403 | 429 => return Err("GitHub 请求受限，请稍后重试".into()),
        _ => return Err("获取更新日志失败，请稍后重试".into()),
    }
    let value = json_response(response)?;
    notes_body(value, &parsed.to_string())
}
fn notes_body(value: Value, version: &str) -> Result<String, String> {
    if value["tag_name"] != format!("v{version}") || value["draft"] != false {
        return Err("更新日志版本不匹配".into());
    }
    Ok(value["body"]
        .as_str()
        .filter(|body| !body.trim().is_empty())
        .ok_or("此版本未提供更新说明")?
        .to_owned())
}
#[cfg(test)]
mod notes_tests {
    use super::*;

    #[test]
    fn notes_reject_wrong_versions_drafts_and_empty_content() {
        let value = json!({"tag_name":"v2.0.1", "draft":false, "body":"## Fixes\n- fixed"});
        assert_eq!(
            notes_body(value.clone(), "2.0.1").unwrap(),
            "## Fixes\n- fixed"
        );
        assert!(notes_body(value, "2.0.0").is_err());
        assert!(notes_body(
            json!({"tag_name":"v2.0.1", "draft":true, "body":"hidden"}),
            "2.0.1"
        )
        .is_err());
        assert!(notes_body(
            json!({"tag_name":"v2.0.1", "draft":false, "body":"  "}),
            "2.0.1"
        )
        .is_err());
        assert!(notes("../../releases").is_err());
    }
}
fn json_response(response: Response) -> Result<Value, String> {
    let mut bytes = Vec::new();
    response
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "读取版本信息失败")?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("版本信息超出大小限制".into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "版本信息不是有效 JSON".into())
}
fn public_json(client: &Client, url: &str) -> Result<Value, String> {
    let response = client
        .get(url)
        .timeout(Duration::from_secs(10))
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|_| "无法获取静态版本信息".to_string())?;
    json_response(response)
}
fn parse(value: Value) -> Result<Index, String> {
    let index: Index = serde_json::from_value(value).map_err(|_| "版本索引格式无效")?;
    index.validate()?;
    Ok(index)
}
pub(super) fn static_index() -> Result<Index, String> {
    let client = engine::client()?;
    let mirror = format!("{}/latest/download/mpe-versions.json", engine::RELEASES);
    // Compare publication timestamps: the site may be deployed after the release.
    let site = public_json(&client, SITE).and_then(parse);
    let release = public_json(&client, &mirror).and_then(parse);
    newest(site, release)
}
pub(super) fn github(dir: &Path, token: &str) -> Result<Index, String> {
    let retry_path = dir.join("github-retry.json");
    let retry: u64 = std::fs::read(&retry_path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(0);
    if retry > now() {
        return Err("GitHub 请求处于限流等待期".into());
    }
    // Authentication is attached only to this fixed API origin; redirects are rejected.
    let api = Client::builder()
        .user_agent("MPE-Desktop")
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "无法创建 GitHub 客户端")?;
    let public = engine::client()?;
    let mut entries = Vec::new();
    for page in 1..=100 {
        let response = api
            .get(API)
            .query(&[("per_page", 100), ("page", page)])
            .bearer_auth(token)
            .header("Accept", "application/vnd.github+json")
            .send()
            .map_err(|_| "GitHub 版本查询失败")?;
        let status = response.status().as_u16();
        if status != 200 {
            if status == 403 || status == 429 {
                let seconds = |name: &str| {
                    response
                        .headers()
                        .get(name)
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<u64>().ok())
                };
                let until = seconds("x-ratelimit-reset")
                    .unwrap_or(0)
                    .max(now().saturating_add(seconds("retry-after").unwrap_or(60)));
                let _ = std::fs::write(&retry_path, until.to_string());
            }
            return Err(match status {
                401 => "GitHub Token 无效或已过期".into(),
                403 | 429 => "GitHub 请求受限或 Token 权限不足".into(),
                _ => format!("GitHub 版本查询失败（HTTP {status}）"),
            });
        }
        let releases = json_response(response)?;
        let releases = releases.as_array().ok_or("GitHub 版本列表格式无效")?;
        for release in releases {
            if release["draft"] != false || release["prerelease"] != false {
                continue;
            }
            let Some(tag) = release["tag_name"].as_str() else {
                continue;
            };
            let Some(version) = tag.strip_prefix('v') else {
                continue;
            };
            let Ok(parsed) = semver::Version::parse(version) else {
                continue;
            };
            if !parsed.pre.is_empty() || !parsed.build.is_empty() {
                continue;
            }
            if !release["assets"]
                .as_array()
                .is_some_and(|a| a.iter().any(|a| a["name"] == "mpe-manifest.json"))
            {
                continue;
            }
            let url = format!("{}/download/{tag}/mpe-manifest.json", engine::RELEASES);
            // A transient failure must not silently remove a version from the cached list.
            let manifest = public_json(&public, &url)?;
            if manifest["version"] != version {
                return Err("GitHub 配套清单版本不符".into());
            }
            entries.push(json!({"manifestUrl":url, "manifest":manifest}));
        }
        if releases.len() < 100 {
            return parse(json!({"schemaVersion":1, "generatedAt":now(), "releases":entries}));
        }
    }
    Err("GitHub 版本列表超过查询上限".into())
}

pub(super) fn newest(
    site: Result<Index, String>,
    release: Result<Index, String>,
) -> Result<Index, String> {
    match (site, release) {
        (Ok(a), Ok(b)) => Ok(if b.generated_at > a.generated_at {
            b
        } else {
            a
        }),
        (Ok(a), Err(_)) | (Err(_), Ok(a)) => Ok(a),
        (Err(_), Err(_)) => Err("站点与 Release 静态索引均不可用".into()),
    }
}
