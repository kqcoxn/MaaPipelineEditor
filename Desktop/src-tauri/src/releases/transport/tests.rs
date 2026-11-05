use super::*;
use crate::releases::tests::fixture;
use std::{io::Write, net::TcpListener, thread, time::Instant};

fn client() -> Client {
    Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap()
}
fn request(stream: &mut std::net::TcpStream) -> String {
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    let mut bytes = Vec::new();
    while !bytes.ends_with(b"\r\n\r\n") {
        let mut byte = [0];
        assert_eq!(stream.read(&mut byte).unwrap(), 1);
        bytes.push(byte[0]);
        assert!(bytes.len() < 16 * 1024);
    }
    String::from_utf8(bytes).unwrap()
}
fn respond(stream: &mut std::net::TcpStream, status: u16, body: &str) {
    write!(stream,
        "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()
    ).unwrap();
}
fn api_server(status: u16, body: String) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}/releases", listener.local_addr().unwrap());
    let worker = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let request = request(&mut stream);
        respond(&mut stream, status, &body);
        request
    });
    (address, worker)
}

#[test]
fn sources_are_requested_concurrently_and_the_newer_complete_index_wins() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let server = thread::spawn(move || {
        let mut requests = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(3);
        // Neither response is sent until BOTH requests arrive. Serial fetching
        // cannot pass this test, without relying on fragile elapsed-time assertions.
        while requests.len() < 2 {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let path = request(&mut stream);
                    requests.push((stream, path));
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    assert!(
                        Instant::now() < deadline,
                        "sources were not requested concurrently"
                    );
                    thread::sleep(Duration::from_millis(5));
                }
                Err(error) => panic!("{error}"),
            }
        }
        for (mut stream, path) in requests {
            let mut index = if path.starts_with("GET /site ") {
                fixture("2.0.0")
            } else {
                fixture("2.0.1")
            };
            index.generated_at = if path.starts_with("GET /site ") {
                100
            } else {
                200
            };
            respond(&mut stream, 200, &serde_json::to_string(&index).unwrap());
        }
    });
    let result = static_index_from(
        &client(),
        &format!("{base}/site"),
        &format!("{base}/release"),
    );
    server.join().unwrap();
    assert_eq!(result.unwrap().versions(), ["2.0.1"]);
}

#[test]
fn token_lookup_downloads_one_complete_index_instead_of_historical_manifests() {
    let release = json!({"tag_name":"v2.0.1", "draft":false, "prerelease":false,
        "assets":[{"name":"mpe-versions.json", "browser_download_url":"https://untrusted.example/index.json"}]});
    let (url, server) = api_server(200, release.to_string());
    let dir = tempfile::tempdir().unwrap();
    let result = github_index(
        &client(),
        &url,
        &dir.path().join("retry.json"),
        "test-token",
        |url| {
            assert_eq!(
                url,
                format!("{}/download/v2.0.1/mpe-versions.json", engine::RELEASES)
            );
            let mut full = fixture("2.0.1");
            full.releases.extend(fixture("1.9.0").releases);
            parse(serde_json::to_value(full).unwrap())
        },
    )
    .unwrap();
    let request = server.join().unwrap();
    assert!(request.starts_with("GET /releases/latest HTTP/1.1"));
    assert!(request
        .to_lowercase()
        .contains("authorization: bearer test-token\r\n"));
    assert_eq!(result.versions(), ["2.0.1", "1.9.0"]);
}

#[test]
fn incomplete_or_non_stable_releases_cannot_supply_an_index() {
    let valid = json!({"tag_name":"v2.0.1", "draft":false, "prerelease":false,
        "assets":[{"name":"mpe-versions.json"}]});
    for (key, value) in [
        ("tag_name", json!("../../malicious")),
        ("tag_name", json!("v2.0.1-beta")),
        ("draft", json!(true)),
        ("prerelease", json!(true)),
        ("assets", json!([{"name":"mpe-manifest.json"}])),
    ] {
        let mut release = valid.clone();
        release[key] = value;
        assert!(release_index_url(&release).is_err());
    }
}

#[test]
fn rate_limits_preserve_retry_deadlines_without_downloading_an_index() {
    let (url, server) = api_server(429, "{}".into());
    let dir = tempfile::tempdir().unwrap();
    let retry = dir.path().join("retry.json");
    let before = now();
    let result = github_index(&client(), &url, &retry, "test-token", |_| {
        panic!("a rate-limited request must not download an index")
    });
    server.join().unwrap();
    assert!(result.err().unwrap().contains("请求受限"));
    let until: u64 = std::fs::read_to_string(retry).unwrap().parse().unwrap();
    assert!(until >= before + 60);
}
