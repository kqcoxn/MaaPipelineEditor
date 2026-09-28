package main

import (
	"os"
	"path/filepath"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/diagnostics"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	"github.com/spf13/cobra"
)

// This command only reads files; it works even while the native task is stuck
// or after the managed LocalBridge process has exited.
func init() {
	var output, desktopDir string
	logs := &cobra.Command{Use: "logs", Short: "诊断日志"}
	export := &cobra.Command{Use: "export", Short: "导出完整诊断包（无需服务运行）", RunE: func(cmd *cobra.Command, args []string) error {
		paths.Init()
		snapshot, err := diagnostics.ReadSnapshot(filepath.Join(paths.GetDataDir(), "diagnostics-session.json"))
		if err != nil {
			snapshot = diagnostics.Snapshot{Version: Version, LogDir: paths.GetLogDir(), MFWDir: paths.GetLogDir()}
			if !os.IsNotExist(err) {
				snapshot.Warnings = append(snapshot.Warnings, "无法读取诊断会话，使用默认日志目录: "+err.Error())
			}
		}
		if desktopDir != "" {
			snapshot.DesktopDir = desktopDir
		}
		return diagnostics.Save(output, snapshot)
	}}
	export.Flags().StringVar(&output, "output", "", "输出 ZIP 路径")
	_ = export.MarkFlagRequired("output")
	export.Flags().StringVar(&desktopDir, "desktop-log-dir", "", "桌面端日志目录")
	logs.AddCommand(export)
	rootCmd.AddCommand(logs)
}
