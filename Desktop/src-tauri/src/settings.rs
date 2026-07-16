use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use atomicwrites::{AllowOverwrite, AtomicFile};

use crate::error::{AppError, AppResult};
use crate::models::DesktopPreferences;

pub struct SettingsStore {
    path: PathBuf,
    value: Mutex<DesktopPreferences>,
}

impl SettingsStore {
    pub fn load(app_data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(app_data_dir)?;
        let path = app_data_dir.join("desktop-preferences.json");
        let value = if path.is_file() {
            serde_json::from_slice(&fs::read(&path)?)?
        } else {
            DesktopPreferences::default()
        };
        Ok(Self {
            path,
            value: Mutex::new(value),
        })
    }

    pub fn get(&self) -> DesktopPreferences {
        self.lock().clone()
    }

    pub fn update(
        &self,
        change: impl FnOnce(&mut DesktopPreferences),
    ) -> AppResult<DesktopPreferences> {
        let mut value = self.lock();
        let mut next = value.clone();
        change(&mut next);
        self.write(&next)?;
        *value = next.clone();
        Ok(next)
    }

    fn write(&self, value: &DesktopPreferences) -> AppResult<()> {
        let body = serde_json::to_vec_pretty(value)?;
        AtomicFile::new(&self.path, AllowOverwrite)
            .write(|file| file.write_all(&body))
            .map_err(|error| AppError::Desktop(format!("保存桌面偏好失败: {error}")))
    }

    fn lock(&self) -> MutexGuard<'_, DesktopPreferences> {
        self.value
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::SettingsStore;

    #[test]
    fn preferences_are_persisted_atomically() {
        let directory = tempdir().expect("tempdir should be created");
        let store = SettingsStore::load(directory.path()).expect("settings should load");

        store
            .update(|preferences| {
                preferences.background_mode = true;
                preferences.show_hide_shortcut = "Ctrl+Alt+M".into();
            })
            .expect("settings should save");

        let reloaded = SettingsStore::load(directory.path())
            .expect("persisted settings should reload")
            .get();
        assert!(reloaded.background_mode);
        assert_eq!(reloaded.show_hide_shortcut, "Ctrl+Alt+M");
    }
}
