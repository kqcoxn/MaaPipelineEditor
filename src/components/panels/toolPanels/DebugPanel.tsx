import { memo, useMemo, useState } from "react";
import { message, Select, Tag, Button, Dropdown, Tooltip, Popover } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useDebugStore } from "../../../stores/debugStore";
import { useMFWStore } from "../../../stores/mfwStore";
import { debugProtocol } from "../../../services/server";
import { useShallow } from "zustand/shallow";
import style from "../../../styles/ToolPanel.module.less";
import debugStyle from "../../../styles/DebugPanel.module.less";

/** 调试工具栏 */
function DebugPanel() {
  const nodes = useFlowStore((state) => state.nodes);
  const connectionStatus = useMFWStore((state) => state.connectionStatus);
  const controllerId = useMFWStore((state) => state.controllerId);
  const {
    debugStatus,
    taskId,
    resourcePath,
    entryNode,
    screenshotMode,
    logLevel,
    currentNode,
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
      taskId: state.taskId,
      resourcePath: state.resourcePath,
      entryNode: state.entryNode,
      screenshotMode: state.screenshotMode,
      logLevel: state.logLevel,
      currentNode: state.currentNode,
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

  // 计算经过时间
  const [elapsedTime, setElapsedTime] = useState(0);
  useMemo(() => {
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
      <div className={debugStyle["debug-config-section"]}>
        <div className={debugStyle["debug-config-section-title"]}>高级选项</div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>截图模式</div>
          <Select
            style={{ width: "100%" }}
            value={screenshotMode}
            onChange={(value) => setConfig("screenshotMode", value)}
            options={[
              { label: "全程截图", value: "all" },
              { label: "仅断点截图", value: "breakpoint" },
              { label: "不截图", value: "none" },
            ]}
          />
        </div>
        <div className={debugStyle["debug-config-field"]}>
          <div className={debugStyle["debug-config-field-label"]}>日志级别</div>
          <Select
            style={{ width: "100%" }}
            value={logLevel}
            onChange={(value) => setConfig("logLevel", value)}
            options={[
              { label: "详细", value: "verbose" },
              { label: "普通", value: "normal" },
              { label: "仅错误", value: "error" },
            ]}
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

        // 发送 WebSocket 消息启动调试
        const success = debugProtocol.sendStartDebug(
          resourcePath,
          entryNode,
          controllerId
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
      label: "暂停调试",
      disabled: debugStatus !== "running",
      onClick: () => {
        if (taskId) {
          // 发送 WebSocket 消息暂停调试
          debugProtocol.sendPauseDebug(taskId);
        }

        // 调用 debugStore 更新状态
        pauseDebug();
        message.success("调试已暂停");
      },
    },
    {
      key: "continue",
      icon: "icon-jixu",
      iconSize: 20,
      label: "继续执行",
      disabled: debugStatus !== "paused",
      onClick: () => {
        if (taskId) {
          // 发送 WebSocket 消息继续调试
          debugProtocol.sendContinueDebug(taskId);
        }

        // 调用 debugStore 更新状态
        continueDebug();
        message.success("继续执行");
      },
    },
    {
      key: "step",
      icon: "icon-jurassic_nextstep",
      iconSize: 20,
      label: "单步执行",
      disabled: debugStatus !== "paused",
      onClick: () => {
        if (taskId) {
          // 发送 WebSocket 消息单步执行
          debugProtocol.sendStepDebug(taskId);
        }

        // 调用 debugStore 更新状态
        stepDebug();
      },
    },
    {
      key: "stop",
      icon: "icon-tingzhi",
      iconSize: 20,
      label: "停止调试",
      disabled: debugStatus === "idle",
      onClick: () => {
        if (taskId) {
          // 发送 WebSocket 消息停止调试
          debugProtocol.sendStopDebug(taskId);
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
  ];

  // 状态标签配置
  const statusTagConfig = {
    idle: { text: "空闲", color: "default" },
    preparing: { text: "准备中", color: "processing" },
    running: { text: "运行中", color: "processing" },
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
                trigger="click"
                placement="bottomRight"
                overlayStyle={{ borderRadius: "8px" }}
              >
                <Tooltip title={btn.label}>
                  <IconFont
                    style={{ opacity: btn.disabled ? 0.2 : 1 }}
                    className={style.icon}
                    name={btn.icon as IconNames}
                    size={btn.iconSize || 20}
                    onClick={btn.onClick}
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
                    style={{ opacity: btn.disabled ? 0.2 : 1 }}
                    className={style.icon}
                    name={btn.icon as IconNames}
                    size={btn.iconSize || 20}
                  />
                </Tooltip>
              </Dropdown>
            ) : (
              <Tooltip title={btn.label}>
                <IconFont
                  style={{ opacity: btn.disabled ? 0.2 : 1 }}
                  className={style.icon}
                  name={btn.icon as IconNames}
                  size={btn.iconSize || 20}
                  onClick={btn.onClick}
                />
              </Tooltip>
            )}
          </li>
          {(index === 0 || index === 5) && (
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
          {currentNodeName && (
            <span className={debugStyle["debug-current-node"]}>
              {currentNodeName}
            </span>
          )}
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
