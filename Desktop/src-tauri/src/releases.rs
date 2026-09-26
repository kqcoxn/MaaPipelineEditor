#[cfg(test)]
mod tests;
mod transport;

use crate::{credentials, engine, state::now};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::Path, sync::Mutex};

const TTL: u64 = 3600;
static LOCK: Mutex<()> = Mutex::new(());

pub fn notes(version: &str) -> Result<String, String> {
    transport::notes(version)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Index {
    schema_version: u32,
    generated_at: u64,
    releases: Vec<Value>,
}
impl Index {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1 || self.generated_at == 0 || self.releases.len() > 10000 {
            return Err("版本索引格式无效".into());
        }
        for entry in &self.releases {
            let m = &entry["manifest"];
            let version = m["version"].as_str().ok_or("索引缺少版本")?;
            let v = semver::Version::parse(version).map_err(|_| "索引版本无效")?;
            if !v.pre.is_empty()
                || !v.build.is_empty()
                || entry["manifestUrl"]
                    != format!("{}/download/v{version}/mpe-manifest.json", engine::RELEASES)
                || crate::desktop_release::parse_revision(&m["minimumDesktopRevision"]).is_err()
                || m["managementProtocol"].as_u64().is_none()
            {
                return Err("版本索引元数据无效".into());
            }
            let platforms = m["platforms"]
                .as_object()
                .filter(|p| !p.is_empty())
                .ok_or("索引缺少平台")?;
            for artifact in std::iter::once(&m["editor"]).chain(
                platforms
                    .values()
                    .flat_map(|p| [&p["binary"], &p["bundle"]]),
            ) {
                if !artifact["url"]
                    .as_str()
                    .is_some_and(|u| u.starts_with("https://"))
                    || !artifact["sha256"]
                        .as_str()
                        .is_some_and(|h| h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit()))
                {
                    return Err("索引缺少完整资源或校验值".into());
                }
            }
        }
        Ok(())
    }
    fn versions(&self) -> Vec<String> {
        let mut versions: Vec<semver::Version> = self
            .releases
            .iter()
            .filter_map(|entry| {
                let m = &entry["manifest"];
                let version = m["version"].as_str()?;
                engine::validate_manifest(m, version).ok()?;
                semver::Version::parse(version).ok()
            })
            .collect();
        versions.sort_by(|a, b| b.cmp(a));
        versions.dedup();
        versions.into_iter().map(|v| v.to_string()).collect()
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Cache {
    fetched_at: u64,
    invalidated: bool,
    source: String,
    warning: Option<String>,
    index: Index,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionList {
    pub versions: Vec<String>,
    source: String,
    cached: bool,
    stale: bool,
    checked_at: u64,
    pub(crate) warning: Option<String>,
}
impl Cache {
    fn response(&self, cached: bool, stale: bool, warning: Option<String>) -> VersionList {
        VersionList {
            versions: self.index.versions(),
            source: self.source.clone(),
            cached,
            stale,
            checked_at: self.fetched_at,
            warning: warning.or(self.warning.clone()),
        }
    }
}
fn read_cache(dir: &Path) -> Option<Cache> {
    let c: Cache = serde_json::from_slice(&std::fs::read(dir.join("versions.json")).ok()?).ok()?;
    c.index.validate().ok()?;
    Some(c)
}
fn write_cache(dir: &Path, cache: &Cache) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|_| "无法创建版本缓存目录")?;
    let temp = dir.join("versions.next.json");
    std::fs::write(&temp, serde_json::to_vec(cache).unwrap()).map_err(|_| "无法写入版本缓存")?;
    std::fs::rename(temp, dir.join("versions.json")).map_err(|_| "无法提交版本缓存".into())
}
pub fn save_token(dir: &Path, token: &str) -> Result<(), String> {
    let _lock = LOCK.lock().unwrap();
    credentials::save(token)?;
    // Keep the fallback data, but force discovery to use the changed credentials.
    if let Some(mut cache) = read_cache(dir) {
        cache.invalidated = true;
        write_cache(dir, &cache)?;
    }
    let _ = std::fs::remove_file(dir.join("github-retry.json"));
    Ok(())
}
pub fn load(dir: &Path, force: bool) -> Result<VersionList, String> {
    let _lock = LOCK.lock().unwrap();
    resolve(dir, force, now(), || {
        discover(
            credentials::read(),
            |token| transport::github(dir, token),
            transport::static_index,
        )
    })
}
fn discover(
    token: Result<Option<String>, String>,
    github: impl FnOnce(&str) -> Result<Index, String>,
    static_index: impl FnOnce() -> Result<Index, String>,
) -> Result<(Index, String, Option<String>), String> {
    let mut warning = None;
    match token {
        Ok(Some(token)) => match github(&token).and_then(|index| {
            index.validate()?;
            Ok(index)
        }) {
            Ok(index) => return Ok((index, "github".into(), None)),
            Err(error) => warning = Some(format!("{error}；已改用静态索引")),
        },
        Ok(None) => {}
        Err(error) => warning = Some(format!("{error}；已改用静态索引")),
    }
    let index = static_index().map_err(|error| match warning.as_ref() {
        Some(warning) => format!("{warning}；{error}"),
        None => error,
    })?;
    Ok((index, "static".into(), warning))
}

fn resolve(
    dir: &Path,
    force: bool,
    timestamp: u64,
    fetch: impl FnOnce() -> Result<(Index, String, Option<String>), String>,
) -> Result<VersionList, String> {
    let cache = read_cache(dir);
    if !force {
        if let Some(c) = &cache {
            if !c.invalidated
                && c.fetched_at > 0
                && c.fetched_at <= timestamp
                && timestamp - c.fetched_at < TTL
            {
                return Ok(c.response(true, false, None));
            }
        }
    }
    match fetch().and_then(|(index, source, warning)| {
        index.validate()?;
        Ok(Cache {
            fetched_at: timestamp,
            invalidated: false,
            source,
            warning,
            index,
        })
    }) {
        Ok(c) => {
            let mut result = c.response(false, false, None);
            if let Err(error) = write_cache(dir, &c) {
                result.warning = Some(format!(
                    "{}；{error}",
                    result.warning.unwrap_or_else(|| "版本信息已获取".into())
                ));
            }
            Ok(result)
        }
        Err(error) => cache
            .map(|c| {
                c.response(
                    true,
                    true,
                    Some(format!("{error}；使用最近有效缓存，本次未确认更新")),
                )
            })
            .ok_or(format!("{error}；暂无可用版本缓存，可稍后手动重试")),
    }
}
