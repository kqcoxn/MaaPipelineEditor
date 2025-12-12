import style from "../../../styles/FieldPanel.module.less";
import { memo, useState, useCallback } from "react";
import { Popover, Input, InputNumber, Select, Switch, Tooltip } from "antd";
import IconFont from "../../iconfonts";
import type { ParamType } from "../../../stores/flow";
import type { FieldType } from "../../../core/fields";
import { FieldTypeEnum } from "../../../core/fields";
import { JsonHelper } from "../../../utils/jsonHelper";
import { useMFWStore } from "../../../stores/mfwStore";
import { ROIModal, OCRModal, TemplateModal, ColorModal } from "../../modals";
import { ListValueElem } from "./ListValueElem";
import { message } from "antd";

const { TextArea } = Input;

function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

export const ParamFieldListElem = memo(
  ({
    paramData,
    paramType,
    onChange,
    onDelete,
    onListChange,
    onListAdd,
    onListDelete,
  }: {
    paramData: ParamType;
    paramType: FieldType[];
    onChange: (key: string, value: any) => void;
    onDelete: (key: string) => void;
    onListChange: (key: string, valueList: any[]) => void;
    onListAdd: (key: string, valueList: any[]) => void;
    onListDelete: (key: string, valueList: any[], index: number) => void;
  }) => {
    const { connectionStatus } = useMFWStore();
    const [roiModalOpen, setRoiModalOpen] = useState(false);
    const [ocrModalOpen, setOcrModalOpen] = useState(false);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [colorModalOpen, setColorModalOpen] = useState(false);
    const [currentROIKey, setCurrentROIKey] = useState<string | null>(null);
    const [currentExpectedKey, setCurrentExpectedKey] = useState<string | null>(
      null
    );
    const [currentTemplateKey, setCurrentTemplateKey] = useState<string | null>(
      null
    );
    const [currentLowerKey, setCurrentLowerKey] = useState<string | null>(null);
    const [currentUpperKey, setCurrentUpperKey] = useState<string | null>(null);

    // 打开 ROI 配置面板
    const handleOpenROI = useCallback(
      (key: string) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentROIKey(key);
        setRoiModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开 OCR 配置面板
    const handleOpenOCR = useCallback(
      (key: string) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentExpectedKey(key);
        setOcrModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开模板配置面板
    const handleOpenTemplate = useCallback(
      (key: string) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentTemplateKey(key);
        setTemplateModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开颜色配置面板
    const handleOpenColor = useCallback(
      (key: string, isUpper: boolean = false) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentLowerKey(isUpper ? null : key);
        setCurrentUpperKey(isUpper ? key : null);
        setColorModalOpen(true);
      },
      [connectionStatus]
    );

    // ROI 确认回调
    const handleROIConfirm = useCallback(
      (roi: [number, number, number, number]) => {
        if (currentROIKey) {
          onChange(currentROIKey, roi);
        }
        setRoiModalOpen(false);
        setCurrentROIKey(null);
      },
      [currentROIKey, onChange]
    );

    // OCR 确认回调
    const handleOCRConfirm = useCallback(
      (text: string, roi?: [number, number, number, number]) => {
        if (currentExpectedKey) {
          onChange(currentExpectedKey, text);
        }
        setOcrModalOpen(false);
        setCurrentExpectedKey(null);
      },
      [currentExpectedKey, onChange]
    );

    // 模板确认回调
    const handleTemplateConfirm = useCallback(
      (
        templatePath: string,
        greenMask: boolean,
        roi?: [number, number, number, number]
      ) => {
        if (currentTemplateKey) {
          onChange(currentTemplateKey, templatePath);
          // 如果有涂绿需要设置 green_mask 字段
          if (greenMask) {
            onChange("green_mask", true);
          }
        }
        setTemplateModalOpen(false);
        setCurrentTemplateKey(null);
      },
      [currentTemplateKey, onChange]
    );

    // 颜色确认回调
    const handleColorConfirm = useCallback(
      (lower: [number, number, number], upper: [number, number, number]) => {
        if (currentLowerKey) {
          onChange(currentLowerKey, lower);
        }
        if (currentUpperKey) {
          onChange(currentUpperKey, upper);
        }
        // 如果都没有，同时填充两个
        if (!currentLowerKey && !currentUpperKey) {
          onChange("lower", lower);
          onChange("upper", upper);
        }
        setColorModalOpen(false);
        setCurrentLowerKey(null);
        setCurrentUpperKey(null);
      },
      [currentLowerKey, currentUpperKey, onChange]
    );

    // 判断字段是否支持快速配置
    const supportsQuickConfig = useCallback((key: string): boolean => {
      return (
        key === "roi" ||
        key === "expected" ||
        key === "template" ||
        key === "lower" ||
        key === "upper"
      );
    }, []);

    // 渲染快速配置按钮
    const renderQuickConfigButton = useCallback(
      (key: string) => {
        if (!supportsQuickConfig(key) || connectionStatus !== "connected") {
          return null;
        }

        return (
          <Tooltip title="打开辅助配置面板">
            <div className={style.operation}>
              <IconFont
                className="icon-interactive"
                style={{ width: 20 }}
                name="icon-a-080_shezhi"
                size={18}
                color="#1296db"
                onClick={() => {
                  if (key === "roi") {
                    handleOpenROI(key);
                  } else if (key === "expected") {
                    handleOpenOCR(key);
                  } else if (key === "template") {
                    handleOpenTemplate(key);
                  } else if (key === "lower" || key === "upper") {
                    handleOpenColor(key, key === "upper");
                  }
                }}
              />
            </div>
          </Tooltip>
        );
      },
      [
        supportsQuickConfig,
        connectionStatus,
        handleOpenROI,
        handleOpenOCR,
        handleOpenTemplate,
        handleOpenColor,
      ]
    );

    const existingFields = Object.keys(paramData);
    const paramFields = paramType.flatMap((type) => {
      const key = type.key;
      const value = paramData[key];
      if (!existingFields.includes(key)) return [];
      // 输入方案
      let InputElem = null;
      let paramType = Array.isArray(type.type) ? type.type[0] : type.type;
      // 可选类型
      if ("options" in type) {
        const options =
          type.options?.map((item) => ({
            value: item,
            label: item,
          })) || [];
        InputElem = (
          <Select
            className={style.value}
            options={options}
            value={value}
            onChange={(e) => onChange(key, e)}
          />
        );
      } else {
        switch (paramType) {
          // 字符串列表
          case FieldTypeEnum.StringList:
          case FieldTypeEnum.IntListList:
          case FieldTypeEnum.StringPairList:
          case FieldTypeEnum.XYWHList:
          case FieldTypeEnum.PositionList:
          case FieldTypeEnum.ObjectList:
            InputElem = ListValueElem(
              key,
              value,
              onListChange,
              onListAdd,
              onListDelete,
              paramType
            );
            break;
          // 数字列表
          case FieldTypeEnum.IntList:
          case FieldTypeEnum.DoubleList:
            InputElem = ListValueElem(
              key,
              value,
              onListChange,
              onListAdd,
              onListDelete,
              paramType,
              type.step
            );
            break;
          // 整型
          case FieldTypeEnum.Int:
            InputElem = (
              <InputNumber
                className={style.value}
                value={value}
                precision={0}
                step={type.step ?? 1}
                onChange={(e) => onChange(key, e)}
              />
            );
            break;
          // 浮点数
          case FieldTypeEnum.Double:
            InputElem = (
              <InputNumber
                className={style.value}
                value={value}
                step={type.step ?? 0.01}
                onChange={(e) => onChange(key, e)}
              />
            );
            break;
          // 布尔
          case FieldTypeEnum.Bool:
            InputElem = (
              <div style={{ flex: 1 }}>
                <Switch
                  style={{ marginLeft: 14 }}
                  checkedChildren="true"
                  unCheckedChildren="false"
                  defaultChecked={value}
                  onChange={(e) => onChange(key, e)}
                />
              </div>
            );
            break;
          // 字符串
          default:
            InputElem = (
              <TextArea
                className={style.value}
                value={JsonHelper.objToString(value) ?? value}
                placeholder={String(paramType)}
                autoSize={{ minRows: 1, maxRows: 4 }}
                onChange={(e) => onChange(key, e.target.value)}
              />
            );
        }
      }
      // 组合
      return (
        <div key={key} className={style.item}>
          <Popover
            style={{ maxWidth: 10 }}
            placement="left"
            title={key}
            content={LeftTipContentElem(type.desc)}
          >
            <div className={style.key}>{key}</div>
          </Popover>
          {InputElem}
          {renderQuickConfigButton(key)}
          <div className={style.operation}>
            <IconFont
              className="icon-interactive"
              style={{ width: 20 }}
              name="icon-lanzilajitongshanchu"
              size={16}
              onClick={() => onDelete(key)}
            />
          </div>
        </div>
      );
    });
    return (
      <>
        {paramFields}
        {currentROIKey && (
          <ROIModal
            open={roiModalOpen}
            onClose={() => {
              setRoiModalOpen(false);
              setCurrentROIKey(null);
            }}
            onConfirm={handleROIConfirm}
            initialROI={
              paramData[currentROIKey] as
                | [number, number, number, number]
                | undefined
            }
          />
        )}
        {currentExpectedKey && (
          <OCRModal
            open={ocrModalOpen}
            onClose={() => {
              setOcrModalOpen(false);
              setCurrentExpectedKey(null);
            }}
            onConfirm={handleOCRConfirm}
          />
        )}
        {currentTemplateKey && (
          <TemplateModal
            open={templateModalOpen}
            onClose={() => {
              setTemplateModalOpen(false);
              setCurrentTemplateKey(null);
            }}
            onConfirm={handleTemplateConfirm}
          />
        )}
        {(currentLowerKey || currentUpperKey) && (
          <ColorModal
            open={colorModalOpen}
            onClose={() => {
              setColorModalOpen(false);
              setCurrentLowerKey(null);
              setCurrentUpperKey(null);
            }}
            onConfirm={handleColorConfirm}
          />
        )}
      </>
    );
  }
);
