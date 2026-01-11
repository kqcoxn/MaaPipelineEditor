import { memo, useMemo, useState, useEffect } from "react";
import { message, Select, Tag, Button, Dropdown, Tooltip, Popover } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { getNextNodes, useFlowStore } from "../../../stores/flow";
import { useDebugStore } from "../../../stores/debugStore";
import { useMFWStore } from "../../../stores/mfwStore";
import { useFileStore } from "../../../stores/fileStore";
import { useToolbarStore } from "../../../stores/toolbarStore";
import { debugProtocol, configProtocol } from "../../../services/server";
import type { ConfigResponse } from "../../../services/protocols/ConfigProtocol";
import { useShallow } from "zustand/shallow";
import style from "../../../styles/ToolPanel.module.less";
import debugStyle from "../../../styles/DebugPanel.module.less";

/** 调试工具栏 */
function DebugPanel() {
  const nodes = useFlowStore((state) => state.nodes);
  const prefix = useFileStore((state) => state.currentFile.config.prefix);
  const connectionStatus = useMFWStore((state) => state.connectionStatus);
  const controllerId = useMFWStore((state) => state.controllerId);
  const recognitionPanelVisible = useToolbarStore(
    (state) => state.recognitionPanelVisible
  );
  const toggleRecognitionPanel = useToolbarStore(
    (state) => state.toggleRecognitionPanel
  );
  const {
    debugStatus,
    sessionId,
    taskId,
    resourcePath,
    entryNode,
    currentNode,
    currentPhase,
    recognitionTargetName,
    lastNode,
    executionStartTime,
    executionHistory,
    breakpoints,
    startDebug,
    pauseDebug,
    stopDebug,
    continueDebug,
    stepDebug,
    setBreakpoint,
    removeBreakpoint,
    clearBreakpoints,
    setConfig,
    downloadLog,
  } = useDebugStore(
    useShallow((state) => ({
      debugStatus: state.debugStatus,
      sessionId: state.sessionId,
      taskId: state.taskId,
      resourcePath: state.resourcePath,
      entryNode: state.entryNode,
      currentNode: state.currentNode,
      currentPhase: state.currentPhase,
      recognitionTargetName: state.recognitionTargetName,
      lastNode: state.lastNode,
      executionStartTime: state.executionStartTime,
      executionHistory: state.executionHistory,
      breakpoints: state.breakpoints,
      startDebug: state.startDebug,
      pauseDebug: state.pauseDebug,
      stopDebug: state.stopDebug,
      continueDebug: state.continueDebug,
      stepDebug: state.stepDebug,
      setBreakpoint: state.setBreakpoint,
      removeBreakpoint: state.removeBreakpoint,
      clearBreakpoints: state.clearBreakpoints,
      setConfig: state.setConfig,
      downloadLog: state.downloadLog,
    }))
  );

  const selectedNodes = useFlowStore((state) => state.selectedNodes);

  /**
   * 将节点 ID 转换为 pipeline 中的节点名称
   */
  const nodeIdToFullName = (nodeId: string): string | null => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const label = node.data.label;
    return prefix ? `${prefix}_${label}` : label;
  };

  // 连接成功后自动加载后端配置填充资源路径
  // 优先级:
  // 1. 优先使用 --root 参数指定的目录
  // 2. 其次使用配置文件中的 resource_dir
  // 3. 最后为空,让用户手动填写
  useEffect(() => {
    if (connectionStatus === "connected" && !resourcePath) {
      // 请求后端配置
      const success = configProtocol.requestGetConfig();
      if (!success) {
        console.warn("[DebugPanel] Failed to request backend config");
        return;
      }

      // 监听配置响应
      const unsubscribe = configProtocol.onConfigData(
        (data: ConfigResponse) => {
          if (data.success && data.config) {
            const resourcePath =
              data.config.file?.root || data.config.maafw?.resource_dir || "";

            if (resourcePath) {
              setConfig("resourcePath", resourcePath);
            } else {
              console.warn(
                "[DebugPanel] Backend config invalid or resource paths not set"
              );
            }
          } else {
            console.warn("[DebugPanel] Backend config invalid");
          }

          // 仅监听一次后取消订阅
          unsubscribe();
        }
      );
    }
  }, [connectionStatus, resourcePath, setConfig]);

  // 计算经过时间
  const [elapsedTime, setElapsedTime] = useState(0);
  useEffect(() => {
    if (debugStatus === "running" && executionStartTime) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - executionStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [debugStatus, executionStartTime]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 获取当前节点名称
  const currentNodeName = useMemo(() => {
    if (!currentNode) return null;
    const node = nodes.find((n) => n.id === currentNode);
    return node?.data.label || currentNode;
  }, [currentNode, nodes]);

  // 节点选项
  const nodeOptions = useMemo(
    () =>
      nodes.map((node) => ({
        label: node.data.label,
        value: node.id,
      })),
    [nodes]
  );

  // 调试配置 Popover 内容
  const debugConfigContent = (
    <div className={debugStyle["debug-config-form"]}>
      <div className={debugStyle["debug-config-section"]}>
        <div className={debugStyle["debug-config-section-title"]}>基础配置</div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>资源路径</div>
          <input
            type="text"
            value={resourcePath}
            onChange={(e) => setConfig("resourcePath", e.target.value)}
            placeholder="请输入资源路径"
            className={debugStyle["debug-config-input"]}
          />
        </div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>入口节点</div>
          <Select
            style={{ width: "100%" }}
            placeholder="选择入口节点"
            value={entryNode || undefined}
            onChange={(value) => setConfig("entryNode", value)}
            options={nodeOptions}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      </div>
    </div>
  );

  // 断点管理 Popover 内容
  const breakpointManagerContent = (
    <div className={debugStyle["breakpoint-manager-content"]}>
      <div className={debugStyle["breakpoint-manager-actions"]}>
        <Button
          size="small"
          disabled={selectedNodes.length === 0}
          onClick={() => {
            if (selectedNodes.length > 0) {
              setBreakpoint(selectedNodes[0].id);
              message.success("断点已设置");
            } else {
              message.error("请先选中节点");
            }
          }}
        >
          为当前节点设置断点
        </Button>
        <Button
          size="small"
          danger
          disabled={breakpoints.size === 0}
          onClick={() => {
            clearBreakpoints();
            message.success("已清除所有断点");
          }}
        >
          清除所有断点
        </Button>
      </div>
      <div className={debugStyle["breakpoint-list"]}>
        {breakpoints.size === 0 ? (
          <div className={debugStyle["breakpoint-empty"]}>
            暂无断点,请选中节点后点击"设置断点"
          </div>
        ) : (
          Array.from(breakpoints).map((nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            return (
              <div key={nodeId} className={debugStyle["breakpoint-item"]}>
                <span className={debugStyle["breakpoint-item-name"]}>
                  {node?.data.label || nodeId}
                </span>
                <Button
                  type="text"
                  size="small"
                  danger
                  className={debugStyle["breakpoint-item-remove"]}
                  onClick={() => {
                    removeBreakpoint(nodeId);
                    message.success("断点已移除");
                  }}
                >
                  删除
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // 按钮配置
  const debugButtons = [
    {
      key: "config",
      icon: "icon-tiaoshi1",
      iconSize: 30,
      label: "调试配置",
      disabled: false,
      popover: debugConfigContent,
      onClick: () => {},
    },
    {
      key: "start",
      icon: "icon-kaishi",
      iconSize: 24,
      label: "开始调试",
      disabled: debugStatus !== "idle" || connectionStatus !== "connected",
      onClick: () => {
        if (!resourcePath) {
          message.error("请先配置资源路径");
          return;
        }
        if (!entryNode) {
          message.error("请先选择入口节点");
          return;
        }
        if (!controllerId) {
          message.error("请先连接控制器");
          return;
        }

        // 调用 debugStore 更新状态
        startDebug();

        // 将节点 ID 转换为 pipeline 中的节点名称
        const entryNodeFullName = nodeIdToFullName(entryNode);
        if (!entryNodeFullName) {
          message.error("入口节点不存在");
          stopDebug();
          return;
        }

        // 将断点节点 ID 转换为 pipeline 中的节点名称
        const breakpointFullNames = Array.from(breakpoints)
          .map((id) => nodeIdToFullName(id))
          .filter((name): name is string => name !== null);

        // 发送 WebSocket 消息启动调试
        const success = debugProtocol.sendStartDebug(
          resourcePath,
          entryNodeFullName,
          controllerId,
          breakpointFullNames
        );

        if (!success) {
          message.error("启动调试失败，请检查连接状态");
          stopDebug(); // 回滚状态
        }
      },
    },
    {
      key: "pause",
      icon: "icon-zanting",
      iconSize: 30,
      label: "暂停调试（所有状态会清空）",
      disabled: debugStatus !== "running",
      onClick: () => {
        const id = sessionId || taskId;
        if (id) {
          // V2: 暂停实际上是停止
          debugProtocol.sendPauseDebug(id);
        }
      },
    },
    {
      key: "continue",
      icon: "icon-jixu",
      iconSize: 20,
      label: "继续执行（从上一个节点继续）",
      disabled: debugStatus !== "paused",
      onClick: () => {
        const id = sessionId || taskId;
        // V2: 使用 lastNode 作为 from_node
        const fromNode = lastNode || currentNode;
        if (id && fromNode) {
          // 将节点 ID 转换为 pipeline 中的节点名称
          const fromNodeFullName = nodeIdToFullName(fromNode);
          if (!fromNodeFullName) {
            message.error("当前节点不存在");
            return;
          }

          // 将断点节点 ID 转换为 pipeline 中的节点名称
          const breakpointFullNames = Array.from(breakpoints)
            .map((bpId) => nodeIdToFullName(bpId))
            .filter((name): name is string => name !== null);

          // 发送 WebSocket 消息继续调试
          debugProtocol.sendContinueDebug(
            id,
            fromNodeFullName,
            breakpointFullNames
          );
        }

        // 调用 debugStore 更新状态
        continueDebug();
        message.success("继续执行");
      },
    },
    // {
    //   key: "step",
    //   icon: "icon-jurassic_nextstep",
    //   iconSize: 20,
    //   label: "单步执行（无上下文状态保存）",
    //   disabled: debugStatus !== "paused",
    //   onClick: () => {
    //     if (taskId && currentNode) {
    //       // 将当前节点 ID 转换为 pipeline 中的节点名称
    //       const currentNodeFullName = nodeIdToFullName(currentNode);
    //       if (!currentNodeFullName) {
    //         message.error("当前节点不存在");
    //         return;
    //       }

    //       // 获取当前节点的下一个节点 ID 列表
    //       const nextNodeIds = getNextNodes(currentNode);

    //       // 将下一个节点 ID 转换为 pipeline 中的节点名称
    //       const nextNodeFullNames = nextNodeIds
    //         .map((id) => nodeIdToFullName(id))
    //         .filter((name): name is string => name !== null);

    //       // 将断点节点 ID 转换为 pipeline 中的节点名称
    //       const breakpointFullNames = Array.from(breakpoints)
    //         .map((id) => nodeIdToFullName(id))
    //         .filter((name): name is string => name !== null);

    //       // 发送 WebSocket 消息单步执行
    //       debugProtocol.sendStepDebug(
    //         taskId,
    //         currentNodeFullName,
    //         nextNodeFullNames,
    //         breakpointFullNames
    //       );
    //     }

    //     // 调用 debugStore 更新状态
    //     stepDebug();
    //   },
    // },
    {
      key: "stop",
      icon: "icon-tingzhi",
      iconSize: 20,
      label: "停止调试",
      disabled: debugStatus === "idle",
      onClick: () => {
        const id = sessionId || taskId;
        if (id) {
          // 发送 WebSocket 消息停止调试
          debugProtocol.sendStopDebug(id);
        }

        // 调用 debugStore 更新状态
        stopDebug();
        message.success("调试已停止");
      },
    },
    {
      key: "breakpoint",
      icon: "icon-duandianxufei",
      iconSize: 22,
      label: "断点管理",
      disabled: false,
      popover: breakpointManagerContent,
      onClick: () => {},
    },
    {
      key: "export",
      icon: "icon-rizhi",
      iconSize: 24,
      label: "导出日志",
      disabled: executionHistory.length === 0,
      onClick: () => {},
      menu: [
        {
          key: "export-text",
          label: "导出为文本 (.txt)",
          onClick: () => {
            downloadLog("text");
            message.success("日志已导出为文本文件");
          },
        },
        {
          key: "icon-JSON",
          label: "导出为 JSON (.json)",
          onClick: () => {
            downloadLog("json");
            message.success("日志已导出为 JSON 文件");
          },
        },
      ],
    },
    {
      key: "recognition-panel",
      icon: "icon-tiaoshijilu",
      iconSize: 22,
      label: recognitionPanelVisible ? "隐藏识别记录" : "显示识别记录",
      disabled: false,
      active: recognitionPanelVisible,
      onClick: () => {
        toggleRecognitionPanel();
      },
    },
  ];

  // 状态标签配置
  // 根据 Pipeline 执行流程:
  // - 识别中: 当前节点正在识别 next 列表中的目标节点
  // - 执行中: 当前节点正在执行动作
  const getRunningStatusText = () => {
    if (currentPhase === "recognition") {
      // 识别阶段，显示正在识别的目标节点
      if (recognitionTargetName) {
        return `识别中: ${recognitionTargetName}`;
      }
      return "识别中";
    } else if (currentPhase === "action") {
      return "执行中";
    }
    return "运行中";
  };

  const statusTagConfig = {
    idle: { text: "空闲", color: "default" },
    preparing: { text: "准备中", color: "processing" },
    running: {
      text: getRunningStatusText(),
      color: "processing",
    },
    paused: { text: "已暂停", color: "warning" },
    completed: { text: "已完成", color: "success" },
  };

  return (
    <ul
      className={classNames(
        style.panel,
        style["h-panel"],
        style["debug-panel"]
      )}
    >
      {debugButtons.map((btn, index) => (
        <div key={btn.key} className={style.group}>
          <li className={style.item}>
            {btn.popover ? (
              <Popover
                content={btn.popover}
                title={btn.label}
                trigger={btn.disabled ? [] : "click"}
                placement="bottomRight"
                overlayStyle={{ borderRadius: "8px" }}
              >
                <Tooltip title={btn.label}>
                  <IconFont
                    style={{
                      opacity: btn.disabled ? 0.2 : 1,
                      cursor: btn.disabled ? "not-allowed" : "pointer",
                    }}
                    className={style.icon}
                    name={btn.icon as IconNames}
                    size={btn.iconSize || 20}
                  />
                </Tooltip>
              </Popover>
            ) : btn.menu ? (
              <Dropdown
                menu={{
                  items: btn.menu.map((item) => ({
                    key: item.key,
                    label: item.label,
                    onClick: item.onClick,
                  })),
                }}
                disabled={btn.disabled}
                trigger={["click"]}
                placement="bottomRight"
              >
                <Tooltip title={btn.label}>
                  <IconFont
                    style={{
                      opacity: btn.disabled ? 0.2 : 1,
                      cursor: btn.disabled ? "not-allowed" : "pointer",
                    }}
                    className={style.icon}
                    name={btn.icon as IconNames}
                    size={btn.iconSize || 20}
                  />
                </Tooltip>
              </Dropdown>
            ) : (
              <Tooltip title={btn.label}>
                <IconFont
                  style={{
                    opacity: btn.disabled
                      ? 0.2
                      : (btn as any).active !== undefined
                      ? (btn as any).active
                        ? 1
                        : 0.4
                      : 1,
                    cursor: btn.disabled ? "not-allowed" : "pointer",
                  }}
                  className={style.icon}
                  name={btn.icon as IconNames}
                  size={btn.iconSize || 20}
                  onClick={(e) => {
                    if (!btn.disabled) {
                      btn.onClick();
                    }
                  }}
                />
              </Tooltip>
            )}
          </li>
          {(index === 0 || index === 5 || index === 7) && (
            <div className={style.devider}>
              <div></div>
            </div>
          )}
        </div>
      ))}
      {/* 状态信息区域 */}
      <div
        className={classNames(style.group, debugStyle["debug-status-group"])}
      >
        <div className={debugStyle["debug-status-area"]}>
          <Tag
            className={debugStyle["debug-status-tag"]}
            color={statusTagConfig[debugStatus].color}
          >
            {statusTagConfig[debugStatus].text}
          </Tag>
          {debugStatus === "running" && (
            <span className={debugStyle["debug-elapsed-time"]}>
              {formatTime(elapsedTime)}
            </span>
          )}
        </div>
      </div>
    </ul>
  );
}

export default memo(DebugPanel);
