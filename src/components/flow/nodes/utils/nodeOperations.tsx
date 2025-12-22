import { Modal, message } from "antd";
import { ClipboardHelper } from "../../../../utils/clipboard";
import { useFileStore } from "../../../../stores/fileStore";
import { useCustomTemplateStore } from "../../../../stores/customTemplateStore";
import { useFlowStore } from "../../../../stores/flow";
import type { PipelineNodeDataType } from "../../../../stores/flow";

/**
 * 复制节点名（通用工具函数）
 * @param nodeName 节点名称
 */
export function copyNodeName(nodeName: string): void {
  const fileStore = useFileStore.getState();
  const prefix = fileStore.currentFile.config.prefix;
  let fullName = nodeName;

  // 拼接前缀
  if (prefix) {
    fullName = prefix + "_" + nodeName;
  }

  ClipboardHelper.write(fullName);
}

/**
 * 保存节点为模板（通用工具函数）
 * @param nodeName 节点名称
 * @param nodeData 节点数据
 */
export function saveNodeAsTemplate(
  nodeName: string,
  nodeData: PipelineNodeDataType
): void {
  const templateStore = useCustomTemplateStore.getState();

  // 使用节点名作为默认模板名
  const defaultTemplateName = nodeName || "";
  let templateName = defaultTemplateName;

  // 创建输入框引用
  let inputElement: HTMLInputElement | null = null;

  Modal.confirm({
    title: "保存为模板",
    content: (
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>是否将当前节点保存为自定义模板？</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ flexShrink: 0, fontSize: 14 }}>模板名</label>
          <input
            ref={(el) => {
              inputElement = el;
              if (el) {
                el.value = defaultTemplateName;
                // 自动选中文本
                setTimeout(() => el.select(), 0);
              }
            }}
            type="text"
            placeholder="请输入模板名称"
            maxLength={30}
            style={{
              flex: 1,
              padding: "4px 11px",
              fontSize: 14,
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              outline: "none",
            }}
            onChange={(e) => {
              templateName = e.target.value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const okButton = document.querySelector(
                  ".ant-modal-confirm-btns .ant-btn-primary"
                ) as HTMLButtonElement;
                okButton?.click();
              }
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
          节点类型：Pipeline
        </div>
        <div style={{ fontSize: 12, color: "#999" }}>
          提示：保存后可从右键模板列表中选择已保存的模板
        </div>
      </div>
    ),
    okText: "保存",
    cancelText: "取消",
    onOk: () => {
      const trimmedName = templateName.trim();

      // 名称验证
      if (!trimmedName) {
        message.error("模板名称不能为空");
        return Promise.reject();
      }

      if (trimmedName.length > 30) {
        message.error("模板名称长度不能超过30个字符");
        return Promise.reject();
      }

      // 检查是否已存在
      if (templateStore.hasTemplate(trimmedName)) {
        return new Promise((resolve, reject) => {
          Modal.confirm({
            title: "模板名称已存在",
            content: `模板 "${trimmedName}" 已存在，是否覆盖？`,
            okText: "覆盖",
            cancelText: "重新输入",
            onOk: () => {
              templateStore.updateTemplate(trimmedName, nodeData);
              message.success("模板已更新");
              resolve(true);
            },
            onCancel: () => {
              reject();
            },
          });
        });
      } else {
        const success = templateStore.addTemplate(trimmedName, nodeData);
        if (success) {
          message.success("模板保存成功");
        }
        return Promise.resolve();
      }
    },
  });
}

/**
 * 删除节点（通用工具函数）
 * @param nodeId 节点ID
 */
export function deleteNode(nodeId: string): void {
  const flowStore = useFlowStore.getState();
  flowStore.updateNodes([{ type: "remove", id: nodeId }]);
}
