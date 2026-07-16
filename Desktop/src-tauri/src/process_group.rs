#[cfg(unix)]
mod platform {
    use std::io;
    use std::os::unix::process::CommandExt;
    use std::process::{Child, Command};

    pub struct ProcessGroup {
        pid: i32,
    }

    pub fn configure(command: &mut Command) {
        command.process_group(0);
    }

    pub fn attach(child: &Child) -> io::Result<ProcessGroup> {
        Ok(ProcessGroup {
            pid: child.id() as i32,
        })
    }

    impl ProcessGroup {
        pub fn terminate(&self) {
            unsafe {
                libc::kill(-self.pid, libc::SIGTERM);
            }
        }

        pub fn kill(&self) {
            unsafe {
                libc::kill(-self.pid, libc::SIGKILL);
            }
        }
    }
}

#[cfg(windows)]
mod platform {
    use std::io;
    use std::os::windows::io::AsRawHandle;
    use std::process::{Child, Command};

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub struct ProcessGroup {
        job: HANDLE,
    }

    unsafe impl Send for ProcessGroup {}

    pub fn configure(_command: &mut Command) {}

    pub fn attach(child: &Child) -> io::Result<ProcessGroup> {
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err(io::Error::last_os_error());
            }
            let mut information: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &information as *const _ as *const _,
                std::mem::size_of_val(&information) as u32,
            ) == 0
                || AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE) == 0
            {
                let error = io::Error::last_os_error();
                CloseHandle(job);
                return Err(error);
            }
            Ok(ProcessGroup { job })
        }
    }

    impl ProcessGroup {
        pub fn terminate(&self) {
            unsafe {
                TerminateJobObject(self.job, 0);
            }
        }

        pub fn kill(&self) {
            unsafe {
                TerminateJobObject(self.job, 1);
            }
        }
    }

    impl Drop for ProcessGroup {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.job);
            }
        }
    }
}

pub use platform::{attach, configure, ProcessGroup};
