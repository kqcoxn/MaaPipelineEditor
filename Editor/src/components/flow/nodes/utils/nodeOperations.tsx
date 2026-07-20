import { Modal, message } from "antd";
import uiT from "../../../../i18n/translate";
import { ClipboardHelper } from "../../../../utils/ui/clipboard";
import { useFileStore } from "../../../../stores/fileStore";
import { useCustomTemplateStore } from "../../../../stores/customTemplateStore";
import { useFlowStore } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { parsePipelineNodeForExport } from "../../../../core/parser/nodeParser";
import type { PipelineNodeType } from "../../../../core/parser/types";
import { NodeTypeEnum } from "../constants";

/**
 * 复制节点名（通用工具函数）
 * @param nodeName 节点名称
 * @param nodeType 节点类型（可选）
 */
export function copyNodeName(nodeName: string, nodeType?: NodeTypeEnum): void {
  const fileStore = useFileStore.getState();
  const prefix = fileStore.currentFile.config.prefix;
  let fullName = nodeName;

  // 拼接前缀
  if (prefix && nodeType === NodeTypeEnum.Pipeline) {
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
  nodeData: PipelineNodeDataType,
): void {
  const templateStore = useCustomTemplateStore.getState();

  // 使用节点名作为默认模板名
  const defaultTemplateName = nodeName || "";
  let templateName = defaultTemplateName;

  Modal.confirm({
    title: uiT("ui.flow.nodeOperations.saveAsTemplateTitle", "保存为模板"),
    content: (
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          {uiT(
            "ui.flow.nodeOperations.saveAsTemplateConfirm",
            "是否将当前节点保存为自定义模板？",
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ flexShrink: 0, fontSize: 14 }}>
            {uiT("ui.flow.nodeOperations.templateNameLabel", "模板名")}
          </label>
          <input
            ref={(el) => {
              if (el) {
                el.value = defaultTemplateName;
                // 自动选中文本
                setTimeout(() => el.select(), 0);
              }
            }}
            type="text"
            placeholder={uiT(
              "ui.flow.nodeOperations.templateNamePlaceholder",
              "请输入模板名称",
            )}
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
                  ".ant-modal-confirm-btns .ant-btn-primary",
                ) as HTMLButtonElement;
                okButton?.click();
              }
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
          {uiT("ui.flow.nodeOperations.nodeTypePipeline", "节点类型：Pipeline")}
        </div>
        <div style={{ fontSize: 12, color: "#999" }}>
          {uiT(
            "ui.flow.nodeOperations.saveAsTemplateHint",
            "提示：保存后可从右键模板列表中选择已保存的模板",
          )}
        </div>
      </div>
    ),
    okText: uiT("ui.flow.nodeOperations.save", "保存"),
    cancelText: uiT("ui.flow.nodeOperations.cancel", "取消"),
    onOk: () => {
      const trimmedName = templateName.trim();

      // 名称验证
      if (!trimmedName) {
        message.error(
          uiT("ui.flow.nodeOperations.templateNameEmpty", "模板名称不能为空"),
        );
        return Promise.reject();
      }

      if (trimmedName.length > 30) {
        message.error(
          uiT(
            "ui.flow.nodeOperations.templateNameTooLong",
            "模板名称长度不能超过30个字符",
          ),
        );
        return Promise.reject();
      }

      // 检查是否已存在
      if (templateStore.hasTemplate(trimmedName)) {
        return new Promise((resolve, reject) => {
          Modal.confirm({
            title: uiT(
              "ui.flow.nodeOperations.templateExistsTitle",
              "模板名称已存在",
            ),
            content: uiT(
              "ui.flow.nodeOperations.templateExistsContent",
              '模板 "{{name}}" 已存在，是否覆盖？',
              { name: trimmedName },
            ),
            okText: uiT("ui.flow.nodeOperations.overwrite", "覆盖"),
            cancelText: uiT("ui.flow.nodeOperations.reenter", "重新输入"),
            onOk: () => {
              templateStore.updateTemplate(trimmedName, nodeData);
              message.success(
                uiT("ui.flow.nodeOperations.templateUpdated", "模板已更新"),
              );
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
          message.success(
            uiT("ui.flow.nodeOperations.templateSaved", "模板保存成功"),
          );
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
export async function deleteNode(nodeId: string): Promise<void> {
  const flowStore = useFlowStore.getState();
  const { instance, edges } = flowStore;

  if (instance) {
    const nodeToDelete = flowStore.nodes.find((n) => n.id === nodeId);
    if (nodeToDelete) {
      await instance.deleteElements({ nodes: [nodeToDelete] });
      return;
    }
  }

  const connectedEdgeIds = edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => edge.id);

  if (connectedEdgeIds.length > 0) {
    flowStore.updateEdges(
      connectedEdgeIds.map((id) => ({ id, type: "remove" as const })),
    );
  }

  flowStore.updateNodes([{ type: "remove", id: nodeId }]);
}

/**
 * 复制节点的 Recognition JSON（通用工具函数）
 * @param nodeId 节点ID
 */
export function copyNodeRecoJSON(nodeId: string): void {
  const flowStore = useFlowStore.getState();
  const node = flowStore.nodes.find((n) => n.id === nodeId) as
    | PipelineNodeType
    | undefined;

  if (!node || node.type !== "pipeline") {
    message.error(
      uiT(
        "ui.flow.nodeOperations.copyRecoJsonPipelineOnly",
        "仅支持 Pipeline 节点复制 Reco JSON",
      ),
    );
    return;
  }

  try {
    // 使用编译器解析节点
    const parsedNode = parsePipelineNodeForExport(node, flowStore.nodes);

    // 提取 recognition 和 param
    const recoJSON = parsedNode.recognition || {};

    // 复制到剪贴板
    const indent = useConfigStore.getState().configs.jsonIndent;
    const jsonString = JSON.stringify(recoJSON, null, indent);
    ClipboardHelper.write(jsonString, {
      successMsg: uiT(
        "ui.flow.nodeOperations.recoJsonCopied",
        "Reco JSON 已复制到剪贴板",
      ),
    });
  } catch (error) {
    console.error("Failed to copy Reco JSON:", error);
    message.error(
      uiT(
        "ui.flow.nodeOperations.copyRecoJsonFailed",
        "复制失败，请检查节点配置是否正确",
      ),
    );
  }
}
