package main

import (
	"fmt"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/install"
	"github.com/spf13/cobra"
)

func init() {
	var binary, editor, runtimeDir, version, mfwVersion, directory, desktopConfig string
	command := &cobra.Command{Use: "prepare-local", Short: "从本地源码产物准备全局 MPE 环境（开发用）", RunE: func(cmd *cobra.Command, args []string) error {
		if binary == "" || editor == "" || runtimeDir == "" || version == "" || mfwVersion == "" {
			return fmt.Errorf("binary、editor、runtime、version、mfw-version 均为必填")
		}
		minimum, err := install.ReadMinimumDesktopRevision(desktopConfig)
		if err != nil {
			return err
		}
		return install.InstallLocal(cmd.Context(), directory, binary, editor, runtimeDir, version, mfwVersion, minimum, cmd.OutOrStdout())
	}}
	command.Flags().StringVar(&desktopConfig, "desktop-config", "", "桌面发布配置 JSON")
	command.Flags().StringVar(&binary, "binary", "", "源码构建的 mpelb")
	command.Flags().StringVar(&editor, "editor", "", "Editor 构建目录")
	command.Flags().StringVar(&runtimeDir, "runtime", "", "配套 runtime 目录")
	command.Flags().StringVar(&version, "version", "", "MPE 版本")
	command.Flags().StringVar(&mfwVersion, "mfw-version", "", "MaaFramework 版本")
	command.Flags().StringVar(&directory, "directory", install.DefaultDirectory(), "安装目录")
	rootCmd.AddCommand(command)
}
