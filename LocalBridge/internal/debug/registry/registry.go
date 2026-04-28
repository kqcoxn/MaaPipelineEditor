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
			"agent-run-profile",
			"interface-option",
			"batch-recognition",
			"performance-summary",
			"trace-replay",
		},
		Artifacts: []string{
			"task-detail",
			"recognition-detail",
			"action-detail",
			"screenshot",
			"screenshot/live",
			"performance-summary",
			"batch-recognition-summary",
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
			"agent-run-profile",
		},
		DebugFeatures: []string{
			"trace-replay",
			"performance-summary",
			"batch-recognition",
			"agent-run-profile",
		},
		Maa: protocol.MaaInfo{
			MFWVersion: "unknown",
			SupportedControllers: []string{
				"adb",
				"win32",
				"dbg",
			},
			UnavailableControllers: []protocol.UnavailableController{
				{
					Type:   "replay",
					Reason: "go-binding-dbg-controller-missing",
				},
				{
					Type:   "record",
					Reason: "go-binding-dbg-controller-missing",
				},
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
