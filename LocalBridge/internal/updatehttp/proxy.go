package updatehttp

import (
	"net/http"
	"net/url"
	"path"
	"strings"

	"golang.org/x/net/http/httpproxy"
)

type systemProxy struct{ server, bypass string }

// Windows accepts either one proxy for all protocols or protocol=host:port pairs.
func (s systemProxy) forScheme(scheme string) string {
	if !strings.Contains(s.server, "=") {
		return strings.TrimSpace(s.server)
	}
	for _, entry := range strings.Split(s.server, ";") {
		key, value, ok := strings.Cut(entry, "=")
		if ok && strings.EqualFold(strings.TrimSpace(key), scheme) {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (s systemProxy) bypasses(u *url.URL) bool {
	host := strings.ToLower(u.Hostname())
	for _, entry := range strings.Split(s.bypass, ";") {
		pattern := strings.ToLower(strings.TrimSpace(entry))
		if pattern == "<local>" && !strings.ContainsAny(host, ".:") {
			return true
		}
		if pattern == "" {
			continue
		}
		if matched, _ := path.Match(pattern, host); matched {
			return true
		}
		if matched, _ := path.Match(pattern, strings.ToLower(u.Host)); matched {
			return true
		}
	}
	return false
}

func proxySelector(config httpproxy.Config, all string, system systemProxy) func(*http.Request) (*url.URL, error) {
	if config.HTTPProxy == "" {
		config.HTTPProxy = all
	}
	if config.HTTPSProxy == "" {
		config.HTTPSProxy = all
	}
	systemHTTP, systemHTTPS := config.HTTPProxy == "", config.HTTPSProxy == ""
	if systemHTTP {
		config.HTTPProxy = system.forScheme("http")
	}
	if systemHTTPS {
		config.HTTPSProxy = system.forScheme("https")
	}
	selectProxy := config.ProxyFunc()
	return func(req *http.Request) (*url.URL, error) {
		useSystem := req.URL.Scheme == "http" && systemHTTP || req.URL.Scheme == "https" && systemHTTPS
		if useSystem && system.bypasses(req.URL) {
			return nil, nil
		}
		// httpproxy handles NO_PROXY (including CIDR/ports) and loopback bypass.
		return selectProxy(req.URL)
	}
}
