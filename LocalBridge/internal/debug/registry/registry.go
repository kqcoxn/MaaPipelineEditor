package registry

const (
	Generation      = "debug-vNext"
	ProtocolVersion = "0.9.0"
)

// CapabilityManifest describes the debug-vNext surface exposed by LocalBridge.
type CapabilityManifest struct {
	Generation        string   `json:"generation"`
	Protocol          string   `json:"protocol"`
	RunModes          []string `json:"runModes"`
	Diagnostics       []string `json:"diagnostics"`
	Artifacts         []string `json:"artifacts"`
	ScreenshotSources []string `json:"screenshotSources"`
	ProfileFeatures   []string `json:"profileFeatures"`
	Maa               MaaInfo  `json:"maa"`
}

type MaaInfo struct {
	MFWVersion               string   `json:"mfwVersion"`
	SupportedControllers     []string `json:"supportedControllers"`
	SupportedTaskerAPIs      []string `json:"supportedTaskerApis"`
	SupportedResourceAPIs    []string `json:"supportedResourceApis"`
	SupportedAgentTransports []string `json:"supportedAgentTransports"`
}

func DefaultCapabilityManifest() CapabilityManifest {
	return CapabilityManifest{
		Generation: Generation,
		Protocol:   ProtocolVersion,
		RunModes: []string{
			"full-run",
			"run-from-node",
			"single-node-run",
			"recognition-only",
		},
		Diagnostics:       []string{},
		Artifacts:         []string{},
		ScreenshotSources: []string{},
		ProfileFeatures: []string{
			"interface-import",
			"multi-resource",
			"multi-agent",
		},
		Maa: MaaInfo{
			MFWVersion: "unknown",
			SupportedControllers: []string{
				"adb",
				"win32",
				"dbg",
				"replay",
				"record",
			},
			SupportedTaskerAPIs: []string{
				"PostTask",
				"PostRecognition",
				"PostAction",
				"PostStop",
			},
			SupportedResourceAPIs: []string{
				"PostBundle",
				"OverridePipeline",
				"OverrideNext",
				"OverrideImage",
				"GetNode",
				"GetNodeJSON",
				"GetNodeList",
			},
			SupportedAgentTransports: []string{
				"identifier",
				"tcp",
			},
		},
	}
}
