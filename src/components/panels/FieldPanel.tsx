import style from "../../styles/FieldPanel.module.less";

import React, {
  useMemo,
  memo,
  useCallback,
  lazy,
  Suspense,
  useState,
} from "react";
import {
  Popover,
  Input,
  InputNumber,
  Select,
  Switch,
  Spin,
  Tooltip,
  Modal,
  message,
} from "antd";
const { TextArea } = Input;
import classNames from "classnames";
import IconFont from "../iconfonts";

import {
  useFlowStore,
  type ParamType,
  type PipelineNodeType,
  type ExternalNodeType,
  type AnchorNodeType,
} from "../../stores/flow";
import type { NodeType, PipelineNodeDataType } from "../../stores/flow/types";
import { useFileStore } from "../../stores/fileStore";
import {
  recoFields,
  actionFields,
  otherFieldParams,
  FieldTypeEnum,
  type FieldType,
} from "../../core/fields";
import { JsonHelper } from "../../utils/jsonHelper";
import { NodeTypeEnum } from "../flow/nodes";
import { ClipboardHelper } from "../../utils/clipboard";
import { useCustomTemplateStore } from "../../stores/customTemplateStore";
import { useMFWStore } from "../../stores/mfwStore";
import { ROIModal, OCRModal, TemplateModal, ColorModal } from "../modals";

/**模块 */
// 提示词
function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

// 添加字段
const AddFieldElem = memo(
  ({
    paramType,
    paramData,
    onClick,
  }: {
    paramType: FieldType[];
    paramData: ParamType;
    onClick: (param: FieldType) => void;
  }) => {
    if (paramType.length === 0) {
      return null;
    }
    const currentParams = Object.keys(paramData);
    const paramList = paramType.flatMap((param) => {
      if (currentParams.includes(param.key)) return [];
      return (
        <Popover
          key={param.key}
          placement="right"
          title={param.key}
          content={LeftTipContentElem(param.desc)}
        >
          <div className={style.param} onClick={() => onClick(param)}>
            {param.key}
          </div>
        </Popover>
      );
    });

    return paramList.length ? (
      <Popover
        placement="bottom"
        content={<div className={style["param-list"]}>{paramList}</div>}
      >
        <div className={style.operation}>
          <IconFont
            className="icon-interactive"
            style={{ width: 24 }}
            name="icon-xinghaoxiangqing-canshuduibi-jishucanshu-20"
            color={"#1296db"}
            size={26}
          />
        </div>
      </Popover>
    ) : null;
  }
);

// 已有字段
function ListValueElem(
  key: string,
  valueList: any[],
  onChange: (key: string, valueList: any[]) => void,
  onAdd: (key: string, valueList: any[]) => void,
  onDelete: (key: string, valueList: any[], index: number) => void,
  placeholder = "list",
  step = 0
) {
  if (!Array.isArray(valueList)) {
    valueList = [valueList];
  }
  const ListValue = valueList.map((value, index) => {
    return (
      <div key={index}>
        {step > 0 ? (
          <InputNumber
            placeholder={placeholder}
            style={{ flex: 1 }}
            value={value}
            step={step}
            onChange={(e) => {
              valueList[index] = e;
              onChange(key, valueList);
            }}
          />
        ) : (
          <TextArea
            placeholder={placeholder}
            value={JsonHelper.objToString(value) ?? value}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onChange={(e) => {
              valueList[index] = e.target.value;
              onChange(key, valueList);
            }}
          />
        )}
        {valueList.length > 1 ? (
          <div className={style.operation}>
            <IconFont
              className="icon-interactive"
              name={"icon-shanchu"}
              size={18}
              color={"#ff4a4a"}
              onClick={() => onDelete(key, valueList, index)}
            />
          </div>
        ) : null}
        {index === valueList.length - 1 ? (
          <div className={style.operation}>
            <IconFont
              className="icon-interactive"
              name={"icon-zengjiatianjiajiajian"}
              size={18}
              color={"#83be42"}
              onClick={() => onAdd(key, valueList)}
            />
          </div>
        ) : null}
      </div>
    );
  });
  return <div className={style["list-value"]}>{ListValue}</div>;
}
const ParamFieldListElem = memo(
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
    const [currentExpectedKey, setCurrentExpectedKey] = useState<string | null>(null);
    const [currentTemplateKey, setCurrentTemplateKey] = useState<string | null>(null);
    const [currentLowerKey, setCurrentLowerKey] = useState<string | null>(null);
    const [currentUpperKey, setCurrentUpperKey] = useState<string | null>(null);

    // 打开 ROI 配置面板
    const handleOpenROI = useCallback((key: string) => {
      if (connectionStatus !== "connected") {
        message.warning("请先连接设备");
        return;
      }
      setCurrentROIKey(key);
      setRoiModalOpen(true);
    }, [connectionStatus]);

    // 打开 OCR 配置面板
    const handleOpenOCR = useCallback((key: string) => {
      if (connectionStatus !== "connected") {
        message.warning("请先连接设备");
        return;
      }
      setCurrentExpectedKey(key);
      setOcrModalOpen(true);
    }, [connectionStatus]);

    // 打开模板配置面板
    const handleOpenTemplate = useCallback((key: string) => {
      if (connectionStatus !== "connected") {
        message.warning("请先连接设备");
        return;
      }
      setCurrentTemplateKey(key);
      setTemplateModalOpen(true);
    }, [connectionStatus]);

    // 打开颜色配置面板
    const handleOpenColor = useCallback((key: string, isUpper: boolean = false) => {
      if (connectionStatus !== "connected") {
        message.warning("请先连接设备");
        return;
      }
      setCurrentLowerKey(isUpper ? null : key);
      setCurrentUpperKey(isUpper ? key : null);
      setColorModalOpen(true);
    }, [connectionStatus]);

    // ROI 确认回调
    const handleROIConfirm = useCallback((roi: [number, number, number, number]) => {
      if (currentROIKey) {
        onChange(currentROIKey, roi);
      }
      setRoiModalOpen(false);
      setCurrentROIKey(null);
    }, [currentROIKey, onChange]);

    // OCR 确认回调
    const handleOCRConfirm = useCallback((text: string, roi?: [number, number, number, number]) => {
      if (currentExpectedKey) {
        onChange(currentExpectedKey, text);
      }
      setOcrModalOpen(false);
      setCurrentExpectedKey(null);
    }, [currentExpectedKey, onChange]);

    // 模板确认回调
    const handleTemplateConfirm = useCallback((templatePath: string, greenMask: boolean, roi?: [number, number, number, number]) => {
      if (currentTemplateKey) {
        onChange(currentTemplateKey, templatePath);
        // 如果有涂绿需要设置 green_mask 字段
        if (greenMask) {
          onChange("green_mask", true);
        }
      }
      setTemplateModalOpen(false);
      setCurrentTemplateKey(null);
    }, [currentTemplateKey, onChange]);

    // 颜色确认回调
    const handleColorConfirm = useCallback((lower: [number, number, number], upper: [number, number, number]) => {
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
    }, [currentLowerKey, currentUpperKey, onChange]);

    // 判断字段是否支持快速配置
    const supportsQuickConfig = useCallback((key: string): boolean => {
      return key === "roi" || key === "expected" || key === "template" || key === "lower" || key === "upper";
    }, []);

    // 渲染快速配置按钮
    const renderQuickConfigButton = useCallback((key: string) => {
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
    }, [supportsQuickConfig, connectionStatus, handleOpenROI, handleOpenOCR, handleOpenTemplate, handleOpenColor]);
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
            initialROI={paramData[currentROIKey] as [number, number, number, number] | undefined}
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

// Pipeline节点
const PipelineElem = lazy(() =>
  Promise.resolve({
    default: memo(({ currentNode }: { currentNode: PipelineNodeType }) => {
      const setNodeData = useFlowStore((state) => state.setNodeData);

      // 字段
      const recoOptions = useMemo(
        () =>
          Object.keys(recoFields).map((key) => ({
            label: key,
            value: key,
          })),
        []
      );
      const actionOptions = useMemo(
        () =>
          Object.keys(actionFields).map((key) => ({
            label: key,
            value: key,
          })),
        []
      );

      // 标题
      const currentLabel = useMemo(
        () => currentNode.data.label || "",
        [currentNode.data.label]
      );
      const onLabelChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          setNodeData(currentNode.id, "", "label", e.target.value);
        },
        [currentNode]
      );

      // 识别算法
      const currentRecoName = useMemo(
        () => currentNode.data.recognition.type || "DirectHit",
        [currentNode.data.recognition.type]
      );
      const currentReco = useMemo(
        () => recoFields[currentRecoName],
        [currentRecoName]
      );
      const handleRecoChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "type", "recognition", value);
        },
        [currentNode]
      );

      // 动作
      const currentActionName = useMemo(
        () => currentNode.data.action.type || "DoNothing",
        [currentNode.data.action.type]
      );
      const currentAction = useMemo(
        () => actionFields[currentActionName],
        [currentActionName]
      );
      const handleActionChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "type", "action", value);
        },
        [currentNode]
      );

      // 自定义节点
      const currentExtra = useMemo(() => {
        const extra = currentNode.data.extras;
        return JsonHelper.objToString(extra) ?? extra;
      }, [currentNode]);
      const handleExtraChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "extras", "extras", value);
        },
        [currentNode]
      );

      return (
        <div className={style.list}>
          {/* 节点名 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"key"}
              content={"节点名，会被编译为 pipeline 的 key。"}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                key
              </div>
            </Popover>
            <div className={style.value}>
              <Input
                placeholder="节点名"
                value={currentLabel}
                onChange={onLabelChange}
              />
            </div>
          </div>
          {/* 识别算法 */}
          <div className={style.item}>
            <Popover
              style={{ maxWidth: 10 }}
              placement="left"
              title={"recognition"}
              content={LeftTipContentElem(
                `识别算法(${currentRecoName})：${currentReco.desc}`
              )}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                recognition
              </div>
            </Popover>
            <div className={style.value}>
              <Select
                style={{ width: "100%" }}
                options={recoOptions}
                value={currentRecoName}
                onChange={handleRecoChange}
              />
            </div>
            {currentNode ? (
              <AddFieldElem
                paramType={currentReco.params}
                paramData={currentNode.data.recognition.param}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "recognition",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 算法字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.recognition.param}
              paramType={
                recoFields[currentNode.data.recognition.type]?.params || []
              }
              onChange={(key, value) =>
                setNodeData(currentNode.id, "recognition", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "recognition", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "recognition", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "recognition", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "recognition", key, valueList);
              }}
            />
          ) : null}
          {/* 动作类型 */}
          <div className={style.item}>
            <Popover
              style={{ maxWidth: 10 }}
              placement="left"
              title={"action"}
              content={LeftTipContentElem(
                `动作类型(${currentActionName})：${currentAction.desc}`
              )}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                action
              </div>
            </Popover>
            <div className={style.value}>
              <Select
                style={{ width: "100%" }}
                options={actionOptions}
                value={currentActionName}
                onChange={handleActionChange}
              />
            </div>
            {currentNode ? (
              <AddFieldElem
                paramType={currentAction.params}
                paramData={currentNode.data.action.param}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "action",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 动作字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.action.param}
              paramType={
                actionFields[currentNode.data.action.type]?.params || []
              }
              onChange={(key, value) =>
                setNodeData(currentNode.id, "action", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "action", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "action", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "action", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "action", key, valueList);
              }}
            />
          ) : null}
          {/* 其他 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"others"}
              content={"除 recognition 与 action 之外的字段"}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                others
              </div>
            </Popover>
            <div className={classNames([style.value, style.line])}>
              ————————————
            </div>
            {currentNode ? (
              <AddFieldElem
                paramType={otherFieldParams}
                paramData={currentNode.data.others}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "others",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 其他字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.others}
              paramType={otherFieldParams}
              onChange={(key, value) =>
                setNodeData(currentNode.id, "others", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "others", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "others", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "others", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "others", key, valueList);
              }}
            />
          ) : null}
          {/* 自定义字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"extras"}
              content={"自定义字段，JSON格式，会直接将一级字段渲染在节点上"}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                extras
              </div>
            </Popover>
            <div className={style.value}>
              <TextArea
                placeholder="自定义字段，完整 JSON 格式"
                autoSize={{ minRows: 1, maxRows: 6 }}
                value={currentExtra}
                onChange={(e) => handleExtraChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }),
  })
);

// External节点
const ExternalElem = memo(
  ({ currentNode }: { currentNode: ExternalNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );
    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "", "label", e.target.value);
      },
      [currentNode]
    );

    return (
      <div className={style.list}>
        {/* 节点名 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"key"}
            content={"节点名，转录时不会添加 prefix 前缀"}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              key
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="节点名 (转录时不会添加前缀)"
              value={currentLabel}
              onChange={onLabelChange}
            />
          </div>
        </div>
      </div>
    );
  }
);

// Anchor重定向节点
const AnchorElem = memo(({ currentNode }: { currentNode: AnchorNodeType }) => {
  const setNodeData = useFlowStore((state) => state.setNodeData);

  // 标题
  const currentLabel = useMemo(
    () => currentNode.data.label ?? "",
    [currentNode.data.label]
  );
  const onLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNodeData(currentNode.id, "", "label", e.target.value);
    },
    [currentNode]
  );

  return (
    <div className={style.list}>
      {/* 节点名 */}
      <div className={style.item}>
        <Popover
          placement="left"
          title={"key"}
          content={"重定向节点名，编译时会添加 [Anchor] 前缀"}
        >
          <div
            className={classNames([style.key, style["head-key"]])}
            style={{ width: 48 }}
          >
            key
          </div>
        </Popover>
        <div className={style.value}>
          <Input
            placeholder="重定向节点名 (编译时添加 [Anchor] 前缀)"
            value={currentLabel}
            onChange={onLabelChange}
          />
        </div>
      </div>
    </div>
  );
});

// 工具栏
const ToolBarElem = memo(
  ({
    nodeName,
    currentNode,
  }: {
    nodeName: string;
    currentNode: NodeType | null;
  }) => {
    const prefix = useFileStore((state) => state.currentFile.config.prefix);
    const addTemplate = useCustomTemplateStore((state) => state.addTemplate);
    const hasTemplate = useCustomTemplateStore((state) => state.hasTemplate);
    const updateTemplate = useCustomTemplateStore(
      (state) => state.updateTemplate
    );

    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [templateName, setTemplateName] = useState("");

    if (prefix) nodeName = prefix + "_" + nodeName;

    // 仅 Pipeline 节点显示保存按钮
    const showSaveButton =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    const handleSaveTemplate = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      setTemplateName(currentNode.data.label || "");
      setSaveModalVisible(true);
    };

    const handleSaveConfirm = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }

      const trimmedName = templateName.trim();

      // 名称验证
      if (!trimmedName) {
        message.error("模板名称不能为空");
        return;
      }

      if (trimmedName.length > 30) {
        message.error("模板名称长度不能超过30个字符");
        return;
      }

      // 检查名称重复
      if (hasTemplate(trimmedName)) {
        Modal.confirm({
          title: "模板名称已存在",
          content: `模板 "${trimmedName}" 已存在，是否覆盖？`,
          okText: "覆盖",
          cancelText: "重新输入",
          onOk: () => {
            updateTemplate(
              trimmedName,
              currentNode.data as PipelineNodeDataType
            );
            setSaveModalVisible(false);
          },
        });
      } else {
        const success = addTemplate(
          trimmedName,
          currentNode.data as PipelineNodeDataType
        );
        if (success) {
          setSaveModalVisible(false);
        }
      }
    };

    return (
      <>
        <div className={style.tools}>
          <Tooltip placement="top" title={"复制节点名"}>
            <IconFont
              className="icon-interactive"
              name="icon-xiaohongshubiaoti"
              size={24}
              onClick={() => {
                ClipboardHelper.write(nodeName);
              }}
            />
          </Tooltip>
          {showSaveButton && (
            <Tooltip placement="top" title="保存为模板">
              <IconFont
                className="icon-interactive"
                name="icon-biaodanmoban"
                size={24}
                onClick={handleSaveTemplate}
              />
            </Tooltip>
          )}
        </div>

        <Modal
          title="保存为模板"
          open={saveModalVisible}
          onOk={handleSaveConfirm}
          onCancel={() => setSaveModalVisible(false)}
          okText="保存"
          cancelText="取消"
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              是否将当前节点保存为自定义模板？
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ flexShrink: 0, fontSize: 14 }}>模板名</label>
              <Input
                placeholder="请输入模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onPressEnter={handleSaveConfirm}
                maxLength={30}
              />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            节点类型：Pipeline
          </div>
          <div style={{ fontSize: 12, color: "#999" }}>
            提示：保存后可从右键模板列表中选择已保存的模板
          </div>
        </Modal>
      </>
    );
  }
);

// 面板
function FieldPanel() {
  const currentNode = useFlowStore((state) => state.targetNode);

  // 内容
  const renderContent = useMemo(() => {
    if (!currentNode) return null;
    switch (currentNode.type) {
      case NodeTypeEnum.Pipeline:
        return (
          <Suspense
            fallback={
              <Spin tip="Loading..." size="large">
                <div className={style.spin}></div>
              </Spin>
            }
          >
            <PipelineElem currentNode={currentNode as PipelineNodeType} />
          </Suspense>
        );
      case NodeTypeEnum.External:
        return <ExternalElem currentNode={currentNode as ExternalNodeType} />;
      case NodeTypeEnum.Anchor:
        return <AnchorElem currentNode={currentNode as AnchorNodeType} />;
      default:
        return null;
    }
  }, [currentNode]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": currentNode !== null,
      }),
    [currentNode]
  );

  // 删除节点
  const handleDelete = useCallback(() => {
    if (currentNode) {
      const updateNodes = useFlowStore.getState().updateNodes;
      updateNodes([{ type: "remove", id: currentNode.id }]);
    }
  }, [currentNode]);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className="header-left">
          <ToolBarElem
            nodeName={currentNode?.data.label ?? ""}
            currentNode={currentNode}
          />
        </div>
        <div className="header-center">
          <div className="title">节点字段</div>
        </div>
        <div className="header-right">
          {currentNode && (
            <Tooltip placement="top" title="删除节点">
              <IconFont
                className="icon-interactive"
                name="icon-shanchu"
                size={20}
                color="#ff4a4a"
                onClick={handleDelete}
              />
            </Tooltip>
          )}
        </div>
      </div>
      {renderContent}
    </div>
  );
}

export default memo(FieldPanel);
