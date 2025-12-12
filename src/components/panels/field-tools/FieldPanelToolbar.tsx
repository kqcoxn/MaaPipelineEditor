import style from "../../../styles/FieldPanel.module.less";
import { memo, useState } from "react";
import { Tooltip, Modal, Input, message } from "antd";
import IconFont from "../../iconfonts";
import type {
  NodeType,
  PipelineNodeDataType,
} from "../../../stores/flow/types";
import { useFileStore } from "../../../stores/fileStore";
import { ClipboardHelper } from "../../../utils/clipboard";
import { useCustomTemplateStore } from "../../../stores/customTemplateStore";
import { NodeTypeEnum } from "../../flow/nodes";

export const FieldPanelToolbar = memo(
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
