/**
 * 节点预览 Popover 组件
 * 在 hover 节点列表项时显示节点详细信息预览
 */

import { memo, useState, useEffect, useMemo } from "react";
import { Popover, Image, Spin } from "antd";
import { useLocalFileStore } from "../../../../stores/localFileStore";
import { resourceProtocol } from "../../../../services/server";
import { useWSStore } from "../../../../stores/wsStore";
import { NodeTypeEnum } from "../../../flow/nodes/constants";
import {
  getRecognitionIcon,
  getActionIcon,
  getNodeTypeIcon,
} from "../../../flow/nodes/utils";
import IconFont, { type IconNames } from "../../../iconfonts";
import type { NodeListItemInfo } from "./types";
import style from "./NodeListPanel.module.less";

interface NodePreviewPopoverProps {
  node: NodeListItemInfo;
  children: React.ReactNode;
}

/** 格式化参数值显示 */
const formatParamValue = (value: any, maxLength = 30): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.length === 1) return formatParamValue(value[0], maxLength);
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, maxLength) + "...";
  }
  return String(value);
};

/** 节点预览内容组件 */
const NodePreviewContent = memo(({ node }: { node: NodeListItemInfo }) => {
  const connected = useWSStore((state) => state.connected);
  const imageCache = useLocalFileStore((state) => state.imageCache);
  const pendingImageRequests = useLocalFileStore((state) => state.pendingImageRequests);

  // 节点类型图标
  const nodeTypeIconConfig = useMemo(() => {
    if (node.nodeType === NodeTypeEnum.External) {
      return { name: "icon-lianjie" as IconNames, size: 16 };
    }
    if (node.nodeType === NodeTypeEnum.Anchor) {
      return { name: "icon-a-11maodian2" as IconNames, size: 16 };
    }
    return getNodeTypeIcon("pipeline");
  }, [node.nodeType]);

  // 识别和动作图标
  const recoIconConfig = useMemo(
    () => getRecognitionIcon(node.recognitionType || "DirectHit"),
    [node.recognitionType]
  );
  const actionIconConfig = useMemo(
    () => getActionIcon(node.actionType || "DoNothing"),
    [node.actionType]
  );

  // 模板图片
  const templatePaths = node.templatePaths || [];
  const validPaths = templatePaths.filter((p) => p && p.trim());

  // 请求图片
  useEffect(() => {
    if (connected && validPaths.length > 0) {
      validPaths.forEach((path) => {
        if (!imageCache.has(path) && !pendingImageRequests.has(path)) {
          resourceProtocol.requestImage(path);
        }
      });
    }
  }, [connected, validPaths, imageCache, pendingImageRequests]);

  // 渲染模板图片
  const renderTemplateImages = () => {
    if (validPaths.length === 0) return null;

    return (
      <div className={style["preview-images"]}>
        {validPaths.map((path, index) => {
          const cached = imageCache.get(path);
          const isPending = pendingImageRequests.has(path);

          if (isPending) {
            return (
              <div key={path} className={style["preview-image-loading"]}>
                <Spin size="small" />
              </div>
            );
          }

          if (!cached) {
            return (
              <div key={path} className={style["preview-image-placeholder"]}>
                ?
              </div>
            );
          }

          const { base64, mimeType, width, height } = cached;
          const displayHeight = 40;
          const displayWidth = Math.round((width / height) * displayHeight);

          return (
            <Image
              key={path}
              src={`data:${mimeType};base64,${base64}`}
              alt={path}
              width={Math.min(displayWidth, 60)}
              height={displayHeight}
              style={{ objectFit: "contain", borderRadius: 2 }}
              preview={false}
            />
          );
        })}
      </div>
    );
  };

  // 外部节点
  if (node.nodeType === NodeTypeEnum.External) {
    return (
      <div className={style["node-preview"]} style={{ backgroundColor: "#918fbe" }}>
        <div className={style["preview-header"]} style={{ borderBottom: "none" }}>
          <IconFont name={nodeTypeIconConfig.name} size={16} style={{ marginRight: 6 }} />
          <span className={style["preview-label"]}>{node.label}</span>
        </div>
        <div className={style["preview-info"]}>外部引用节点</div>
      </div>
    );
  }

  // 锚点节点
  if (node.nodeType === NodeTypeEnum.Anchor) {
    return (
      <div className={style["node-preview"]} style={{ backgroundColor: "#4a9d8e" }}>
        <div className={style["preview-header"]} style={{ borderBottom: "none" }}>
          <IconFont name={nodeTypeIconConfig.name} size={16} style={{ marginRight: 6 }} />
          <span className={style["preview-label"]}>{node.label}</span>
        </div>
        <div className={style["preview-info"]}>重定向节点</div>
      </div>
    );
  }

  // 便签节点
  if (node.nodeType === NodeTypeEnum.Sticker) {
    return (
      <div
        className={style["node-preview"]}
        style={{ backgroundColor: "#fff9c4", borderColor: "#f9e066", borderWidth: 1, borderStyle: "solid" }}
      >
        <div className={style["preview-header"]} style={{ backgroundColor: "#f9e066", borderBottom: "none" }}>
          <span className={style["preview-label"]}>{node.label}</span>
        </div>
        <div className={style["preview-info"]}>便签贴纸</div>
      </div>
    );
  }

  // 分组节点
  if (node.nodeType === NodeTypeEnum.Group) {
    return (
      <div className={style["node-preview"]}>
        <div className={style["preview-header"]}>
          <IconFont name="icon-kuangxuanzhong" size={16} style={{ marginRight: 6 }} />
          <span className={style["preview-label"]}>{node.label}</span>
        </div>
        <div className={style["preview-info"]}>分组框</div>
      </div>
    );
  }

  // Pipeline 节点
  const hasRecoParams = node.recognitionParam && Object.keys(node.recognitionParam).length > 0;
  const hasActionParams = node.actionParam && Object.keys(node.actionParam).length > 0;
  const hasOthers = node.others && Object.keys(node.others).length > 0;

  return (
    <div className={style["node-preview"]}>
      <div className={style["preview-header"]}>
        <IconFont name={nodeTypeIconConfig.name} size={nodeTypeIconConfig.size} style={{ marginRight: 6 }} />
        <span className={style["preview-label"]}>{node.label}</span>
      </div>

      {/* 模板图片 */}
      {renderTemplateImages()}

      {/* 识别区域 */}
      <div className={style["preview-section"]}>
        <div className={style["section-header"]}>
          {recoIconConfig.name && (
            <IconFont name={recoIconConfig.name} size={recoIconConfig.size} />
          )}
          <span>识别 - {node.recognitionType || "DirectHit"}</span>
        </div>
        {hasRecoParams && (
          <div className={style["param-list"]}>
            {Object.entries(node.recognitionParam!).slice(0, 3).map(([key, value]) => (
              <div key={key} className={style["param-item"]}>
                <span className={style["param-key"]}>{key}:</span>
                <span className={style["param-value"]}>{formatParamValue(value)}</span>
              </div>
            ))}
            {Object.keys(node.recognitionParam!).length > 3 && (
              <div className={style["param-more"]}>+{Object.keys(node.recognitionParam!).length - 3} more</div>
            )}
          </div>
        )}
      </div>

      {/* 动作区域 */}
      <div className={style["preview-section"]}>
        <div className={style["section-header"]}>
          {actionIconConfig.name && (
            <IconFont name={actionIconConfig.name} size={actionIconConfig.size} />
          )}
          <span>动作 - {node.actionType || "DoNothing"}</span>
        </div>
        {hasActionParams && (
          <div className={style["param-list"]}>
            {Object.entries(node.actionParam!).slice(0, 3).map(([key, value]) => (
              <div key={key} className={style["param-item"]}>
                <span className={style["param-key"]}>{key}:</span>
                <span className={style["param-value"]}>{formatParamValue(value)}</span>
              </div>
            ))}
            {Object.keys(node.actionParam!).length > 3 && (
              <div className={style["param-more"]}>+{Object.keys(node.actionParam!).length - 3} more</div>
            )}
          </div>
        )}
      </div>

      {/* 其他参数 */}
      {hasOthers && (
        <div className={style["preview-section"]}>
          <div className={style["section-header"]}>
            <IconFont name="icon-gengduo" size={12} />
            <span>其他参数</span>
          </div>
          <div className={style["param-list"]}>
            {Object.entries(node.others!).slice(0, 2).map(([key, value]) => (
              <div key={key} className={style["param-item"]}>
                <span className={style["param-key"]}>{key}:</span>
                <span className={style["param-value"]}>{formatParamValue(value)}</span>
              </div>
            ))}
            {Object.keys(node.others!).length > 2 && (
              <div className={style["param-more"]}>+{Object.keys(node.others!).length - 2} more</div>
            )}
          </div>
        </div>
      )}

      {/* 连接信息 */}
      <div className={style["preview-edges"]}>
        <span>入边: {node.inEdgeCount}</span>
        <span>出边: {node.outEdgeCount}</span>
      </div>
    </div>
  );
});

NodePreviewContent.displayName = "NodePreviewContent";

/** 节点预览 Popover */
export const NodePreviewPopover = memo(
  ({ node, children }: NodePreviewPopoverProps) => {
    const [open, setOpen] = useState(false);

    return (
      <Popover
        content={<NodePreviewContent node={node} />}
        trigger="hover"
        placement="left"
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.1}
        open={open}
        onOpenChange={setOpen}
        overlayStyle={{
          maxWidth: 280,
          position: "fixed",
        }}
        overlayInnerStyle={{
          padding: 0,
        }}
        align={{
          overflow: { adjustX: true, adjustY: true },
        }}
        destroyTooltipOnHide
      >
        {children}
      </Popover>
    );
  }
);

NodePreviewPopover.displayName = "NodePreviewPopover";
