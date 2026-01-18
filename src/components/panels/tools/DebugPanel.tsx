import { memo, useMemo, useState, useEffect } from "react";
import { message, Select, Tag, Button, Tooltip, Popover, Switch } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useDebugStore } from "../../../stores/debugStore";
import { useMFWStore } from "../../../stores/mfwStore";
import { useFileStore } from "../../../stores/fileStore";
import { useToolbarStore } from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import {
  debugProtocol,
  configProtocol,
  mfwProtocol,
} from "../../../services/server";
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
  const saveFilesBeforeDebug = useConfigStore(
    (state) => state.configs.saveFilesBeforeDebug
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const {
    debugStatus,
    sessionId,
    resourcePaths,
    entryNode,
    currentNode,
    currentPhase,
    recognitionTargetName,
    lastNode,
    executionStartTime,
    executionHistory,
    agentIdentifier,
    startDebug,
    stopDebug,
    setConfig: setDebugConfig,
    addResourcePath,
    removeResourcePath,
    updateResourcePath,
  } = useDebugStore(
    useShallow((state) => ({
      debugStatus: state.debugStatus,
      sessionId: state.sessionId,
      resourcePaths: state.resourcePaths,
      entryNode: state.entryNode,
      currentNode: state.currentNode,
      currentPhase: state.currentPhase,
      recognitionTargetName: state.recognitionTargetName,
      lastNode: state.lastNode,
      executionStartTime: state.executionStartTime,
      executionHistory: state.executionHistory,
      agentIdentifier: state.agentIdentifier,
      startDebug: state.startDebug,
      stopDebug: state.stopDebug,
      setConfig: state.setConfig,
      addResourcePath: state.addResourcePath,
      removeResourcePath: state.removeResourcePath,
      updateResourcePath: state.updateResourcePath,
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
  useEffect(() => {
    const needsFill =
      resourcePaths.length === 0 ||
      (resourcePaths.length === 1 && resourcePaths[0] === "");

    if (connectionStatus === "connected" && needsFill) {
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
              updateResourcePath(0, resourcePath);
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
  }, [connectionStatus, resourcePaths, updateResourcePath]);

  // 监听打开日志结果
  useEffect(() => {
    const unsubscribe = mfwProtocol.onLogOpened((data) => {
      if (data.success) {
        message.success(`日志文件已打开：${data.path || ""}`);
      } else {
        message.error(data.message || "打开日志文件失败");
      }
    });

    return () => unsubscribe();
  }, []);

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
          <div className={debugStyle["debug-config-field-label"]}>
            资源路径
            <span style={{ color: "#999", fontSize: 11, marginLeft: 4 }}>
              (多路径后面覆盖前面)
            </span>
          </div>
          <div className={debugStyle["debug-config-paths"]}>
            {resourcePaths.map((path, index) => (
              <div key={index} className={debugStyle["debug-config-path-item"]}>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => updateResourcePath(index, e.target.value)}
                  placeholder={`资源路径 ${index + 1}`}
                  className={debugStyle["debug-config-input"]}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeResourcePath(index)}
                  disabled={resourcePaths.length <= 1}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ))}
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => addResourcePath("")}
              style={{ width: "100%" }}
            >
              添加资源路径
            </Button>
          </div>
        </div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>
            Agent 标识符
            <span style={{ color: "#999", fontSize: 11, marginLeft: 4 }}>
              (可选)
            </span>
          </div>
          <input
            type="text"
            value={agentIdentifier}
            onChange={(e) => setDebugConfig("agentIdentifier", e.target.value)}
            placeholder="留空则不连接 Agent"
            className={debugStyle["debug-config-input"]}
          />
        </div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>入口节点</div>
          <Select
            style={{ width: "100%" }}
            placeholder="选择入口节点"
            value={entryNode || undefined}
            onChange={(value) => setDebugConfig("entryNode", value)}
            options={nodeOptions}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      </div>
      <div className={debugStyle["debug-config-section"]}>
        <div className={debugStyle["debug-config-section-title"]}>调试设置</div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-row"]}>
            <div className={debugStyle["debug-config-field-label"]}>
              调试前保存所有文件
            </div>
            <Switch
              checked={saveFilesBeforeDebug}
              onChange={(checked) => setConfig("saveFilesBeforeDebug", checked)}
            />
          </div>
          <div className={debugStyle["debug-config-field-tip"]}>
            自动保存当前 tab 栏中所有文件到本地
          </div>
        </div>
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
      onClick: async () => {
        // 过滤空路径
        const validPaths = resourcePaths.filter((p) => p.trim() !== "");
        if (validPaths.length === 0) {
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

        // 检查状态并保存文件
        const canContinue = await startDebug();
        if (!canContinue) {
          return;
        }

        // 将节点 ID 转换为 pipeline 中的节点名称
        const entryNodeFullName = nodeIdToFullName(entryNode);
        if (!entryNodeFullName) {
          message.error("入口节点不存在");
          stopDebug();
          return;
        }

        // 发送 WebSocket 消息启动调试
        const success = debugProtocol.sendStartDebug(
          validPaths,
          entryNodeFullName,
          controllerId,
          [],
          agentIdentifier || undefined
        );

        if (!success) {
          message.error("启动调试失败，请检查连接状态");
          stopDebug(); // 回滚状态
        }
      },
    },
    {
      key: "stop",
      icon: "icon-tingzhi",
      iconSize: 20,
      label: "停止调试",
      disabled: debugStatus === "idle",
      onClick: () => {
        const id = sessionId;
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
      key: "open-log",
      icon: "icon-rizhi",
      iconSize: 24,
      label: "打开日志",
      disabled: false,
      onClick: () => {
        // 调用后端 API 打开 maa.log
        const success = mfwProtocol.requestOpenLog();
        if (!success) {
          message.error("发送请求失败，请检查连接状态");
        }
      },
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
          {(index === 0 || index === 2) && (
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
