import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Input, Modal } from "antd";
import classNames from "classnames";
import style from "../../../styles/NodeAddPanel.module.less";
import IconFont from "../../iconfonts";
import type { IconNames } from "../../iconfonts";
import {
  nodeTemplates,
  type NodeTemplateType,
} from "../../../data/nodeTemplates";
import { useFlowStore } from "../../../stores/flow";
import { useCustomTemplateStore } from "../../../stores/customTemplateStore";
import { NodeTypeEnum } from "../../flow/nodes";
import {
  getRecognitionIcon,
  getActionIcon,
  getNodeTypeIcon,
} from "../../flow/nodes/utils";

interface NodeAddPanelProps {
  visible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReopen?: (screenPos: { x: number; y: number }) => void;
  flowPosition?: { x: number; y: number };
}

// 格式化参数值为可读字符串
function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return value === "" ? '""' : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.length <= 4 && value.every((v) => typeof v !== "object")) {
      return `[${value.map((v) => formatParamValue(v)).join(", ")}]`;
    }
    return `[...${value.length}项]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return `{...${keys.length}项}`;
  }
  return String(value);
}

// 获取模板描述
function getTemplateDescription(template: NodeTemplateType): string {
  const data = template.data?.();
  if (!data) {
    if (template.nodeType === NodeTypeEnum.External) return "引用外部节点";
    if (template.nodeType === NodeTypeEnum.Anchor) return "重定向到其他节点";
    return "空白节点模板";
  }

  const parts: string[] = [];
  if (data.recognition?.type) {
    parts.push(`识别: ${data.recognition.type}`);
  }
  if (data.action?.type) {
    parts.push(`动作: ${data.action.type}`);
  }
  return parts.join(" | ") || "自定义节点";
}

// 节点预览组件
const NodePreview = memo(
  ({ template }: { template: NodeTemplateType | null }) => {
    if (!template) {
      return <div className={style.emptyPreview}>选择一个模板以预览</div>;
    }

    const data = template.data?.();
    const nodeType = template.nodeType ?? NodeTypeEnum.Pipeline;

    // 特殊节点类型
    if (nodeType === NodeTypeEnum.External) {
      return (
        <div
          className={style.previewNode}
          style={{ backgroundColor: "#918fbe" }}
        >
          <div
            className={style.previewHeader}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderBottom: "none",
            }}
          >
            <div className={style.headerTitle} style={{ color: "#fff" }}>
              {template.label}
            </div>
          </div>
        </div>
      );
    }

    if (nodeType === NodeTypeEnum.Anchor) {
      return (
        <div
          className={style.previewNode}
          style={{ backgroundColor: "#4a9d8e" }}
        >
          <div
            className={style.previewHeader}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderBottom: "none",
            }}
          >
            <div className={style.headerTitle} style={{ color: "#fff" }}>
              {template.label}
            </div>
          </div>
        </div>
      );
    }

    // Pipeline 节点
    const recoType = data?.recognition?.type ?? "DirectHit";
    const actionType = data?.action?.type ?? "DoNothing";
    const recoIconConfig = getRecognitionIcon(recoType);
    const actionIconConfig = getActionIcon(actionType);
    const nodeTypeIconConfig = getNodeTypeIcon("pipeline");

    const hasRecoParams =
      data?.recognition?.param &&
      Object.keys(data.recognition.param).length > 0;
    const hasActionParams =
      data?.action?.param && Object.keys(data.action.param).length > 0;
    const hasOtherParams = data?.others && Object.keys(data.others).length > 0;

    return (
      <div className={style.previewNode}>
        <div className={style.previewHeader}>
          <div className={style.headerLeft}>
            <span title="Pipeline节点">
              <IconFont
                className={style.typeIcon}
                name={nodeTypeIconConfig.name}
                size={nodeTypeIconConfig.size}
              />
            </span>
          </div>
          <div className={style.headerTitle}>{template.label}</div>
          <div className={style.headerRight}>
            <div className={style.moreBtn}>
              <IconFont name="icon-gengduo" size={14} />
            </div>
          </div>
        </div>
        <div className={style.previewContent}>
          {/* 识别区域 */}
          <div className={style.section}>
            <div className={classNames(style.sectionHeader, style.recoHeader)}>
              {recoIconConfig.name && (
                <IconFont
                  name={recoIconConfig.name}
                  size={recoIconConfig.size}
                />
              )}
              <span>识别 - {recoType}</span>
            </div>
            {hasRecoParams && (
              <div className={style.paramList}>
                {Object.entries(data.recognition.param).map(([key, value]) => (
                  <div key={key} className={style.paramItem}>
                    <span className={style.paramKey}>{key}:</span>
                    <span className={style.paramValue}>
                      {formatParamValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 动作区域 */}
          <div className={style.section}>
            <div
              className={classNames(style.sectionHeader, style.actionHeader)}
            >
              {actionIconConfig.name && (
                <IconFont
                  name={actionIconConfig.name}
                  size={actionIconConfig.size}
                />
              )}
              <span>动作 - {actionType}</span>
            </div>
            {hasActionParams && (
              <div className={style.paramList}>
                {Object.entries(data.action.param).map(([key, value]) => (
                  <div key={key} className={style.paramItem}>
                    <span className={style.paramKey}>{key}:</span>
                    <span className={style.paramValue}>
                      {formatParamValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 其他区域 */}
          {hasOtherParams && (
            <div className={style.section}>
              <div
                className={classNames(style.sectionHeader, style.otherHeader)}
              >
                <IconFont name="icon-zidingyi" size={10} />
                <span>其他</span>
              </div>
              <div className={style.paramList}>
                {Object.entries(data.others).map(([key, value]) => (
                  <div key={key} className={style.paramItem}>
                    <span className={style.paramKey}>{key}:</span>
                    <span className={style.paramValue}>
                      {formatParamValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

// 主组件
function NodeAddPanel({
  visible,
  position,
  onClose,
  onReopen,
  flowPosition,
}: NodeAddPanelProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const inputRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const addNode = useFlowStore((state) => state.addNode);
  const customTemplates = useCustomTemplateStore(
    (state) => state.customTemplates
  );
  const getAllTemplates = useCustomTemplateStore(
    (state) => state.getAllTemplates
  );
  const removeTemplate = useCustomTemplateStore(
    (state) => state.removeTemplate
  );

  // 获取所有模板
  const allTemplates = useMemo(
    () => getAllTemplates(nodeTemplates),
    [getAllTemplates, customTemplates]
  );

  // 过滤模板
  const filteredTemplates = useMemo(() => {
    if (!searchText.trim()) return allTemplates;
    const keyword = searchText.toLowerCase();
    return allTemplates.filter((t) => t.label.toLowerCase().includes(keyword));
  }, [searchText, allTemplates]);

  // 当前选中的模板
  const selectedTemplate = filteredTemplates[selectedIndex] || null;

  // 添加节点
  const handleAddNode = useCallback(
    (template: NodeTemplateType) => {
      addNode({
        type: template.nodeType ?? NodeTypeEnum.Pipeline,
        data: template.data?.(),
        position: flowPosition,
        select: true,
        focus: !flowPosition,
        link: false,
      });
      onClose();
    },
    [addNode, flowPosition, onClose]
  );

  // 删除自定义模板
  const handleDeleteTemplate = useCallback(
    (e: React.MouseEvent, template: NodeTemplateType) => {
      e.stopPropagation();
      if (!template.isCustom) return;

      Modal.confirm({
        title: "删除自定义模板",
        content: `确定要删除模板“${template.label}”吗？此操作不可恢复。`,
        okText: "确定",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => {
          removeTemplate(template.label);
        },
      });
    },
    [removeTemplate]
  );

  // 键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredTemplates.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedTemplate) {
            handleAddNode(selectedTemplate);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredTemplates.length, selectedTemplate, handleAddNode, onClose]
  );

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // 搜索文本变化时重置选中项
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchText]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [visible]);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setSearchText("");
      setSelectedIndex(0);
    }
  }, [visible]);

  // 获取画布容器的实际宽度
  const containerWidth = useFlowStore.getState().size.width;

  if (!visible) return null;

  // 计算面板位置，避免超出视口
  const panelWidth = 520;
  const panelHeight = 420;
  // 使用容器实际宽度作为可用宽度
  const availableWidth = containerWidth || window.innerWidth;

  // 判断面板是否应该显示在鼠标左侧
  const shouldPlaceOnLeft = position.x + panelWidth > availableWidth;

  // 面板位置
  const panelStyle: React.CSSProperties = {
    left: Math.min(
      Math.max(shouldPlaceOnLeft ? position.x - panelWidth : position.x, 10),
      availableWidth - panelWidth - 10
    ),
    top: Math.min(
      Math.max(position.y, 10),
      window.innerHeight - panelHeight - 10
    ),
  };

  // 预览区域位置
  const useReversedLayout = !shouldPlaceOnLeft;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={style.overlay}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          // 在新位置重新打开
          if (onReopen) {
            onReopen({ x: e.clientX, y: e.clientY });
          } else {
            onClose();
          }
        }}
      />

      {/* 面板 */}
      <div
        className={classNames(style.panel, {
          [style.reversed]: useReversedLayout,
        })}
        style={panelStyle}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 左侧预览 */}
        <div className={style.previewSection}>
          <div className={style.previewTitle}>节点预览</div>
          <div className={style.previewContainer}>
            <NodePreview template={selectedTemplate} />
          </div>
        </div>

        {/* 右侧列表 */}
        <div className={style.listSection}>
          {/* 搜索框 */}
          <div className={style.searchBox}>
            <Input
              ref={inputRef}
              placeholder="搜索节点模板..."
              prefix={
                <IconFont
                  name="icon-AIsousuo1"
                  size={16}
                  style={{ color: "#999" }}
                />
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>

          {/* 模板列表 */}
          <div className={style.templateList} ref={listRef}>
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((template, index) => (
                <div
                  key={`${template.label}-${
                    template.isCustom ? "custom" : "preset"
                  }`}
                  className={classNames(style.templateItem, {
                    [style.active]: index === selectedIndex,
                    [style.customTemplate]: template.isCustom,
                  })}
                  onClick={() => handleAddNode(template)}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setHoveredIndex(index);
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className={style.templateIcon}>
                    <IconFont
                      name={template.iconName as IconNames}
                      size={template.iconSize ?? 24}
                    />
                  </div>
                  <div className={style.templateInfo}>
                    <div className={style.templateName}>
                      {template.label}
                      {template.isCustom && (
                        <span className={style.customBadge}>自定义</span>
                      )}
                    </div>
                    <div className={style.templateDesc}>
                      {getTemplateDescription(template)}
                    </div>
                  </div>
                  {template.isCustom ? (
                    hoveredIndex === index ? (
                      <div
                        className={style.deleteBtn}
                        onClick={(e) => handleDeleteTemplate(e, template)}
                        title="删除模板"
                      >
                        <IconFont
                          name="icon-shanchu"
                          size={16}
                          color="#ff4a4a"
                        />
                      </div>
                    ) : null
                  ) : null}
                </div>
              ))
            ) : (
              <div className={style.emptyList}>
                <IconFont
                  name="icon-AIsousuo1"
                  size={48}
                  className={style.emptyIcon}
                />
                <div className={style.emptyText}>未找到匹配的模板</div>
              </div>
            )}
          </div>

          {/* 快捷键提示 */}
          <div className={style.shortcutHint}>
            <div className={style.hintItem}>
              <kbd>↑</kbd>
              <kbd>↓</kbd> 选择
            </div>
            <div className={style.hintItem}>
              <kbd>Enter</kbd> 添加
            </div>
            <div className={style.hintItem}>
              <kbd>Esc</kbd> 关闭
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(NodeAddPanel);
