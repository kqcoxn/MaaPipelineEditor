package updatehttp

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/net/http/httpproxy"
)

func TestProxySelection(t *testing.T) {
	for _, test := range []struct {
		name, target, server, bypass, httpProxy, httpsProxy, all, noProxy, want string
	}{
		{name: "system shared", target: "https://github.com", server: "127.0.0.1:7897", want: "http://127.0.0.1:7897"},
		{name: "system protocol", target: "https://github.com", server: "http=127.0.0.1:7890; https=127.0.0.1:7897", want: "http://127.0.0.1:7897"},
		{name: "http protocol", target: "http://github.com", server: "http=127.0.0.1:7890;https=127.0.0.1:7897", want: "http://127.0.0.1:7890"},
		{name: "missing protocol is direct", target: "https://github.com", server: "http=127.0.0.1:7890"},
		{name: "environment overrides system", target: "https://github.com", server: "127.0.0.1:7897", httpsProxy: "http://explicit:1234", bypass: "*", want: "http://explicit:1234"},
		{name: "all proxy", target: "https://github.com", server: "127.0.0.1:7897", all: "socks5://explicit:1234", want: "socks5://explicit:1234"},
		{name: "specific overrides all", target: "https://github.com", httpsProxy: "http://explicit:1234", all: "http://other:4567", want: "http://explicit:1234"},
		{name: "no proxy overrides system", target: "https://github.com", server: "127.0.0.1:7897", noProxy: "github.com"},
		{name: "no proxy overrides environment", target: "https://github.com", httpsProxy: "http://explicit:1234", noProxy: "*"},
		{name: "CIDR bypass", target: "https://10.1.2.3", server: "127.0.0.1:7897", noProxy: "10.0.0.0/8"},
		{name: "system wildcard", target: "https://assets.example.com", server: "127.0.0.1:7897", bypass: "*.example.com;<local>"},
		{name: "system port", target: "https://assets.example.com:8443", server: "127.0.0.1:7897", bypass: "assets.example.com:8443"},
		{name: "local bypass", target: "http://intranet", server: "127.0.0.1:7897", bypass: "<local>"},
		{name: "loopback IPv4", target: "http://127.0.0.1:8080", server: "127.0.0.1:7897"},
		{name: "loopback IPv6", target: "http://[::1]:8080", server: "127.0.0.1:7897"},
		{name: "localhost", target: "http://localhost:8080", httpsProxy: "http://explicit:1234", httpProxy: "http://explicit:1234"},
		{name: "no settings", target: "https://github.com"},
	} {
		t.Run(test.name, func(t *testing.T) {
			selectProxy := proxySelector(httpproxy.Config{HTTPProxy: test.httpProxy, HTTPSProxy: test.httpsProxy, NoProxy: test.noProxy}, test.all, systemProxy{test.server, test.bypass})
			req, _ := http.NewRequest(http.MethodGet, test.target, nil)
			proxy, err := selectProxy(req)
			if err != nil {
				t.Fatal(err)
			}
			got := ""
			if proxy != nil {
				got = proxy.String()
			}
			if got != test.want {
				t.Fatalf("proxy = %q, want %q", got, test.want)
			}
		})
	}
}

// A real CONNECT tunnel proves HTTPS downloads and cross-host release redirects
// use the selected system proxy instead of requiring direct DNS/network access.
func TestHTTPSDownloadAndRedirectThroughSystemProxy(t *testing.T) {
	origin := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/release" {
			http.Redirect(w, r, "https://assets.example.com/bundle", http.StatusFound)
			return
		}
		fmt.Fprint(w, "verified release bytes")
	}))
	defer origin.Close()
	hosts := make(chan string, 4)
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect {
			http.Error(w, "CONNECT required", 400)
			return
		}
		hosts <- r.Host
		upstream, err := net.DialTimeout("tcp", origin.Listener.Addr().String(), time.Second)
		if err != nil {
			http.Error(w, "upstream unavailable", 502)
			return
		}
		defer upstream.Close()
		connection, buffered, err := w.(http.Hijacker).Hijack()
		if err != nil {
			return
		}
		defer connection.Close()
		fmt.Fprint(connection, "HTTP/1.1 200 Connection Established\r\n\r\n")
		go func() { _, _ = io.Copy(upstream, buffered) }()
		_, _ = io.Copy(connection, upstream)
	}))
	defer proxy.Close()
	client := NewClient(5 * time.Second)
	defer client.CloseIdleConnections()
	transport := client.Transport.(*http.Transport)
	transport.TLSClientConfig = origin.Client().Transport.(*http.Transport).TLSClientConfig.Clone()
	transport.Proxy = proxySelector(httpproxy.Config{}, "", systemProxy{server: proxy.URL})
	response, err := client.Get("https://release.example.com/release")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil || string(body) != "verified release bytes" {
		t.Fatalf("download = %q, %v", body, err)
	}
	for _, want := range []string{"release.example.com:443", "assets.example.com:443"} {
		select {
		case got := <-hosts:
			if got != want {
				t.Fatalf("CONNECT host = %s, want %s", got, want)
			}
		default:
			t.Fatalf("missing CONNECT to %s", want)
		}
	}
}
