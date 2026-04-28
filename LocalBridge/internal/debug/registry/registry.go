package registry

import "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"

func DefaultCapabilityManifest() protocol.CapabilityManifest {
	return protocol.CapabilityManifest{
		Generation: protocol.Generation,
		Protocol:   protocol.ProtocolVersion,
		RunModes: []string{
			string(protocol.RunModeFullRun),
			string(protocol.RunModeRunFromNode),
			string(protocol.RunModeSingleNodeRun),
			string(protocol.RunModeRecognitionOnly),
			string(protocol.RunModeActionOnly),
			string(protocol.RunModeFixedImageRecognition),
		},
		Diagnostics: []string{
			"preflight",
			"resource-load",
			"target-node",
			"fixed-image",
			"agent",
			"agent-managed",
			"interface-option",
		},
		Artifacts: []string{
			"task-detail",
			"recognition-detail",
			"action-detail",
			"screenshot",
			"screenshot/live",
		},
		ScreenshotSources: []string{
			"manual",
			"live",
			"recognition-input",
			"fixed-image",
		},
		ProfileFeatures: []string{
			"interface-import",
			"multi-resource",
			"multi-agent",
			"managed-agent",
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
