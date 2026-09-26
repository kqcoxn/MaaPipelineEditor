package updatehttp

import "golang.org/x/sys/windows/registry"

// Read the current user's manual Windows Internet Settings, as reqwest does.
// PAC/WPAD require URL-specific script evaluation and are not treated as a proxy URL.
func readSystemProxy() systemProxy {
	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Internet Settings`, registry.QUERY_VALUE)
	if err != nil {
		return systemProxy{}
	}
	defer key.Close()
	enabled, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil || enabled == 0 {
		return systemProxy{}
	}
	server, _, _ := key.GetStringValue("ProxyServer")
	bypass, _, _ := key.GetStringValue("ProxyOverride")
	return systemProxy{server, bypass}
}
