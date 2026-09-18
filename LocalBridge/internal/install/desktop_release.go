package install

import (
	"encoding/json"
	"fmt"
	"os"
)

// ReadMinimumDesktopRevision reads the shared source-build/release configuration.
// This is packaging metadata; the CLI itself does not require a desktop host.
func ReadMinimumDesktopRevision(path string) (uint32, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	var config struct {
		Revision uint32 `json:"desktopRevision"`
		Minimum  uint32 `json:"minimumDesktopRevision"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return 0, err
	}
	if config.Revision == 0 || config.Minimum == 0 || config.Minimum > config.Revision {
		return 0, fmt.Errorf("无效桌面修订配置：需要 1 <= minimumDesktopRevision <= desktopRevision")
	}
	return config.Minimum, nil
}
