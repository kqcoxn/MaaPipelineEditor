/**
 * 配置拆分与合并工具
 * 用于支持分离存储模式
 */

import type { PipelineObjType, MpeConfigType } from "./types";
import {
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
  anchorMarkPrefix,
} from "./types";

/**
 * 拆分 Pipeline 对象为纯 Pipeline 和配置
 * @param pipelineObj 完整的 Pipeline 对象(包含配置)
 * @returns { pipeline, config } 拆分后的对象
 */
export function splitPipelineAndConfig(pipelineObj: PipelineObjType): {
  pipeline: PipelineObjType;
  config: MpeConfigType;
} {
  const pipeline: PipelineObjType = {};
  const config: MpeConfigType = {
    file_config: {
      filename: "",
    },
    node_configs: {},
    external_nodes: {},
    anchor_nodes: {},
  };

  Object.entries(pipelineObj).forEach(([key, value]) => {
    // 文件配置节点
    if (key.startsWith(configMarkPrefix)) {
      const fileConfig = value[configMark];
      if (fileConfig) {
        config.file_config = {
          ...fileConfig,
          filename: fileConfig.filename || "",
        };
      }
    }
    // 外部节点
    else if (key.startsWith(externalMarkPrefix)) {
      const nodeName = key
        .replace(externalMarkPrefix, "")
        .split("_")
        .slice(0, -1)
        .join("_");
      config.external_nodes![nodeName] = value;
    }
    // 锚点节点
    else if (key.startsWith(anchorMarkPrefix)) {
      const nodeName = key
        .replace(anchorMarkPrefix, "")
        .split("_")
        .slice(0, -1)
        .join("_");
      config.anchor_nodes![nodeName] = value;
    }
    // 普通节点
    else {
      const nodeConfig = value[configMark];
      if (nodeConfig?.position) {
        config.node_configs[key] = { position: nodeConfig.position };
      }

      // 移除 $__mpe_code 后的节点数据
      const { [configMark]: _, ...pureNode } = value;
      pipeline[key] = pureNode;
    }
  });

  // 清理空对象
  if (Object.keys(config.external_nodes!).length === 0) {
    delete config.external_nodes;
  }
  if (Object.keys(config.anchor_nodes!).length === 0) {
    delete config.anchor_nodes;
  }

  return { pipeline, config };
}

/**
 * 合并 Pipeline 和配置为完整对象
 * @param pipeline 纯 Pipeline 对象
 * @param config MPE 配置对象
 * @param fileName 文件名
 * @returns 完整的 Pipeline 对象
 */
export function mergePipelineAndConfig(
  pipeline: PipelineObjType,
  config: MpeConfigType,
  fileName?: string
): PipelineObjType {
  const merged: PipelineObjType = {};

  // 添加文件配置节点
  const actualFileName = fileName || config.file_config.filename || "未命名";
  merged[configMarkPrefix + actualFileName] = {
    [configMark]: {
      ...config.file_config,
      filename: actualFileName,
    },
  };

  // 添加外部节点
  if (config.external_nodes) {
    Object.entries(config.external_nodes).forEach(([nodeName, nodeData]) => {
      merged[externalMarkPrefix + nodeName + "_" + actualFileName] = nodeData;
    });
  }

  // 添加锚点节点
  if (config.anchor_nodes) {
    Object.entries(config.anchor_nodes).forEach(([nodeName, nodeData]) => {
      merged[anchorMarkPrefix + nodeName + "_" + actualFileName] = nodeData;
    });
  }

  // 添加普通节点
  Object.entries(pipeline).forEach(([key, value]) => {
    const nodeConfig = config.node_configs[key];
    if (nodeConfig?.position) {
      merged[key] = {
        ...value,
        [configMark]: { position: nodeConfig.position },
      };
    } else {
      merged[key] = value;
    }
  });

  return merged;
}

/**
 * 生成配置文件名
 * @param fileName Pipeline 文件名
 * @returns 配置文件名
 */
export function getConfigFileName(fileName: string): string {
  // 移除扩展名
  const baseName = fileName.replace(/\.(json|jsonc)$/i, "");
  return `.${baseName}.mpe.json`;
}

/**
 * 从配置文件名推导 Pipeline 文件名
 * @param configFileName 配置文件名
 * @returns Pipeline 文件名
 */
export function getPipelineFileNameFromConfig(configFileName: string): string {
  // .my_task.mpe.json -> my_task
  return configFileName.replace(/^\./, "").replace(/\.mpe\.json$/i, "");
}
