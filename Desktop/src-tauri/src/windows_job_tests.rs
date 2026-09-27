use super::Job;
use std::{
    os::windows::{io::AsRawHandle, process::CommandExt},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, WAIT_OBJECT_0},
    System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
};

// Use only processes owned by this test. The gate ensures descendants start
// after attachment, matching a task launched by an already managed LB.
#[test]
fn closing_job_reaps_command_descendants() {
    const NAME: &str = "windows_job::tests::closing_job_reaps_command_descendants";
    let marker = "MPE_JOB_TEST_DIR";
    if let Some(dir) = std::env::var_os(marker) {
        let dir = std::path::PathBuf::from(dir);
        if std::env::var_os("MPE_JOB_TEST_LEAF").is_none() {
            while !dir.join("go").exists() {
                std::thread::sleep(Duration::from_millis(10));
            }
            let child = Command::new(std::env::current_exe().unwrap())
                .args(["--exact", NAME])
                .env("MPE_JOB_TEST_LEAF", "1")
                .creation_flags(0x08000000)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap();
            std::fs::write(dir.join("pid"), child.id().to_string()).unwrap();
        }
        loop {
            std::thread::sleep(Duration::from_secs(1));
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let mut parent = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", NAME])
        .env(marker, dir.path())
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let job = Job::attach(&parent).unwrap();
    std::fs::write(dir.path().join("go"), "go").unwrap();
    let start = Instant::now();
    let pid = loop {
        if let Ok(pid) = std::fs::read_to_string(dir.path().join("pid")) {
            if let Ok(pid) = pid.parse::<u32>() {
                break pid;
            }
        }
        assert!(
            start.elapsed() < Duration::from_secs(10),
            "child did not start"
        );
        std::thread::sleep(Duration::from_millis(10));
    };
    unsafe {
        let leaf = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
        assert!(!leaf.is_null(), "child was not alive before recovery");
        assert!(parent.try_wait().unwrap().is_none());
        drop(job);
        let result = WaitForSingleObject(leaf, 5000);
        CloseHandle(leaf);
        assert_eq!(
            result, WAIT_OBJECT_0,
            "Command descendant survived job closure"
        );
        assert_eq!(
            WaitForSingleObject(parent.as_raw_handle() as _, 5000),
            WAIT_OBJECT_0
        );
    }
    parent.wait().unwrap();
}
