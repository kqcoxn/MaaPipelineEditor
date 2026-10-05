//go:build !windows

package adbprocess

func newScope() (processScope, error)  { return nil, nil }
func normalizePath(path string) string { return path }
func (g *guard) watch()                {}
