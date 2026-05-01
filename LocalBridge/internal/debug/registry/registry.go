package registry

import "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"

func DefaultCapabilityManifest() protocol.CapabilityManifest {
	return protocol.CapabilityManifest{
		Generation: protocol.Generation,
		Protocol:   protocol.ProtocolVersion,
		RunModes: []string{
			string(protocol.RunModeRunFromNode),
			string(protocol.RunModeSingleNodeRun),
			string(protocol.RunModeRecognitionOnly),
			string(protocol.RunModeActionOnly),
		},
		Diagnostics: []string{
			"preflight",
			"resource-load",
			"target-node",
			"agent",
			"agent-run-profile",
			"performance-summary",
			"trace-replay",
		},
		Artifacts: []string{
			"task-detail",
			"recognition-detail",
			"action-detail",
			"screenshot",
			"performance-summary",
		},
		ScreenshotSources: []string{
			"manual",
			"recognition-input",
		},
		ProfileFeatures: []string{
			"multi-resource",
			"multi-agent",
			"agent-run-profile",
		},
		DebugFeatures: []string{
			"trace-replay",
			"performance-summary",
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
