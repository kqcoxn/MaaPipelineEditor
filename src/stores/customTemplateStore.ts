import { create } from "zustand";
import { message } from "antd";
import type { NodeTemplateType } from "../data/nodeTemplates";
import type { PipelineNodeDataType } from "./flow/types";
import { NodeTypeEnum } from "../components/flow/nodes";

// 存储结构
interface StoredTemplate {
  label: string;
  nodeType: NodeTypeEnum;
  data: Omit<PipelineNodeDataType, "label">;
  createTime: number;
}

interface StorageData {
  version: string;
  templates: StoredTemplate[];
}

const STORAGE_KEY = "custom-node-templates";
const STORAGE_VERSION = "1.0";
const MAX_TEMPLATES = 50;

interface CustomTemplateState {
  customTemplates: NodeTemplateType[];
  isLoaded: boolean;

  // 加载模板
  loadTemplates: () => void;

  // 添加新模板
  addTemplate: (label: string, nodeData: PipelineNodeDataType) => boolean;

  // 删除指定模板
  removeTemplate: (label: string) => void;

  // 更新已有模板
  updateTemplate: (label: string, nodeData: PipelineNodeDataType) => void;

  // 获取所有模板
  getAllTemplates: (presetTemplates: NodeTemplateType[]) => NodeTemplateType[];

  // 检查模板名称是否存在
  hasTemplate: (label: string) => boolean;
}

export const useCustomTemplateStore = create<CustomTemplateState>(
  (set, get) => ({
    customTemplates: [],
    isLoaded: false,

    loadTemplates: () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          set({ customTemplates: [], isLoaded: true });
          return;
        }

        const data: StorageData = JSON.parse(stored);

        // 版本检查
        if (data.version !== STORAGE_VERSION) {
          console.warn(
            `模板数据版本不匹配: ${data.version} != ${STORAGE_VERSION}, 尝试迁移或清空`
          );
          // 清空旧版本数据
          localStorage.removeItem(STORAGE_KEY);
          set({ customTemplates: [], isLoaded: true });
          return;
        }

        // 转换为 NodeTemplateType
        const templates: NodeTemplateType[] = data.templates.map(
          (template) => ({
            label: template.label,
            iconName: "icon-biaodanmoban",
            iconSize: 24,
            nodeType: NodeTypeEnum.Pipeline,
            data: () => JSON.parse(JSON.stringify(template.data)),
            isCustom: true,
            createTime: template.createTime,
          })
        );

        // 按创建时间倒序排列
        templates.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

        set({ customTemplates: templates, isLoaded: true });
        console.log(`已加载 ${templates.length} 个自定义模板`);
      } catch (error) {
        console.error("加载自定义模板失败:", error);
        message.warning("加载自定义模板失败，已清空损坏数据");
        localStorage.removeItem(STORAGE_KEY);
        set({ customTemplates: [], isLoaded: true });
      }
    },

    addTemplate: (label: string, nodeData: PipelineNodeDataType) => {
      const { customTemplates } = get();

      // 数量限制检查
      if (customTemplates.length >= MAX_TEMPLATES) {
        message.error(
          `自定义模板数量已达上限（${MAX_TEMPLATES}个），请先删除旧模板`
        );
        return false;
      }

      // 名称验证
      if (!label || label.trim().length === 0) {
        message.error("模板名称不能为空");
        return false;
      }

      if (label.length > 30) {
        message.error("模板名称长度不能超过30个字符");
        return false;
      }

      const createTime = Date.now();

      // 序列化节点数据（仅保留必要字段，不包含 label）
      const { label: _removed, ...nodeDataWithoutLabel } = nodeData;
      const templateData = {
        recognition: JSON.parse(
          JSON.stringify(nodeDataWithoutLabel.recognition)
        ),
        action: JSON.parse(JSON.stringify(nodeDataWithoutLabel.action)),
        others: JSON.parse(JSON.stringify(nodeDataWithoutLabel.others)),
        extras: nodeDataWithoutLabel.extras
          ? JSON.parse(JSON.stringify(nodeDataWithoutLabel.extras))
          : undefined,
      };

      const newTemplate: NodeTemplateType = {
        label,
        iconName: "icon-biaodanmoban",
        iconSize: 24,
        nodeType: NodeTypeEnum.Pipeline,
        data: () => JSON.parse(JSON.stringify(templateData)),
        isCustom: true,
        createTime,
      };

      const newTemplates = [newTemplate, ...customTemplates];
      set({ customTemplates: newTemplates });

      // 保存到 localStorage
      try {
        const storedTemplates: StoredTemplate[] = newTemplates.map((t) => ({
          label: t.label,
          nodeType: t.nodeType || NodeTypeEnum.Pipeline,
          data: t.data?.() || ({} as PipelineNodeDataType),
          createTime: t.createTime || Date.now(),
        }));

        const storageData: StorageData = {
          version: STORAGE_VERSION,
          templates: storedTemplates,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        message.success("模板已保存");
        return true;
      } catch (error) {
        console.error("保存模板到 localStorage 失败:", error);
        message.error("保存模板失败，请检查浏览器存储空间");
        // 回滚
        set({ customTemplates });
        return false;
      }
    },

    removeTemplate: (label: string) => {
      const { customTemplates } = get();
      const newTemplates = customTemplates.filter((t) => t.label !== label);

      set({ customTemplates: newTemplates });

      // 更新 localStorage
      try {
        const storedTemplates: StoredTemplate[] = newTemplates.map((t) => ({
          label: t.label,
          nodeType: t.nodeType || NodeTypeEnum.Pipeline,
          data: t.data?.() || ({} as PipelineNodeDataType),
          createTime: t.createTime || Date.now(),
        }));

        const storageData: StorageData = {
          version: STORAGE_VERSION,
          templates: storedTemplates,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        message.info("模板已删除");
      } catch (error) {
        console.error("删除模板失败:", error);
        message.error("删除模板失败");
        // 回滚
        set({ customTemplates });
      }
    },

    updateTemplate: (label: string, nodeData: PipelineNodeDataType) => {
      const { customTemplates, removeTemplate, addTemplate } = get();
      const existingTemplate = customTemplates.find((t) => t.label === label);

      if (existingTemplate) {
        removeTemplate(label);
        addTemplate(label, nodeData);
      }
    },

    getAllTemplates: (presetTemplates: NodeTemplateType[]) => {
      const { customTemplates } = get();

      // 排序
      const emptyTemplate = presetTemplates.find((t) => t.label === "空节点");
      const otherPresetTemplates = presetTemplates.filter(
        (t) => t.label !== "空节点"
      );

      const result: NodeTemplateType[] = [];

      if (emptyTemplate) {
        result.push(emptyTemplate);
      }

      result.push(...customTemplates);
      result.push(...otherPresetTemplates);

      return result;
    },

    hasTemplate: (label: string) => {
      const { customTemplates } = get();
      return customTemplates.some((t) => t.label === label);
    },
  })
);
