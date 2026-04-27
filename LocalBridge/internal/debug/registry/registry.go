package registry

import "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"

func DefaultCapabilityManifest() protocol.CapabilityManifest {
	return protocol.CapabilityManifest{
		Generation: protocol.Generation,
		Protocol:   protocol.ProtocolVersion,
		RunModes: []string{
			string(protocol.RunModeFullRun),
			string(protocol.RunModeRunFromNode),
		},
		Diagnostics:       []string{},
		Artifacts:         []string{},
		ScreenshotSources: []string{},
		ProfileFeatures: []string{
			"interface-import",
			"multi-resource",
			"multi-agent",
		},
		Maa: protocol.MaaInfo{
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
