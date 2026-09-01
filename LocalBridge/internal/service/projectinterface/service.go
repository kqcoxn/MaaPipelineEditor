package projectinterface

import (
	"fmt"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	fileservice "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
)

const EventChanged = "project_interface.changed"
const EventContextDisposed = "project_interface.context_disposed"
const EventContextResolved = "project_interface.context_resolved"

type Service struct {
	mu             sync.RWMutex
	refreshMu      sync.Mutex
	root           string
	canonicalRoot  string
	configuredPath string
	files          *fileservice.Service
	eventBus       *eventbus.EventBus
	loader         *loader
	watcher        *sourceWatcher
	status         Status
	current        *ProjectSnapshot
	lastGood       *ProjectSnapshot
	contexts       map[string]*RuntimePlan
}

func NewService(root, configuredPath string, files *fileservice.Service, eventBus *eventbus.EventBus) (*Service, error) {
	schema, err := compileSchema()
	if err != nil {
		return nil, fmt.Errorf("编译 Project Interface Schema 失败: %w", err)
	}
	root, err = filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	root = filepath.Clean(root)
	canonicalRoot, err := canonicalExistingPath(root)
	if err != nil {
		return nil, fmt.Errorf("解析 LocalBridge 根目录失败: %w", err)
	}
	service := &Service{
		root: root, canonicalRoot: filepath.Clean(canonicalRoot), configuredPath: strings.TrimSpace(configuredPath),
		files: files, eventBus: eventBus, loader: &loader{schema: schema},
		contexts: map[string]*RuntimePlan{},
	}
	watcher, err := newSourceWatcher(service.Refresh)
	if err != nil {
		return nil, fmt.Errorf("创建 Project Interface 文件监听器失败: %w", err)
	}
	service.watcher = watcher
	eventBus.Subscribe(eventbus.EventFileChanged, func(event eventbus.Event) {
		if service.shouldRefreshForFileEvent(event) {
			service.Refresh()
		}
	})
	return service, nil
}

func (s *Service) Start() { s.Refresh() }

func (s *Service) Close() {
	if s.watcher != nil {
		s.watcher.Close()
	}
}

func (s *Service) Reload(configuredPath string) {
	s.mu.Lock()
	s.configuredPath = strings.TrimSpace(configuredPath)
	invalidated := s.invalidateContextsLocked()
	s.mu.Unlock()
	s.publishDisposed(invalidated)
	s.Refresh()
}

func (s *Service) Refresh() {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	s.mu.RLock()
	configured := s.configuredPath
	previous := s.status
	s.mu.RUnlock()
	status := Status{ConfiguredPath: configured, Mode: "auto"}
	var entry string
	if configured != "" {
		status.Mode = "explicit"
		abs, err := s.resolveExplicitEntry(configured)
		if err != nil {
			status.State = StateInvalid
			status.Diagnostics = []Diagnostic{{Severity: "error", Category: "path", Code: "pi.entry.invalid", Message: err.Error(), File: configured}}
			if candidate, candidateErr := s.explicitEntryCandidate(configured); candidateErr == nil {
				status.EffectivePath = candidate
			}
			s.commit(status, nil)
			return
		}
		entry = abs
		status.EffectivePath = entry
	} else {
		candidates := s.discover()
		status.Candidates = candidates
		switch len(candidates) {
		case 0:
			status.State = StateNotFound
			s.commit(status, nil)
			return
		case 1:
			resolved, err := s.resolveDiscoveredEntry(candidates[0])
			if err != nil {
				status.State = StateInvalid
				status.EffectivePath = candidates[0]
				status.Diagnostics = []Diagnostic{{Severity: "error", Category: "path", Code: "pi.discovery.path_invalid", Message: err.Error(), File: candidates[0]}}
				s.commit(status, nil)
				return
			}
			entry = resolved
			status.EffectivePath = entry
		default:
			status.State = StateMultiple
			status.Diagnostics = []Diagnostic{{Severity: "error", Category: "runtime", Code: "pi.discovery.multiple", Message: "检索到多个 interface.json，请显式配置入口", Data: map[string]any{"candidates": candidates}}}
			s.commit(status, nil)
			return
		}
	}

	snapshot, err := s.loader.load(entry)
	if err != nil {
		status.State = StateInvalid
		if typed, ok := err.(*loadError); ok {
			status.Diagnostics = typed.Diagnostics
		} else {
			status.Diagnostics = []Diagnostic{{Severity: "error", Category: "runtime", Code: "pi.load.failed", Message: err.Error(), File: entry}}
		}
		s.commit(status, nil)
		return
	}
	status.State = StateReady
	status.ProjectID = snapshot.ProjectID
	status.Revision = snapshot.Revision
	status.Diagnostics = snapshot.Diagnostics
	s.commit(status, snapshot)
	if previous.Revision != status.Revision || previous.State != status.State || previous.EffectivePath != status.EffectivePath {
		// commit 已经发布事件；条件保留用于明确 revision 变化语义。
	}
}

func (s *Service) explicitEntryCandidate(configured string) (string, error) {
	path := strings.TrimSpace(configured)
	if !filepath.IsAbs(path) {
		path = filepath.Join(s.root, path)
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func (s *Service) resolveExplicitEntry(configured string) (string, error) {
	candidate, err := s.explicitEntryCandidate(configured)
	if err != nil {
		return "", fmt.Errorf("解析显式 PI 入口失败: %w", err)
	}
	resolved, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		return "", fmt.Errorf("解析显式 PI 入口失败: %w", err)
	}
	return filepath.Clean(resolved), nil
}

func (s *Service) resolveDiscoveredEntry(candidate string) (string, error) {
	abs, err := filepath.Abs(candidate)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if !isWithin(s.root, abs) {
		return "", fmt.Errorf("自动发现的 PI 入口越出 LocalBridge 根目录")
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", err
	}
	if !isWithin(s.canonicalRoot, resolved) {
		return "", fmt.Errorf("自动发现的 PI 入口通过符号链接越出 LocalBridge 根目录")
	}
	return filepath.Clean(resolved), nil
}

func (s *Service) discover() []string {
	return s.files.FindFilesByName("interface.json")
}

func (s *Service) commit(status Status, snapshot *ProjectSnapshot) {
	s.mu.Lock()
	previousStatus := s.status
	previous := s.current
	unchanged := reflect.DeepEqual(previousStatus, status) && ((previous == nil && snapshot == nil) || (previous != nil && snapshot != nil && previous.Revision == snapshot.Revision && previous.EntryPath == snapshot.EntryPath))
	if unchanged {
		s.mu.Unlock()
		return
	}
	var invalidated []string
	if snapshot != nil {
		revisionChanged := s.current == nil || s.current.Revision != snapshot.Revision || s.current.EntryPath != snapshot.EntryPath
		s.current = snapshot
		s.lastGood = snapshot
		if revisionChanged {
			invalidated = s.invalidateContextsLocked()
		}
	} else {
		s.current = nil
		invalidated = s.invalidateContextsLocked()
	}
	status.HasLastGood = s.lastGood != nil
	s.status = status
	s.mu.Unlock()
	if snapshot == nil {
		s.files.SetPipelineRoots(nil)
	} else {
		s.files.SetPipelineRoots(projectPipelineRoots(snapshot))
	}
	s.updateWatchedSources(status, snapshot)
	s.publishDisposed(invalidated)
	s.eventBus.Publish(EventChanged, ChangeEvent{Status: status})
}

func projectPipelineRoots(snapshot *ProjectSnapshot) []string {
	values := make([]string, 0)
	for _, resource := range objectArray(snapshot.Document["resource"]) {
		values = append(values, stringSlice(resource["path"])...)
	}
	for _, controller := range objectArray(snapshot.Document["controller"]) {
		values = append(values, stringSlice(controller["attach_resource_path"])...)
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		path := value
		if !filepath.IsAbs(path) {
			path = filepath.Join(snapshot.InterfaceRoot, path)
		}
		resolved, err := filepath.EvalSymlinks(path)
		if err != nil {
			continue
		}
		result = append(result, filepath.Join(resolved, "pipeline"))
	}
	return result
}

func (s *Service) updateWatchedSources(status Status, snapshot *ProjectSnapshot) {
	if s.watcher == nil || status.Mode != "explicit" {
		if s.watcher != nil {
			s.watcher.Update(nil)
		}
		return
	}
	paths := []string{status.EffectivePath}
	if snapshot != nil {
		paths = append(paths, snapshot.Sources...)
	}
	s.watcher.Update(paths)
}

func (s *Service) shouldRefreshForFileEvent(event eventbus.Event) bool {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		return false
	}
	path, _ := data["file_path"].(string)
	if path == "" {
		return false
	}
	path = filepath.Clean(path)
	s.mu.RLock()
	configured := s.configuredPath
	current, lastGood := s.current, s.lastGood
	s.mu.RUnlock()
	if strings.EqualFold(filepath.Base(path), "interface.json") {
		for _, entry := range s.files.FindFilesByName("interface.json") {
			if samePath(entry, path) {
				return true
			}
		}
		return false
	}
	if configured != "" {
		entry := configured
		if !filepath.IsAbs(entry) {
			entry = filepath.Join(s.root, entry)
		}
		if samePath(path, entry) {
			return true
		}
	}
	for _, snapshot := range []*ProjectSnapshot{current, lastGood} {
		if snapshot == nil {
			continue
		}
		for _, source := range snapshot.Sources {
			if samePath(path, source) {
				return true
			}
		}
	}
	return false
}

func samePath(left, right string) bool {
	leftCanonical, leftErr := canonicalExistingPath(left)
	rightCanonical, rightErr := canonicalExistingPath(right)
	if leftErr == nil && rightErr == nil {
		return strings.EqualFold(leftCanonical, rightCanonical)
	}
	return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
}

func (s *Service) Status() Status { s.mu.RLock(); defer s.mu.RUnlock(); return s.status }

func (s *Service) Snapshot(language string) (*ProjectSnapshot, error) {
	s.mu.RLock()
	current, fallback, state := s.current, s.lastGood, s.status.State
	s.mu.RUnlock()
	if current != nil {
		return current.Localize(language), nil
	}
	if fallback != nil {
		result := fallback.Localize(language)
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Severity: "error", Category: "runtime", Code: "pi.snapshot.last_good", Message: "当前 PI 无效，返回的内容仅供参考，不能用于运行"})
		return result, nil
	}
	return nil, fmt.Errorf("Project Interface 当前不可用: %s", state)
}

func (s *Service) ResolveContext(req ContextRequest) (*RuntimePlan, error) {
	s.mu.RLock()
	current, status := s.current, s.status
	s.mu.RUnlock()
	if status.State != StateReady || current == nil {
		return nil, fmt.Errorf("Project Interface 当前不可用于运行: %s", status.State)
	}
	plan, err := current.ResolveContext(req)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.contexts[plan.ContextID] = plan
	s.mu.Unlock()
	s.eventBus.Publish(EventContextResolved, cloneRuntimePlan(plan))
	return cloneRuntimePlan(plan), nil
}

func (s *Service) Context(contextID string) (*RuntimePlan, error) {
	s.mu.RLock()
	plan := s.contexts[strings.TrimSpace(contextID)]
	revision, state := s.status.Revision, s.status.State
	s.mu.RUnlock()
	if plan == nil {
		return nil, fmt.Errorf("PI context 不存在或已释放")
	}
	if state != StateReady || plan.Revision != revision {
		return nil, fmt.Errorf("PI context 已过期，请重新解析")
	}
	return cloneRuntimePlan(plan), nil
}

func (s *Service) DisposeContext(contextID string) {
	contextID = strings.TrimSpace(contextID)
	s.mu.Lock()
	delete(s.contexts, contextID)
	s.mu.Unlock()
	s.eventBus.Publish(EventContextDisposed, contextID)
}

func (s *Service) invalidateContextsLocked() []string {
	ids := make([]string, 0, len(s.contexts))
	for id := range s.contexts {
		ids = append(ids, id)
	}
	s.contexts = map[string]*RuntimePlan{}
	sort.Strings(ids)
	return ids
}

func (s *Service) publishDisposed(contextIDs []string) {
	for _, contextID := range contextIDs {
		s.eventBus.Publish(EventContextDisposed, contextID)
	}
}

func cloneRuntimePlan(plan *RuntimePlan) *RuntimePlan {
	if plan == nil {
		return nil
	}
	copy := *plan
	copy.Controller = cloneMap(plan.Controller)
	copy.Resource = cloneMap(plan.Resource)
	copy.ResourcePaths = append([]string(nil), plan.ResourcePaths...)
	copy.Agents = append([]AgentPlan(nil), plan.Agents...)
	copy.Options = cloneMap(plan.Options)
	copy.OptionValues = cloneMap(plan.OptionValues)
	copy.PipelineOverrides = make([]map[string]any, len(plan.PipelineOverrides))
	for index, item := range plan.PipelineOverrides {
		copy.PipelineOverrides[index] = cloneMap(item)
	}
	return &copy
}
