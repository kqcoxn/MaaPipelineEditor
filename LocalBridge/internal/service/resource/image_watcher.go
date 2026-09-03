package resource

import (
	"path/filepath"
	"sort"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	fileService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func supportedImageExtensions() []string {
	extensions := make([]string, 0, len(supportedImageExts))
	for extension := range supportedImageExts {
		extensions = append(extensions, extension)
	}
	sort.Strings(extensions)
	return extensions
}

func (s *Service) startImageWatcher() error {
	s.mu.RLock()
	root := s.root
	s.mu.RUnlock()

	watcher, err := fileService.NewWatcher(
		root,
		supportedImageExtensions(),
		s.allowsImageWatchDir,
		s.handleImageChange,
	)
	if err != nil {
		return err
	}
	if err := watcher.Start(); err != nil {
		return err
	}

	s.watcherMu.Lock()
	s.watcher = watcher
	s.watcherMu.Unlock()
	return nil
}

func (s *Service) stopImageWatcher() {
	s.watcherMu.Lock()
	watcher := s.watcher
	s.watcher = nil
	s.watcherMu.Unlock()
	if watcher != nil {
		watcher.Stop()
	}
}

func (s *Service) allowsImageWatchDir(path string) bool {
	s.mu.RLock()
	imageDirs := append([]string(nil), s.imageDirs...)
	s.mu.RUnlock()

	for _, imageDir := range imageDirs {
		if isPathWithin(path, imageDir) || isPathWithin(imageDir, path) {
			return true
		}
	}
	return false
}

func (s *Service) handleImageChange(change fileService.FileChange) {
	if change.IsDirectory {
		return
	}

	for _, relativePath := range s.relativeImagePaths(change.FilePath) {
		s.eventBus.Publish(eventbus.EventResourceImageChanged, models.ResourceImageChangedData{
			Type:         string(change.Type),
			RelativePath: relativePath,
		})
	}
}

func (s *Service) relativeImagePaths(path string) []string {
	s.mu.RLock()
	imageDirs := append([]string(nil), s.imageDirs...)
	s.mu.RUnlock()

	seen := make(map[string]bool)
	paths := make([]string, 0, 1)
	for _, imageDir := range imageDirs {
		if !isPathWithin(imageDir, path) {
			continue
		}
		relativePath, err := filepath.Rel(imageDir, path)
		if err != nil || relativePath == "." {
			continue
		}
		relativePath = filepath.ToSlash(relativePath)
		if !seen[relativePath] {
			seen[relativePath] = true
			paths = append(paths, relativePath)
		}
	}
	return paths
}

func isPathWithin(root, path string) bool {
	relativePath, err := filepath.Rel(filepath.Clean(root), filepath.Clean(path))
	return err == nil && relativePath != ".." && !strings.HasPrefix(relativePath, ".."+string(filepath.Separator))
}
