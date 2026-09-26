// Package updatehttp configures outbound installation requests without changing
// process-wide proxy settings or the loopback clients used to control LocalBridge.
package updatehttp

import (
	"net/http"
	"os"
	"time"

	"golang.org/x/net/http/httpproxy"
)

func NewClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	all := os.Getenv("ALL_PROXY")
	if all == "" {
		all = os.Getenv("all_proxy")
	}
	transport.Proxy = proxySelector(*httpproxy.FromEnvironment(), all, readSystemProxy())
	return &http.Client{Transport: transport, Timeout: timeout}
}
