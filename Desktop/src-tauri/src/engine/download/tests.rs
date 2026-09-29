use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

fn server(responses: Vec<(u16, &'static str)>) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}/manifest.json", listener.local_addr().unwrap());
    let worker = thread::spawn(move || {
        listener.set_nonblocking(true).unwrap();
        for (status, body) in responses {
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(std::time::Instant::now() < deadline, "request not received");
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("{error}"),
                }
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut request = [0; 4096];
            stream.read(&mut request).unwrap();
            write!(
                stream,
                "HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        }
    });
    (address, worker)
}

fn client() -> Client {
    Client::builder().no_proxy().build().unwrap()
}

#[test]
fn transient_failure_recovers_and_records_the_failed_attempt() {
    let (address, server) = server(vec![(503, "unavailable"), (200, r#"{"version":"2.0.4"}"#)]);
    let mut progress = Vec::new();
    let value = manifest(&client(), &address, |message| {
        progress.push(message.to_owned())
    })
    .unwrap();
    server.join().unwrap();
    assert_eq!(value["version"], "2.0.4");
    assert!(progress
        .iter()
        .any(|message| message.contains("503") && message.contains("即将重试")));
    assert!(progress.last().unwrap().contains("第 2/3 次"));
}

#[test]
fn persistent_transient_failure_stops_after_three_attempts() {
    let (address, server) = server(vec![(503, "unavailable"); 3]);
    let error = manifest(&client(), &address, |_| {}).unwrap_err();
    server.join().unwrap();
    assert!(error.contains("第 3/3 次"));
    assert!(error.contains("503"));
}

#[test]
fn missing_release_and_invalid_json_are_not_retried() {
    for (status, body, expected) in [(404, "missing", "404"), (200, "invalid", "响应解析失败")]
    {
        let (address, server) = server(vec![(status, body)]);
        let error = manifest(&client(), &address, |_| {}).unwrap_err();
        server.join().unwrap();
        assert!(error.contains("第 1/3 次"));
        assert!(error.contains(expected), "{error}");
    }
}

#[test]
fn timeout_keeps_its_underlying_cause_in_the_final_error() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}/manifest.json", listener.local_addr().unwrap());
    // Keep the socket open without responding, so each request reaches its deadline.
    let error =
        request_manifest(&client(), &address, Duration::from_millis(30), |_| {}).unwrap_err();
    assert!(error.contains("第 3/3 次"));
    assert!(error.contains("请求超时"), "{error}");
    assert!(error.contains("原因："), "{error}");
}
