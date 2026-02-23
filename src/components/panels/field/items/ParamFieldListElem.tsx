import style from "../../../../styles/FieldPanel.module.less";
import { memo, useState, useCallback } from "react";
import { Popover, Input, InputNumber, Select, Switch } from "antd";
import IconFont, { type IconNames } from "../../../iconfonts";
import type { ParamType } from "../../../../stores/flow";
import type { FieldType } from "../../../../core/fields";
import { FieldTypeEnum } from "../../../../core/fields";
import { JsonHelper } from "../../../../utils/jsonHelper";
import { useMFWStore } from "../../../../stores/mfwStore";
import {
  ROIModal,
  ROIOffsetModal,
  OCRModal,
  TemplateModal,
  ColorModal,
  DeltaModal,
} from "../../../modals";
import { ListValueElem } from "./ListValueElem";
import { TemplatePreview } from "./TemplatePreview";
import { ImageSelect } from "./ImageSelect";
import { message } from "antd";

// 快捷工具类型
type QuickToolType =
  | "roi"
  | "roi_offset"
  | "ocr"
  | "template"
  | "color"
  | "delta";

// 快捷工具配置
interface QuickToolConfig {
  icon: IconNames;
  type: QuickToolType;
}

const QUICK_TOOLS: Record<string, QuickToolConfig> = {
  // 区域选择工具 (ROI)
  roi: { icon: "icon-kuangxuanzhong", type: "roi" },
  target: { icon: "icon-kuangxuanzhong", type: "roi" },
  begin: { icon: "icon-kuangxuanzhong", type: "roi" },
  end: { icon: "icon-kuangxuanzhong", type: "roi" },

  // 偏移测量工具 (ROI Offset)
  roi_offset: { icon: "icon-celiang1", type: "roi_offset" },
  target_offset: { icon: "icon-celiang1", type: "roi_offset" },
  begin_offset: { icon: "icon-celiang1", type: "roi_offset" },
  end_offset: { icon: "icon-celiang1", type: "roi_offset" },

  // OCR识别工具
  expected: { icon: "icon-ocr1", type: "ocr" },

  // 模板截图工具
  template: { icon: "icon-jietu", type: "template" },

  // 颜色取点工具
  lower: { icon: "icon-ic_quseqi", type: "color" },
  upper: { icon: "icon-ic_quseqi", type: "color" },

  // 位移差值工具
  dx: { icon: "icon-celiang2", type: "delta" },
  dy: { icon: "icon-celiang2", type: "delta" },
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
    const [deltaModalOpen, setDeltaModalOpen] = useState(false);
    const [currentDeltaKey, setCurrentDeltaKey] = useState<string | null>(null);
    const [roiOffsetModalOpen, setRoiOffsetModalOpen] = useState(false);
    const [currentROIOffsetKey, setCurrentROIOffsetKey] = useState<
      string | null
    >(null);
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

    // 打开位移差值配置面板
    const handleOpenDelta = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentDeltaKey(key);
        setCurrentListIndex(listIndex ?? null);
        setDeltaModalOpen(true);
      },
      [connectionStatus]
    );

    // 打开 ROI 偏移配置面板
    const handleOpenROIOffset = useCallback(
      (key: string, listIndex?: number) => {
        if (connectionStatus !== "connected") {
          message.warning("请先连接设备");
          return;
        }
        setCurrentROIOffsetKey(key);
        setCurrentListIndex(listIndex ?? null);
        setRoiOffsetModalOpen(true);
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
      (color: [number, number, number] | [number]) => {
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

    // 位移差值确认回调
    const handleDeltaConfirm = useCallback(
      (delta: number, mode: "dx" | "dy") => {
        if (!currentDeltaKey) return;

        onChange(currentDeltaKey, delta);

        setDeltaModalOpen(false);
        setCurrentDeltaKey(null);
        setCurrentListIndex(null);
      },
      [currentDeltaKey, onChange]
    );

    // ROI 偏移确认回调
    const handleROIOffsetConfirm = useCallback(
      (offset: [number, number, number, number]) => {
        if (!currentROIOffsetKey) return;

        // 列表类型只替换指定索引的值
        if (currentListIndex !== null) {
          let currentValue = paramData[currentROIOffsetKey];
          // 非数组值转为数组
          if (!Array.isArray(currentValue)) {
            currentValue = [currentValue];
          }
          const newList = [...currentValue];
          newList[currentListIndex] = offset;
          onChange(currentROIOffsetKey, newList);
        } else {
          onChange(currentROIOffsetKey, offset);
        }

        setRoiOffsetModalOpen(false);
        setCurrentROIOffsetKey(null);
        setCurrentListIndex(null);
      },
      [currentROIOffsetKey, currentListIndex, paramData, onChange]
    );

    // 获取字段对应的快捷工具配置
    const getQuickToolConfig = useCallback(
      (key: string): QuickToolConfig | undefined => {
        return QUICK_TOOLS[key];
      },
      []
    );

    // 处理快捷工具点击
    const handleQuickToolClick = useCallback(
      (key: string, listIndex?: number) => {
        const config = QUICK_TOOLS[key];
        if (!config) return;

        switch (config.type) {
          case "roi":
            handleOpenROI(key, listIndex);
            break;
          case "roi_offset":
            handleOpenROIOffset(key, listIndex);
            break;
          case "ocr":
            handleOpenOCR(key, listIndex);
            break;
          case "template":
            handleOpenTemplate(key, listIndex);
            break;
          case "color":
            handleOpenColor(key, listIndex);
            break;
          case "delta":
            handleOpenDelta(key, listIndex);
            break;
        }
      },
      [
        handleOpenROI,
        handleOpenROIOffset,
        handleOpenOCR,
        handleOpenTemplate,
        handleOpenColor,
        handleOpenDelta,
      ]
    );

    // 渲染快捷工具按钮
    const renderQuickTool = useCallback(
      (key: string, listIndex?: number) => {
        const config = getQuickToolConfig(key);
        if (!config) {
          return null;
        }

        return (
          <div className={style.operation}>
            <IconFont
              className="icon-interactive"
              name={config.icon}
              size={18}
              onClick={() => handleQuickToolClick(key, listIndex)}
            />
          </div>
        );
      },
      [getQuickToolConfig, handleQuickToolClick]
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
          // 图片路径列表
          case FieldTypeEnum.ImagePathList: {
            isListType = true;
            const valueList = Array.isArray(value) ? value : [value];
            const listItems = valueList.map((item: string, index: number) => {
              const quickToolElem = renderQuickTool(key, index);
              // 计算图标数量
              const iconCount =
                (quickToolElem ? 1 : 0) +
                (valueList.length > 1 ? 1 : 0) +
                (index === valueList.length - 1 ? 1 : 0);
              return (
                <div key={index}>
                  <ImageSelect
                    value={item || ""}
                    onChange={(newValue) => {
                      const newList = [...valueList];
                      newList[index] = newValue;
                      onListChange(key, newList);
                    }}
                    placeholder="输入或选择图片路径"
                    inList
                  />
                  <div
                    className={style["icons-container"]}
                    style={{ width: `${iconCount * 26}px` }}
                  >
                    {quickToolElem}
                    {valueList.length > 1 ? (
                      <div className={style.operation}>
                        <IconFont
                          className="icon-interactive"
                          name="icon-shanchu"
                          size={18}
                          color="#ff4a4a"
                          onClick={() => onListDelete(key, valueList, index)}
                        />
                      </div>
                    ) : null}
                    {index === valueList.length - 1 ? (
                      <div className={style.operation}>
                        <IconFont
                          className="icon-interactive"
                          name="icon-zengjiatianjiajiajian"
                          size={18}
                          color="#83be42"
                          onClick={() => onListAdd(key, valueList)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            });
            InputElem = <div className={style["list-value"]}>{listItems}</div>;
            break;
          }
          // 单个图片路径
          case FieldTypeEnum.ImagePath:
            InputElem = (
              <ImageSelect
                value={value || ""}
                onChange={(newValue) => onChange(key, newValue)}
                placeholder="输入或选择图片路径"
              />
            );
            break;
          // 字符串列表
          case FieldTypeEnum.StringList:
          case FieldTypeEnum.IntListList:
          case FieldTypeEnum.StringPairList:
          case FieldTypeEnum.XYWHList:
          case FieldTypeEnum.PositionList:
          case FieldTypeEnum.ObjectList:
          case FieldTypeEnum.StringOrObjectList:
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
                  checked={value}
                  onChange={(e) => onChange(key, e)}
                />
              </div>
            );
            break;
          // Any 类型或字符串
          default:
            InputElem = (
              <TextArea
                className={style.value}
                value={JsonHelper.objToString(value) ?? value}
                placeholder={String(paramType)}
                autoSize={{ minRows: 1, maxRows: 4 }}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  if (paramType === FieldTypeEnum.Any) {
                    try {
                      // 尝试解析为 JSON 值
                      const parsed = JSON.parse(inputValue);
                      onChange(key, parsed);
                    } catch {
                      // 保留原始字符串
                      onChange(key, inputValue);
                    }
                  } else {
                    onChange(key, inputValue);
                  }
                }}
              />
            );
        }
      }
      // 使用 displayName 或 key 作为显示名称
      const displayText = type.displayName || key;

      // 判断是否需要图片预览
      const isTemplateField = key === "template";
      // 获取预览路径列表
      let templatePaths: string[] = [];
      if (isTemplateField) {
        if (Array.isArray(value)) {
          templatePaths = value.filter(
            (v) => typeof v === "string" && v.trim() !== ""
          );
        } else if (typeof value === "string" && value.trim() !== "") {
          templatePaths = [value];
        }
      }

      // 渲染标签
      let wrappedLabelElement;
      if (isTemplateField && templatePaths.length > 0) {
        wrappedLabelElement = (
          <TemplatePreview
            templatePaths={templatePaths}
            title={key}
            description={type.desc}
          >
            <div className={style.key}>{displayText}</div>
          </TemplatePreview>
        );
      } else {
        wrappedLabelElement = (
          <Popover
            style={{ maxWidth: 10 }}
            placement="left"
            title={key}
            content={LeftTipContentElem(type.desc)}
          >
            <div className={style.key}>{displayText}</div>
          </Popover>
        );
      }

      return (
        <div key={key} className={style.item}>
          {wrappedLabelElement}
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
            initialMethod={paramData["method"] as number | undefined}
            initialLower={(() => {
              const val = paramData["lower"] as unknown;
              if (!val || !Array.isArray(val)) return undefined;
              if (val.length > 0 && Array.isArray(val[0])) {
                return val[currentListIndex ?? 0] as number[];
              }
              return val as number[];
            })()}
            initialUpper={(() => {
              const val = paramData["upper"] as unknown;
              if (!val || !Array.isArray(val)) return undefined;
              if (val.length > 0 && Array.isArray(val[0])) {
                return val[currentListIndex ?? 0] as number[];
              }
              return val as number[];
            })()}
          />
        )}
        {currentDeltaKey && (
          <DeltaModal
            open={deltaModalOpen}
            onClose={() => {
              setDeltaModalOpen(false);
              setCurrentDeltaKey(null);
              setCurrentListIndex(null);
            }}
            onConfirm={handleDeltaConfirm}
            initialMode={currentDeltaKey as "dx" | "dy"}
          />
        )}
        {currentROIOffsetKey && (
          <ROIOffsetModal
            open={roiOffsetModalOpen}
            onClose={() => {
              setRoiOffsetModalOpen(false);
              setCurrentROIOffsetKey(null);
              setCurrentListIndex(null);
            }}
            onConfirm={handleROIOffsetConfirm}
            initialROI={
              paramData["roi"] as [number, number, number, number] | undefined
            }
          />
        )}
      </>
    );
  }
);
