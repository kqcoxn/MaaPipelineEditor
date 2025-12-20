import style from "../../../styles/FieldPanel.module.less";
import { memo, useState, useCallback } from "react";
import { Popover, Input, InputNumber, Select, Switch } from "antd";
import IconFont, { type IconNames } from "../../iconfonts";
import type { ParamType } from "../../../stores/flow";
import type { FieldType } from "../../../core/fields";
import { FieldTypeEnum } from "../../../core/fields";
import { JsonHelper } from "../../../utils/jsonHelper";
import { useMFWStore } from "../../../stores/mfwStore";
import { ROIModal, OCRModal, TemplateModal, ColorModal } from "../../modals";
import { ListValueElem } from "./ListValueElem";
import { message } from "antd";

// 快捷工具配置
const QUICK_TOOLS: Record<string, IconNames> = {
  roi: "icon-kuangxuanzhong",
  expected: "icon-ocr1",
  template: "icon-jietu",
  lower: "icon-ic_quseqi",
  upper: "icon-ic_quseqi",
  target: "icon-kuangxuanzhong",
  begin: "icon-kuangxuanzhong",
  end: "icon-kuangxuanzhong",
};

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
    const [currentColorKey, setCurrentColorKey] = useState<string | null>(null);
    // 记录当前操作的列表索引
    const [currentListIndex, setCurrentListIndex] = useState<number | null>(
      null
    );

    // 打开 ROI 配置面板
    const handleOpenROI = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentROIKey(key);
        setCurrentListIndex(listIndex ?? null);
        setRoiModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开 OCR 配置面板
    const handleOpenOCR = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentExpectedKey(key);
        setCurrentListIndex(listIndex ?? null);
        setOcrModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开模板配置面板
    const handleOpenTemplate = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentTemplateKey(key);
        setCurrentListIndex(listIndex ?? null);
        setTemplateModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开颜色配置面板
    const handleOpenColor = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentColorKey(key);
        setCurrentListIndex(listIndex ?? null);
        setColorModalOpen(true);
      },
      [connectionStatus]
    );

    // ROI 确认回调
    const handleROIConfirm = useCallback(
      (roi: [number, number, number, number]) => {
        if (currentROIKey) {
          // 列表类型只替换指定索引的值
          if (currentListIndex !== null) {
            let currentValue = paramData[currentROIKey];
            // 非数组值转为数组
            if (!Array.isArray(currentValue)) {
              currentValue = [currentValue];
            }
            const newList = [...currentValue];
            newList[currentListIndex] = roi;
            onChange(currentROIKey, newList);
          } else {
            onChange(currentROIKey, roi);
          }
        }
        setRoiModalOpen(false);
        setCurrentROIKey(null);
        setCurrentListIndex(null);
      },
      [currentROIKey, currentListIndex, paramData, onChange]
    );

    // OCR 确认回调
    const handleOCRConfirm = useCallback(
      (text: string, roi?: [number, number, number, number]) => {
        if (currentExpectedKey) {
          // 列表类型只替换指定索引的值
          if (currentListIndex !== null) {
            let currentValue = paramData[currentExpectedKey];
            // 非数组值转为数组
            if (!Array.isArray(currentValue)) {
              currentValue = [currentValue];
            }
            const newList = [...currentValue];
            newList[currentListIndex] = text;
            onChange(currentExpectedKey, newList);
          } else {
            onChange(currentExpectedKey, text);
          }
        }
        setOcrModalOpen(false);
        setCurrentExpectedKey(null);
        setCurrentListIndex(null);
      },
      [currentExpectedKey, currentListIndex, paramData, onChange]
    );

    // 模板确认回调
    const handleTemplateConfirm = useCallback(
      (
        templatePath: string,
        greenMask: boolean,
        roi?: [number, number, number, number]
      ) => {
        if (currentTemplateKey) {
          // 列表类型只替换指定索引的值
          if (currentListIndex !== null) {
            let currentValue = paramData[currentTemplateKey];
            // 非数组值转为数组
            if (!Array.isArray(currentValue)) {
              currentValue = [currentValue];
            }
            const newList = [...currentValue];
            newList[currentListIndex] = templatePath;
            onChange(currentTemplateKey, newList);
          } else {
            onChange(currentTemplateKey, templatePath);
          }
          // 如果有涂绿需要设置 green_mask 字段
          if (greenMask) {
            onChange("green_mask", true);
          }
        }
        setTemplateModalOpen(false);
        setCurrentTemplateKey(null);
        setCurrentListIndex(null);
      },
      [currentTemplateKey, currentListIndex, paramData, onChange]
    );

    // 颜色确认回调
    const handleColorConfirm = useCallback(
      (color: [number, number, number]) => {
        if (!currentColorKey) return;

        // 列表类型只替换指定索引的值
        if (currentListIndex !== null) {
          let currentValue = paramData[currentColorKey];
          // 非数组值转为数组
          if (!Array.isArray(currentValue)) {
            currentValue = [currentValue];
          }
          // 规范化为二维数组
          if (currentValue.length > 0 && !Array.isArray(currentValue[0])) {
            currentValue = [currentValue];
          }
          const newList = [...currentValue];
          newList[currentListIndex] = color;
          onChange(currentColorKey, newList);
        } else {
          // 规范化为二维数组
          onChange(currentColorKey, [color]);
        }

        setColorModalOpen(false);
        setCurrentColorKey(null);
        setCurrentListIndex(null);
      },
      [currentColorKey, currentListIndex, paramData, onChange]
    );

    // 获取字段对应的快捷工具图标
    const getQuickToolIcon = useCallback(
      (key: string): IconNames | undefined => {
        return QUICK_TOOLS[key];
      },
      []
    );

    // 处理快捷工具点击
    const handleQuickToolClick = useCallback(
      (key: string, listIndex?: number) => {
        if (
          key === "roi" ||
          key === "target" ||
          key === "begin" ||
          key === "end"
        ) {
          handleOpenROI(key, listIndex);
        } else if (key === "expected") {
          handleOpenOCR(key, listIndex);
        } else if (key === "template") {
          handleOpenTemplate(key, listIndex);
        } else if (key === "lower" || key === "upper") {
          handleOpenColor(key, listIndex);
        }
      },
      [handleOpenROI, handleOpenOCR, handleOpenTemplate, handleOpenColor]
    );

    // 渲染快捷工具按钮
    const renderQuickTool = useCallback(
      (key: string, listIndex?: number) => {
        const icon = getQuickToolIcon(key);
        if (!icon) {
          return null;
        }

        return (
          <div className={style.operation}>
            <IconFont
              className="icon-interactive"
              name={icon}
              size={18}
              onClick={() => handleQuickToolClick(key, listIndex)}
            />
          </div>
        );
      },
      [getQuickToolIcon, handleQuickToolClick]
    );

    const existingFields = Object.keys(paramData);
    const paramFields = paramType.flatMap((type) => {
      const key = type.key;
      const value = paramData[key];
      if (!existingFields.includes(key)) return [];
      // 输入方案
      let InputElem = null;
      let paramType = Array.isArray(type.type) ? type.type[0] : type.type;
      let isListType = false;
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
            isListType = true;
            InputElem = ListValueElem(
              key,
              value,
              onListChange,
              onListAdd,
              onListDelete,
              paramType,
              0,
              renderQuickTool
            );
            break;
          // 数字列表
          case FieldTypeEnum.IntList:
          case FieldTypeEnum.DoubleList:
            isListType = true;
            InputElem = ListValueElem(
              key,
              value,
              onListChange,
              onListAdd,
              onListDelete,
              paramType,
              type.step,
              renderQuickTool
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
      // 使用 displayName 或 key 作为显示名称
      const displayText = type.displayName || key;
      return (
        <div key={key} className={style.item}>
          <Popover
            style={{ maxWidth: 10 }}
            placement="left"
            title={key}
            content={LeftTipContentElem(type.desc)}
          >
            <div className={style.key}>{displayText}</div>
          </Popover>
          {InputElem}
          {!isListType && renderQuickTool(key)}
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
              setCurrentListIndex(null);
            }}
            onConfirm={handleROIConfirm}
            initialROI={
              currentListIndex !== null &&
              Array.isArray(paramData[currentROIKey])
                ? (paramData[currentROIKey][currentListIndex] as
                    | [number, number, number, number]
                    | undefined)
                : (paramData[currentROIKey] as
                    | [number, number, number, number]
                    | undefined)
            }
          />
        )}
        {currentExpectedKey && (
          <OCRModal
            open={ocrModalOpen}
            onClose={() => {
              setOcrModalOpen(false);
              setCurrentExpectedKey(null);
              setCurrentListIndex(null);
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
              setCurrentListIndex(null);
            }}
            onConfirm={handleTemplateConfirm}
          />
        )}
        {currentColorKey && (
          <ColorModal
            open={colorModalOpen}
            onClose={() => {
              setColorModalOpen(false);
              setCurrentColorKey(null);
              setCurrentListIndex(null);
            }}
            onConfirm={handleColorConfirm}
            targetKey={currentColorKey}
          />
        )}
      </>
    );
  }
);
