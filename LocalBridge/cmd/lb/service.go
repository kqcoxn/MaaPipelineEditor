package main

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
	"github.com/spf13/cobra"
	"io"
	"os"
	"time"
)

var managedMode bool

func init() {
	rootCmd.Flags().BoolVar(&managedMode, "managed", false, "由 MPE Desktop 托管（stdin 关闭时退出）")
	service := &cobra.Command{Use: "service", Short: "查询或停止唯一的 LocalBridge 服务"}
	var jsonOutput, force bool
	var instanceID string
	status := &cobra.Command{Use: "status", RunE: func(cmd *cobra.Command, args []string) error {
		s, err := managed.Query(cmd.Context())
		if errors.Is(err, managed.ErrNotRunning) {
			s.State = "stopped"
			err = nil
		}
		if err != nil {
			return err
		}
		return json.NewEncoder(cmd.OutOrStdout()).Encode(s)
	}}
	stop := &cobra.Command{Use: "stop", RunE: func(cmd *cobra.Command, args []string) error {
		s, err := managed.Query(cmd.Context())
		if err != nil {
			return err
		}
		if instanceID != "" && instanceID != s.ID {
			return errors.New("实例已变更，请重新检查")
		}
		if force && instanceID == "" {
			return errors.New("强制停止必须指定 --id")
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()
		if err = managed.Stop(ctx, s.ID, force); err != nil {
			return err
		}
		return json.NewEncoder(cmd.OutOrStdout()).Encode(map[string]string{"state": "stopped"})
	}}
	service.PersistentFlags().BoolVar(&jsonOutput, "json", false, "结构化输出")
	stop.Flags().BoolVar(&force, "force", false, "明确强制结束目标服务")
	stop.Flags().StringVar(&instanceID, "id", "", "预期实例身份")
	service.AddCommand(status, stop)
	rootCmd.AddCommand(service)
}
func watchOwner(s *managed.Service) {
	if !managedMode {
		return
	}
	owner := os.Stdin
	go func() {
		_, _ = io.Copy(io.Discard, owner)
		s.RequestStop()
		select {
		case <-s.Closed():
		case <-time.After(10 * time.Second):
			os.Exit(1)
		}
	}()
}
