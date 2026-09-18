package main

import (
	"encoding/json"
	"fmt"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/install"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
	"github.com/spf13/cobra"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// Run mutations from a temporary executable: Windows locks running executables.
func installationCommand(cmd *cobra.Command, dir, version string, recoverOnly, withEditor bool) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	same := filepath.Clean(filepath.Dir(exe)) == filepath.Clean(dir)
	if strings.EqualFold(filepath.VolumeName(exe), filepath.VolumeName(dir)) && strings.EqualFold(filepath.Clean(filepath.Dir(exe)), filepath.Clean(dir)) {
		same = true
	}
	if same {
		temp, err := os.MkdirTemp("", "mpe-install-worker-")
		if err != nil {
			return err
		}
		if runtime.GOOS != "windows" {
			defer os.RemoveAll(temp)
		}
		copyPath := filepath.Join(temp, install.BinaryName())
		in, err := os.Open(exe)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(copyPath, os.O_CREATE|os.O_WRONLY, 0700)
		if err != nil {
			return err
		}
		_, err = io.Copy(out, in)
		out.Close()
		if err != nil {
			return err
		}
		action := "install"
		if recoverOnly {
			action = "recover"
		}
		args := []string{"env", action, "--directory", dir, "--json"}
		if !recoverOnly {
			args = append(args, "--version", version)
			if withEditor {
				args = append(args, "--with-editor")
			}
		}
		if runtime.GOOS == "windows" {
			args = append(args, "--wait-pid", strconv.Itoa(os.Getpid()))
		}
		worker := exec.CommandContext(cmd.Context(), copyPath, args...)
		worker.Stdout = cmd.OutOrStdout()
		worker.Stderr = cmd.ErrOrStderr()
		if runtime.GOOS == "windows" {
			fmt.Fprintln(cmd.ErrOrStderr(), "安装已交给独立进程，请等待 complete 事件后使用。")
			return worker.Start()
		}
		return worker.Run()
	}
	if recoverOnly {
		return install.Recover(dir)
	}
	m, err := install.FetchManifest(cmd.Context(), version)
	if err != nil {
		return err
	}
	if err := install.Install(cmd.Context(), dir, m, withEditor, cmd.OutOrStdout()); err != nil {
		return err
	}
	if err := install.RegisterPath(dir); err != nil {
		fmt.Fprintln(cmd.ErrOrStderr(), "环境已安装，但 PATH 注册失败:", err)
	}
	return nil
}
func init() {
	var directory, version string
	var jsonOutput bool
	var withEditor bool
	var waitPID int
	environment := &cobra.Command{Use: "env", Short: "管理全局 MPE 配套环境"}
	environment.PersistentFlags().StringVar(&directory, "directory", install.DefaultDirectory(), "安装目录")
	environment.PersistentFlags().IntVar(&waitPID, "wait-pid", 0, "安装引导进程 PID")
	_ = environment.PersistentFlags().MarkHidden("wait-pid")
	environment.PersistentFlags().BoolVar(&jsonOutput, "json", false, "结构化输出")
	environment.PersistentFlags().BoolVar(&withEditor, "with-editor", false, "包含桌面端所需的同版本 Editor；已安装的 Editor 随环境更新")
	environment.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		if waitPID > 0 {
			if err := managed.WaitProcessExit(waitPID); err != nil {
				return err
			}
		}
		if !filepath.IsAbs(directory) {
			return fmt.Errorf("安装路径必须是绝对路径")
		}
		return nil
	}
	check := &cobra.Command{Use: "check", RunE: func(cmd *cobra.Command, args []string) error {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(install.Inspect(directory, withEditor))
	}}
	setup := &cobra.Command{Use: "install", RunE: func(cmd *cobra.Command, args []string) error {
		return installationCommand(cmd, directory, version, false, withEditor)
	}}
	setup.Flags().StringVar(&version, "version", "latest", "MPE 版本（latest 或完整版本号）")
	recover := &cobra.Command{Use: "recover", RunE: func(cmd *cobra.Command, args []string) error {
		return installationCommand(cmd, directory, "", true, false)
	}}
	environment.AddCommand(check, setup, recover)
	rootCmd.AddCommand(environment)
}
