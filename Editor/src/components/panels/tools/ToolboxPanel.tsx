import { memo, lazy, Suspense, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { message, Tooltip, Button } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useMFWStore } from "../../../stores/mfwStore";
import style from "../../../styles/panels/ToolboxPanel.module.less";

const ROIModal = lazy(() =>
  import("../../modals/ROIModal").then((module) => ({
    default: module.ROIModal,
  })),
);
const ROIOffsetModal = lazy(() =>
  import("../../modals/ROIOffsetModal").then((module) => ({
    default: module.ROIOffsetModal,
  })),
);
const OCRModal = lazy(() =>
  import("../../modals/OCRModal").then((module) => ({
    default: module.OCRModal,
  })),
);
const TemplateModal = lazy(() =>
  import("../../modals/TemplateModal").then((module) => ({
    default: module.TemplateModal,
  })),
);
const ColorModal = lazy(() =>
  import("../../modals/ColorModal").then((module) => ({
    default: module.ColorModal,
  })),
);
const DeltaModal = lazy(() =>
  import("../../modals/DeltaModal").then((module) => ({
    default: module.DeltaModal,
  })),
);

// 工具配置类型
interface ToolConfig {
  key: string;
  label: string;
  icon: IconNames;
  iconSize?: number;
  modalType: "ocr" | "template" | "color" | "roi" | "roi_offset" | "delta";
}

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
  const { t } = useTranslation();
  const { connectionStatus } = useMFWStore();

  const toolboxTools = useMemo<ToolConfig[]>(
    () => [
      {
        key: "ocr",
        label: t("ui.panels.tools.toolbox.ocr", "OCR 文字识别"),
        icon: "icon-ocr1",
        iconSize: 22,
        modalType: "ocr",
      },
      {
        key: "template",
        label: t("ui.panels.tools.toolbox.template", "模板截图"),
        icon: "icon-jietu",
        iconSize: 22,
        modalType: "template",
      },
      {
        key: "color",
        label: t("ui.panels.tools.toolbox.color", "颜色取点"),
        icon: "icon-ic_quseqi",
        iconSize: 22,
        modalType: "color",
      },
      {
        key: "roi",
        label: t("ui.panels.tools.toolbox.roi", "区域选择"),
        icon: "icon-kuangxuanzhong",
        iconSize: 22,
        modalType: "roi",
      },
      {
        key: "roi_offset",
        label: t("ui.panels.tools.toolbox.roiOffset", "偏移测量"),
        icon: "icon-celiang1",
        iconSize: 22,
        modalType: "roi_offset",
      },
      {
        key: "delta",
        label: t("ui.panels.tools.toolbox.delta", "位移差值 (dx/dy)"),
        icon: "icon-celiang2",
        iconSize: 22,
        modalType: "delta",
      },
    ],
    [t],
  );

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
      message.error(
        t("ui.panels.tools.toolbox.connectFirst", "请先连接本地服务与设备"),
      );
      return false;
    }
    return true;
  }, [connectionStatus, t]);

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
    [checkConnection],
  );

  // OCR 确认回调
  const handleOCRConfirm = useCallback(
    (text: string, roi?: [number, number, number, number]) => {
      setLastResult({ type: "ocr", text, roi });
      message.success(
        t("ui.panels.tools.toolbox.ocrComplete", "OCR 识别完成"),
      );
    },
    [t],
  );

  // 模板确认回调
  const handleTemplateConfirm = useCallback(
    (
      templatePath: string,
      greenMask: boolean,
      roi?: [number, number, number, number],
    ) => {
      setLastResult({ type: "template", path: templatePath, greenMask, roi });
      message.success(
        t("ui.panels.tools.toolbox.templateSaved", "模板截图已保存"),
      );
    },
    [t],
  );

  // 颜色确认回调
  const handleColorConfirm = useCallback(
    (color: [number, number, number] | [number]) => {
      setLastResult({ type: "color", color });
      message.success(
        t("ui.panels.tools.toolbox.colorComplete", "颜色取点完成"),
      );
    },
    [t],
  );

  // ROI 确认回调
  const handleROIConfirm = useCallback(
    (roi: [number, number, number, number]) => {
      setLastResult({ type: "roi", roi });
      message.success(
        t("ui.panels.tools.toolbox.roiComplete", "区域选择完成"),
      );
    },
    [t],
  );

  // ROI Offset 确认回调
  const handleROIOffsetConfirm = useCallback(
    (offset: [number, number, number, number]) => {
      setLastResult({ type: "roi_offset", offset });
      message.success(
        t("ui.panels.tools.toolbox.roiOffsetComplete", "偏移测量完成"),
      );
    },
    [t],
  );

  // Delta 确认回调
  const handleDeltaConfirm = useCallback(
    (delta: number, mode: "dx" | "dy") => {
      setLastResult({ type: mode, delta });
      message.success(
        mode === "dx"
          ? t(
              "ui.panels.tools.toolbox.horizontalDeltaComplete",
              "水平位移测量完成",
            )
          : t(
              "ui.panels.tools.toolbox.verticalDeltaComplete",
              "垂直位移测量完成",
            ),
      );
    },
    [t],
  );

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
      message.success(
        t("ui.panels.tools.toolbox.copiedValue", "已复制值"),
      );
    });
  }, [lastResult, t]);

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
      message.success(
        t("ui.panels.tools.toolbox.copiedKeyValue", "已复制键值对"),
      );
    });
  }, [lastResult, t]);

  // 渲染结果预览
  const renderResultPreview = () => {
    if (!lastResult) return null;

    let content: React.ReactNode = null;
    let label = "";

    switch (lastResult.type) {
      case "ocr":
        label = t("ui.panels.tools.toolbox.ocrResult", "OCR 结果");
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
        label = t("ui.panels.tools.toolbox.templateResult", "模板截图");
        content = (
          <div className={style.resultContent}>
            <div className={style.resultText}>{lastResult.path}</div>
            <div className={style.resultMeta}>
              {t("ui.panels.tools.toolbox.greenMask", "绿幕: {{value}}", {
                value: lastResult.greenMask
                  ? t("ui.panels.tools.toolbox.yes", "是")
                  : t("ui.panels.tools.toolbox.no", "否"),
              })}
            </div>
          </div>
        );
        break;
      case "color":
        label = t("ui.panels.tools.toolbox.colorResult", "取色结果");
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
        label = t("ui.panels.tools.toolbox.roiResult", "区域结果");
        content = (
          <div className={style.resultContent}>
            [{lastResult.roi.join(", ")}]
          </div>
        );
        break;
      case "roi_offset":
        label = t("ui.panels.tools.toolbox.offsetResult", "偏移结果");
        content = (
          <div className={style.resultContent}>
            [{lastResult.offset.join(", ")}]
          </div>
        );
        break;
      case "dx":
        label = t("ui.panels.tools.toolbox.horizontalDelta", "水平位移");
        content = <div className={style.resultContent}>{lastResult.delta}</div>;
        break;
      case "dy":
        label = t("ui.panels.tools.toolbox.verticalDelta", "垂直位移");
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
              {t("ui.panels.tools.toolbox.copyValue", "复制值")}
            </Button>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={copyKeyValue}
            >
              {t("ui.panels.tools.toolbox.copyKeyValue", "复制键值对")}
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
        {toolboxTools.map((tool) => (
          <div key={tool.key} className={style.toolItemWrapper}>
            <Tooltip title={tool.label} placement="bottom">
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
          </div>
        ))}
      </div>


      {/* 结果预览区 */}
      {renderResultPreview()}

      {/* Modals */}
      {ocrModalOpen && (
        <Suspense fallback={null}>
          <OCRModal
            open={ocrModalOpen}
            onClose={() => setOcrModalOpen(false)}
            onConfirm={handleOCRConfirm}
          />
        </Suspense>
      )}
      {templateModalOpen && (
        <Suspense fallback={null}>
          <TemplateModal
            open={templateModalOpen}
            onClose={() => setTemplateModalOpen(false)}
            onConfirm={handleTemplateConfirm}
          />
        </Suspense>
      )}
      {colorModalOpen && (
        <Suspense fallback={null}>
          <ColorModal
            open={colorModalOpen}
            onClose={() => setColorModalOpen(false)}
            onConfirm={handleColorConfirm}
          />
        </Suspense>
      )}
      {roiModalOpen && (
        <Suspense fallback={null}>
          <ROIModal
            open={roiModalOpen}
            onClose={() => setRoiModalOpen(false)}
            onConfirm={handleROIConfirm}
          />
        </Suspense>
      )}
      {roiOffsetModalOpen && (
        <Suspense fallback={null}>
          <ROIOffsetModal
            open={roiOffsetModalOpen}
            onClose={() => setRoiOffsetModalOpen(false)}
            onConfirm={handleROIOffsetConfirm}
          />
        </Suspense>
      )}
      {deltaModalOpen && (
        <Suspense fallback={null}>
          <DeltaModal
            open={deltaModalOpen}
            onClose={() => setDeltaModalOpen(false)}
            onConfirm={handleDeltaConfirm}
            initialMode="dx"
          />
        </Suspense>
      )}
    </div>
  );
}

export default memo(ToolboxPanel);
