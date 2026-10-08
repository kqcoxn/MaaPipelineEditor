use std::{
    io::Write,
    process::ChildStdin,
    sync::{Arc, Mutex},
};
use tokio::sync::oneshot;

pub const CANCELLED: &str = "已取消更新，可启动当前版本";

pub enum Signal {
    Async(oneshot::Sender<()>),
    Installer(ChildStdin),
}
enum Phase {
    Active(Option<Signal>),
    Cancelled,
    Closed,
}
pub struct Cancellation(Mutex<Phase>);
impl Cancellation {
    pub fn new() -> Self {
        Self(Mutex::new(Phase::Active(None)))
    }
    pub fn set_signal(&self, signal: Signal) -> bool {
        let mut phase = self.0.lock().unwrap();
        if let Phase::Active(slot) = &mut *phase {
            *slot = Some(signal);
            true
        } else {
            false
        }
    }
    pub fn cancel(&self) -> Result<bool, String> {
        let mut phase = self.0.lock().unwrap();
        if let Phase::Active(slot) = &mut *phase {
            if let Some(signal) = slot.take() {
                match signal {
                    Signal::Async(sender) => {
                        let _ = sender.send(());
                    }
                    Signal::Installer(mut input) => {
                        input.write_all(b"cancel\n").map_err(|e| e.to_string())?;
                    }
                }
            }
            *phase = Phase::Cancelled;
            Ok(true)
        } else {
            Ok(false)
        }
    }
    // The same lock arbitrates cancellation and permission to replace files.
    pub fn finish(&self) -> Result<bool, String> {
        let mut phase = self.0.lock().unwrap();
        if let Phase::Active(slot) = &mut *phase {
            if let Some(Signal::Installer(mut input)) = slot.take() {
                input.write_all(b"install\n").map_err(|e| e.to_string())?;
            }
            *phase = Phase::Closed;
            Ok(true)
        } else {
            Ok(false)
        }
    }
    pub fn active(&self) -> bool {
        matches!(*self.0.lock().unwrap(), Phase::Active(_))
    }
}

pub struct Scope<'a> {
    slot: &'a Mutex<Option<Arc<Cancellation>>>,
    pub control: Arc<Cancellation>,
}
impl<'a> Scope<'a> {
    pub fn new(slot: &'a Mutex<Option<Arc<Cancellation>>>) -> Self {
        let control = Arc::new(Cancellation::new());
        *slot.lock().unwrap() = Some(control.clone());
        Self { slot, control }
    }
}
impl Drop for Scope<'_> {
    fn drop(&mut self) {
        self.slot.lock().unwrap().take();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_prevents_commit_and_retry_has_no_stale_signal() {
        let slot = Mutex::new(None);
        {
            let scope = Scope::new(&slot);
            let (tx, mut rx) = oneshot::channel();
            assert!(scope.control.set_signal(Signal::Async(tx)));
            assert!(scope.control.cancel().unwrap());
            assert_eq!(rx.try_recv(), Ok(()));
            assert!(!scope.control.finish().unwrap());
        }
        assert!(slot.lock().unwrap().is_none());
        let retry = Scope::new(&slot);
        assert!(retry.control.finish().unwrap());
        assert!(!retry.control.cancel().unwrap());
    }

    #[test]
    fn cancellation_and_commit_cannot_both_win() {
        for _ in 0..100 {
            let control = Arc::new(Cancellation::new());
            let barrier = Arc::new(std::sync::Barrier::new(2));
            let other = control.clone();
            let gate = barrier.clone();
            let cancel = std::thread::spawn(move || {
                gate.wait();
                other.cancel().unwrap()
            });
            barrier.wait();
            let committed = control.finish().unwrap();
            assert_ne!(committed, cancel.join().unwrap());
            assert!(!control.active());
            let (sender, _) = oneshot::channel();
            assert!(!control.set_signal(Signal::Async(sender)));
        }
    }
}
