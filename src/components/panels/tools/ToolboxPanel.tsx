import { memo, useState, useCallback } from "react";
import { message, Tooltip, Button } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useMFWStore } from "../../../stores/mfwStore";
import {
  ROIModal,
  ROIOffsetModal,
  OCRModal,
  TemplateModal,
  ColorModal,
  DeltaModal,
} from "../../modals";
import style from "../../../styles/ToolboxPanel.module.less";

// 工具配置类型
interface ToolConfig {
  key: string;
  label: string;
  icon: IconNames;
  iconSize?: number;
  modalType: "ocr" | "template" | "color" | "roi" | "roi_offset" | "delta";
}

// 工具列表配置
const TOOLBOX_TOOLS: ToolConfig[] = [
  {
    key: "ocr",
    label: "OCR 文字识别",
    icon: "icon-ocr1",
    iconSize: 22,
    modalType: "ocr",
  },
  {
    key: "template",
    label: "模板截图",
    icon: "icon-jietu",
    iconSize: 22,
    modalType: "template",
  },
  {
    key: "color",
    label: "颜色取点",
    icon: "icon-ic_quseqi",
    iconSize: 22,
    modalType: "color",
  },
  {
    key: "roi",
    label: "区域选择",
    icon: "icon-kuangxuanzhong",
    iconSize: 22,
    modalType: "roi",
  },
  {
    key: "roi_offset",
    label: "偏移测量",
    icon: "icon-celiang1",
    iconSize: 22,
    modalType: "roi_offset",
  },
  {
    key: "delta",
    label: "位移差值 (dx/dy)",
    icon: "icon-celiang2",
    iconSize: 22,
    modalType: "delta",
  },
];

// 结果类型
type ToolResult =
  | { type: "ocr"; text: string; roi?: [number, number, number, number] }
  | {
      type: "template";
      path: string;
      greenMask: boolean;
      roi?: [number, number, number, number];
    }
  | { type: "color"; color: [number, number, number] | [number] }
  | { type: "roi"; roi: [number, number, number, number] }
  | { type: "roi_offset"; offset: [number, number, number, number] }
  | { type: "dx"; delta: number }
  | { type: "dy"; delta: number };

function ToolboxPanel() {
  const { connectionStatus } = useMFWStore();

  // Modal 状态
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [roiModalOpen, setRoiModalOpen] = useState(false);
  const [roiOffsetModalOpen, setRoiOffsetModalOpen] = useState(false);
  const [deltaModalOpen, setDeltaModalOpen] = useState(false);

  // 结果状态
  const [lastResult, setLastResult] = useState<ToolResult | null>(null);

  // 检查连接状态
  const checkConnection = useCallback(() => {
    if (connectionStatus !== "connected") {
      message.error("请先连接本地服务与设备");
      return false;
    }
    return true;
  }, [connectionStatus]);

  // 打开工具
  const openTool = useCallback(
    (modalType: ToolConfig["modalType"]) => {
      if (!checkConnection()) return;

      switch (modalType) {
        case "ocr":
          setOcrModalOpen(true);
          break;
        case "template":
          setTemplateModalOpen(true);
          break;
        case "color":
          setColorModalOpen(true);
          break;
        case "roi":
          setRoiModalOpen(true);
          break;
        case "roi_offset":
          setRoiOffsetModalOpen(true);
          break;
        case "delta":
          setDeltaModalOpen(true);
          break;
      }
    },
    [checkConnection]
  );

  // OCR 确认回调
  const handleOCRConfirm = useCallback(
    (text: string, roi?: [number, number, number, number]) => {
      setLastResult({ type: "ocr", text, roi });
      message.success("OCR 识别完成");
    },
    []
  );

  // 模板确认回调
  const handleTemplateConfirm = useCallback(
    (
      templatePath: string,
      greenMask: boolean,
      roi?: [number, number, number, number]
    ) => {
      setLastResult({ type: "template", path: templatePath, greenMask, roi });
      message.success("模板截图已保存");
    },
    []
  );

  // 颜色确认回调
  const handleColorConfirm = useCallback(
    (color: [number, number, number] | [number]) => {
      setLastResult({ type: "color", color });
      message.success("颜色取点完成");
    },
    []
  );

  // ROI 确认回调
  const handleROIConfirm = useCallback(
    (roi: [number, number, number, number]) => {
      setLastResult({ type: "roi", roi });
      message.success("区域选择完成");
    },
    []
  );

  // ROI Offset 确认回调
  const handleROIOffsetConfirm = useCallback(
    (offset: [number, number, number, number]) => {
      setLastResult({ type: "roi_offset", offset });
      message.success("偏移测量完成");
    },
    []
  );

  // Delta 确认回调
  const handleDeltaConfirm = useCallback((delta: number, mode: "dx" | "dy") => {
    setLastResult({ type: mode, delta });
    message.success(`${mode === "dx" ? "水平" : "垂直"}位移测量完成`);
  }, []);

  // 复制值到剪贴板
  const copyValue = useCallback(() => {
    if (!lastResult) return;

    let valueStr = "";
    switch (lastResult.type) {
      case "ocr":
        // 如果有ROI，复制多行格式
        if (lastResult.roi) {
          valueStr = `"${lastResult.text}"\n[${lastResult.roi.join(", ")}]`;
        } else {
          valueStr = `"${lastResult.text}"`;
        }
        break;
      case "template":
        // 如果有ROI，复制多行格式
        if (lastResult.roi) {
          valueStr = `["${lastResult.path}"]\n${
            lastResult.greenMask
          }\n[${lastResult.roi.join(", ")}]`;
        } else {
          valueStr = `["${lastResult.path}"]\n${lastResult.greenMask}`;
        }
        break;
      case "color":
        // 根据颜色值长度判断模式
        if (lastResult.color.length === 1) {
          // GRAY模式
          valueStr = `[[${lastResult.color[0]}]]`;
        } else {
          // RGB/HSV模式
          valueStr = `[[${lastResult.color.join(", ")}]]`;
        }
        break;
      case "roi":
        valueStr = `[${lastResult.roi.join(", ")}]`;
        break;
      case "roi_offset":
        valueStr = `[${lastResult.offset.join(", ")}]`;
        break;
      case "dx":
        valueStr = `${lastResult.delta}`;
        break;
      case "dy":
        valueStr = `${lastResult.delta}`;
        break;
    }

    navigator.clipboard.writeText(valueStr).then(() => {
      message.success("已复制值");
    });
  }, [lastResult]);

  // 复制键值对到剪贴板
  const copyKeyValue = useCallback(() => {
    if (!lastResult) return;

    let keyValueStr = "";
    switch (lastResult.type) {
      case "ocr":
        // 如果有ROI，复制多行格式
        if (lastResult.roi) {
          keyValueStr = `expected: "${
            lastResult.text
          }"\nroi: [${lastResult.roi.join(", ")}]`;
        } else {
          keyValueStr = `expected: "${lastResult.text}"`;
        }
        break;
      case "template":
        // 如果有ROI，复制多行格式
        if (lastResult.roi) {
          keyValueStr = `template: ["${lastResult.path}"]\ngreen_mask: ${
            lastResult.greenMask
          }\nroi: [${lastResult.roi.join(", ")}]`;
        } else {
          keyValueStr = `template: ["${lastResult.path}"]\ngreen_mask: ${lastResult.greenMask}`;
        }
        break;
      case "color":
        keyValueStr = `lower: [[${lastResult.color.join(", ")}]]`;
        break;
      case "roi":
        keyValueStr = `roi: [${lastResult.roi.join(", ")}]`;
        break;
      case "roi_offset":
        keyValueStr = `roi_offset: [${lastResult.offset.join(", ")}]`;
        break;
      case "dx":
        keyValueStr = `dx: ${lastResult.delta}`;
        break;
      case "dy":
        keyValueStr = `dy: ${lastResult.delta}`;
        break;
    }

    navigator.clipboard.writeText(keyValueStr).then(() => {
      message.success("已复制键值对");
    });
  }, [lastResult]);

  // 渲染结果预览
  const renderResultPreview = () => {
    if (!lastResult) return null;

    let content: React.ReactNode = null;
    let label = "";

    switch (lastResult.type) {
      case "ocr":
        label = "OCR 结果";
        content = (
          <div className={style.resultContent}>
            <div className={style.resultText}>{lastResult.text}</div>
            {lastResult.roi && (
              <div className={style.resultRoi}>
                ROI: [{lastResult.roi.join(", ")}]
              </div>
            )}
          </div>
        );
        break;
      case "template":
        label = "模板截图";
        content = (
          <div className={style.resultContent}>
            <div className={style.resultText}>{lastResult.path}</div>
            <div className={style.resultMeta}>
              绿幕: {lastResult.greenMask ? "是" : "否"}
            </div>
          </div>
        );
        break;
      case "color":
        label = "取色结果";
        // 根据颜色值长度判断模式
        if (lastResult.color.length === 1) {
          // GRAY模式
          const gray = lastResult.color[0];
          content = (
            <div className={style.resultContent}>
              <div
                className={style.colorPreview}
                style={{
                  backgroundColor: `rgb(${gray}, ${gray}, ${gray})`,
                }}
              />
              <span>GRAY({gray})</span>
            </div>
          );
        } else {
          // RGB/HSV模式
          const [v1, v2, v3] = lastResult.color;
          content = (
            <div className={style.resultContent}>
              <div
                className={style.colorPreview}
                style={{
                  backgroundColor: `rgb(${v1}, ${v2}, ${v3})`,
                }}
              />
              <span>
                ({v1}, {v2}, {v3})
              </span>
            </div>
          );
        }
        break;
      case "roi":
        label = "区域结果";
        content = (
          <div className={style.resultContent}>
            [{lastResult.roi.join(", ")}]
          </div>
        );
        break;
      case "roi_offset":
        label = "偏移结果";
        content = (
          <div className={style.resultContent}>
            [{lastResult.offset.join(", ")}]
          </div>
        );
        break;
      case "dx":
        label = "水平位移";
        content = <div className={style.resultContent}>{lastResult.delta}</div>;
        break;
      case "dy":
        label = "垂直位移";
        content = <div className={style.resultContent}>{lastResult.delta}</div>;
        break;
    }

    return (
      <div className={style.resultArea}>
        <div className={style.resultHeader}>
          <span className={style.resultLabel}>{label}</span>
          <div className={style.buttonGroup}>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={copyValue}
            >
              复制值
            </Button>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={copyKeyValue}
            >
              复制键值对
            </Button>
          </div>
        </div>
        {content}
      </div>
    );
  };

  return (
    <div className={style.toolboxPanel}>
      <div className={style.toolsRow}>
        {TOOLBOX_TOOLS.map((tool) => (
          <Tooltip key={tool.key} title={tool.label} placement="bottom">
            <div
              className={style.toolItem}
              onClick={() => openTool(tool.modalType)}
            >
              <IconFont
                name={tool.icon}
                size={tool.iconSize || 22}
                className={style.toolIcon}
              />
            </div>
          </Tooltip>
        ))}
      </div>

      {/* 结果预览区 */}
      {renderResultPreview()}

      {/* Modals */}
      <OCRModal
        open={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        onConfirm={handleOCRConfirm}
      />
      <TemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onConfirm={handleTemplateConfirm}
      />
      <ColorModal
        open={colorModalOpen}
        onClose={() => setColorModalOpen(false)}
        onConfirm={handleColorConfirm}
      />
      <ROIModal
        open={roiModalOpen}
        onClose={() => setRoiModalOpen(false)}
        onConfirm={handleROIConfirm}
      />
      <ROIOffsetModal
        open={roiOffsetModalOpen}
        onClose={() => setRoiOffsetModalOpen(false)}
        onConfirm={handleROIOffsetConfirm}
      />
      <DeltaModal
        open={deltaModalOpen}
        onClose={() => setDeltaModalOpen(false)}
        onConfirm={handleDeltaConfirm}
        initialMode="dx"
      />
    </div>
  );
}

export default memo(ToolboxPanel);
