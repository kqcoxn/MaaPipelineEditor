package performance

import (
	"sort"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
)

type Service struct {
	traces    *trace.Store
	artifacts *artifact.Store
}

func NewService(traces *trace.Store, artifacts *artifact.Store) *Service {
	return &Service{traces: traces, artifacts: artifacts}
}

func (s *Service) Build(sessionID string, runID string) protocol.PerformanceSummary {
	events := s.traces.ListRun(sessionID, runID)
	return BuildSummary(sessionID, runID, events, s.artifacts.ListRefs(sessionID))
}

func (s *Service) Store(sessionID string, runID string) (protocol.ArtifactRef, protocol.PerformanceSummary, error) {
	summary := s.Build(sessionID, runID)
	ref, err := s.artifacts.AddJSON(sessionID, "performance-summary", summary)
	return ref, summary, err
}

func BuildSummary(sessionID string, runID string, events []protocol.Event, artifactRefs []protocol.ArtifactRef) protocol.PerformanceSummary {
	nodeIndex := map[string]*protocol.PerformanceNodeSummary{}
	detailRefs := map[string]struct{}{}
	screenshotRefs := map[string]struct{}{}

	summary := protocol.PerformanceSummary{
		SessionID:   sessionID,
		RunID:       runID,
		EventCount:  len(events),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}

	for _, event := range events {
		if event.Kind == "session" {
			if summary.Mode == "" {
				if mode, ok := event.Data["mode"].(string); ok {
					summary.Mode = mode
				}
			}
			if summary.Entry == "" {
				if entry, ok := event.Data["entry"].(string); ok {
					summary.Entry = entry
				}
			}
			if event.Phase == "starting" && summary.StartedAt == "" {
				summary.StartedAt = event.Timestamp
			}
			if event.Phase == "completed" || event.Phase == "failed" {
				summary.CompletedAt = event.Timestamp
				summary.Status = event.Status
			}
		}

		switch event.Kind {
		case "recognition":
			summary.RecognitionCount++
		case "action":
			summary.ActionCount++
		case "diagnostic":
			summary.DiagnosticCount++
		}

		if event.DetailRef != "" {
			detailRefs[event.DetailRef] = struct{}{}
		}
		if event.ScreenshotRef != "" {
			screenshotRefs[event.ScreenshotRef] = struct{}{}
		}

		if event.Node == nil {
			continue
		}
		key := event.Node.NodeID
		if key == "" {
			key = event.Node.RuntimeName
		}
		node := nodeIndex[key]
		if node == nil {
			node = &protocol.PerformanceNodeSummary{
				FileID:         event.Node.FileID,
				NodeID:         event.Node.NodeID,
				RuntimeName:    event.Node.RuntimeName,
				Label:          event.Node.Label,
				Status:         "visited",
				FirstSeq:       event.Seq,
				LastSeq:        event.Seq,
				FirstTimestamp: event.Timestamp,
				LastTimestamp:  event.Timestamp,
			}
			nodeIndex[key] = node
		}
		if event.Seq < node.FirstSeq {
			node.FirstSeq = event.Seq
			node.FirstTimestamp = event.Timestamp
		}
		if event.Seq >= node.LastSeq {
			node.LastSeq = event.Seq
			node.LastTimestamp = event.Timestamp
			if event.Phase == "failed" {
				node.Status = "failed"
			} else if event.Phase == "succeeded" || event.Phase == "completed" {
				node.Status = "succeeded"
			} else if event.Phase == "starting" && node.Status != "failed" {
				node.Status = "running"
			}
		}
		switch event.Kind {
		case "recognition":
			node.RecognitionCount++
		case "action":
			node.ActionCount++
		case "next-list":
			node.NextListCount++
		case "wait-freezes":
			node.WaitFreezesCount++
		}
		if event.DetailRef != "" {
			node.DetailRefCount++
		}
		if event.ScreenshotRef != "" {
			node.ScreenshotRefCount++
		}
	}

	summary.ScreenshotRefCount = len(screenshotRefs)
	nodes := make([]protocol.PerformanceNodeSummary, 0, len(nodeIndex))
	for _, node := range nodeIndex {
		node.DurationMs = durationMillis(node.FirstTimestamp, node.LastTimestamp)
		nodes = append(nodes, *node)
	}
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].FirstSeq == nodes[j].FirstSeq {
			return nodes[i].RuntimeName < nodes[j].RuntimeName
		}
		return nodes[i].FirstSeq < nodes[j].FirstSeq
	})
	summary.Nodes = nodes
	summary.NodeCount = len(nodes)

	slowNodes := append([]protocol.PerformanceNodeSummary{}, nodes...)
	sort.Slice(slowNodes, func(i, j int) bool {
		if slowNodes[i].DurationMs == slowNodes[j].DurationMs {
			return slowNodes[i].LastSeq > slowNodes[j].LastSeq
		}
		return slowNodes[i].DurationMs > slowNodes[j].DurationMs
	})
	if len(slowNodes) > 10 {
		slowNodes = slowNodes[:10]
	}
	summary.SlowNodes = slowNodes
	summary.DurationMs = durationMillis(summary.StartedAt, summary.CompletedAt)
	summary.ArtifactRefCount = len(artifactRefs)
	return summary
}

func durationMillis(start string, end string) int64 {
	if start == "" || end == "" {
		return 0
	}
	startTime, err := time.Parse(time.RFC3339Nano, start)
	if err != nil {
		return 0
	}
	endTime, err := time.Parse(time.RFC3339Nano, end)
	if err != nil {
		return 0
	}
	if endTime.Before(startTime) {
		return 0
	}
	return endTime.Sub(startTime).Milliseconds()
}
