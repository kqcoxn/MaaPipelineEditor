package main

import (
	"os"
	"path/filepath"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/dependencies"
	"github.com/spf13/cobra"
)

func init() {
	deps := &cobra.Command{Use: "deps", Short: "管理 MPE 自管理依赖"}
	deps.AddCommand(&cobra.Command{
		Use:       "reinstall [all|mfw|ocr]",
		Short:     "强制重新下载并安装依赖（默认全部）",
		Long:      "强制重装 mpelb 同目录 runtime 中的依赖，不检查本地版本或已有文件。\nMFW 包含 MaaAgentBinary，版本遵循当前 MPE 的 mfwVersion。\n不更新 mpelb 本体，不修改配置。请先停止使用这些依赖的服务。",
		ValidArgs: []string{"all", "mfw", "ocr"},
		Args:      cobra.MatchAll(cobra.MaximumNArgs(1), cobra.OnlyValidArgs),
		RunE: func(cmd *cobra.Command, args []string) error {
			target := "all"
			if len(args) > 0 {
				target = args[0]
			}
			exe, err := os.Executable()
			if err != nil {
				return err
			}
			return dependencies.Reinstall(cmd.Context(), Version, target, filepath.Dir(exe), cmd.OutOrStdout(), cmd.ErrOrStderr())
		},
	})
	rootCmd.AddCommand(deps)
}
