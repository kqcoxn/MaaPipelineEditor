/**
 * 配置拆分与合并工具
 * 用于支持分离存储模式
 */

import type { PipelineObjType, MpeConfigType, NodeConfigType } from "./types";
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

  // 获取 filename
  Object.entries(pipelineObj).forEach(([key, value]) => {
    if (key.startsWith(configMarkPrefix)) {
      const fileConfig = value[configMark];
      if (fileConfig) {
        config.file_config = {
          ...fileConfig,
          filename: fileConfig.filename || "",
        };
      }
    }
  });

  const filename = config.file_config.filename;

  // 提取节点名
  const extractNodeName = (key: string, prefix: string): string => {
    const withoutPrefix = key.substring(prefix.length);
    // 优先使用 filename 后缀匹配
    const suffix = "_" + filename;
    if (filename && withoutPrefix.endsWith(suffix)) {
      return withoutPrefix.slice(0, -suffix.length);
    }
    // 按 _ 分割并移除最后一段
    return withoutPrefix.split("_").slice(0, -1).join("_");
  };

  // 从 $__mpe_code 提取节点配置
  const extractNodeConfig = (mpeCode: any): NodeConfigType | null => {
    if (!mpeCode?.position) return null;
    const nodeConfig: NodeConfigType = {
      position: mpeCode.position,
    };
    if (mpeCode.handleDirection) {
      nodeConfig.handleDirection = mpeCode.handleDirection;
    }
    return nodeConfig;
  };

  // 处理节点
  Object.entries(pipelineObj).forEach(([key, value]) => {
    // 跳过已处理的文件配置节点
    if (key.startsWith(configMarkPrefix)) {
      return;
    }
    // 外部节点
    else if (key.startsWith(externalMarkPrefix)) {
      const nodeName = extractNodeName(key, externalMarkPrefix);
      const mpeCode = value[configMark];
      const nodeConfig = extractNodeConfig(mpeCode);
      config.external_nodes![nodeName] = nodeConfig ?? { position: { x: 0, y: 0 } };
    }
    // 锚点节点
    else if (key.startsWith(anchorMarkPrefix)) {
      const nodeName = extractNodeName(key, anchorMarkPrefix);
      const mpeCode = value[configMark];
      const nodeConfig = extractNodeConfig(mpeCode);
      config.anchor_nodes![nodeName] = nodeConfig ?? { position: { x: 0, y: 0 } };
    }
    // 普通节点
    else {
      const mpeCode = value[configMark];
      const nodeConfig = extractNodeConfig(mpeCode);
      if (nodeConfig) {
        config.node_configs[key] = nodeConfig;
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

  // 将节点配置转换为 $__mpe_code
  const buildMpeCode = (nodeData: any): Record<string, any> => {
    // 新格式：直接包含 position 和 handleDirection
    if (nodeData?.position) {
      const mpeCode: Record<string, any> = { position: nodeData.position };
      if (nodeData.handleDirection) {
        mpeCode.handleDirection = nodeData.handleDirection;
      }
      return mpeCode;
    }
    // 旧格式：包含 $__mpe_code 包装层
    if (nodeData?.[configMark]) {
      return nodeData[configMark];
    }
    return { position: { x: 0, y: 0 } };
  };

  // 添加外部节点
  if (config.external_nodes) {
    Object.entries(config.external_nodes).forEach(([nodeName, nodeData]) => {
      merged[externalMarkPrefix + nodeName + "_" + actualFileName] = {
        [configMark]: buildMpeCode(nodeData),
      };
    });
  }

  // 添加锚点节点
  if (config.anchor_nodes) {
    Object.entries(config.anchor_nodes).forEach(([nodeName, nodeData]) => {
      merged[anchorMarkPrefix + nodeName + "_" + actualFileName] = {
        [configMark]: buildMpeCode(nodeData),
      };
    });
  }

  // 添加普通节点
  Object.entries(pipeline).forEach(([key, value]) => {
    const nodeConfig = config.node_configs[key];
    if (nodeConfig?.position) {
      const mpeCode: Record<string, any> = { position: nodeConfig.position };
      if (nodeConfig.handleDirection) {
        mpeCode.handleDirection = nodeConfig.handleDirection;
      }
      merged[key] = {
        ...value,
        [configMark]: mpeCode,
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
