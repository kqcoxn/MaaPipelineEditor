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
  stickerMarkPrefix,
  groupMarkPrefix,
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
    sticker_nodes: {},
    group_nodes: {},
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
      config.external_nodes![nodeName] = nodeConfig ?? {
        position: { x: 0, y: 0 },
      };
    }
    // Anchor 节点
    else if (key.startsWith(anchorMarkPrefix)) {
      const nodeName = extractNodeName(key, anchorMarkPrefix);
      const mpeCode = value[configMark];
      const nodeConfig = extractNodeConfig(mpeCode);
      config.anchor_nodes![nodeName] = nodeConfig ?? {
        position: { x: 0, y: 0 },
      };
    }
    // 便签节点
    else if (key.startsWith(stickerMarkPrefix)) {
      const nodeName = extractNodeName(key, stickerMarkPrefix);
      const mpeCode = value[configMark];
      config.sticker_nodes![nodeName] = mpeCode ?? { position: { x: 0, y: 0 } };
    }
    // 分组节点
    else if (key.startsWith(groupMarkPrefix)) {
      const nodeName = extractNodeName(key, groupMarkPrefix);
      const mpeCode = value[configMark];
      config.group_nodes![nodeName] = mpeCode ?? { position: { x: 0, y: 0 } };
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
  if (Object.keys(config.sticker_nodes!).length === 0) {
    delete config.sticker_nodes;
  }
  if (Object.keys(config.group_nodes!).length === 0) {
    delete config.group_nodes;
  }

  return { pipeline, config };
}

/**
 * 合并 Pipeline 和配置为完整对象
 * @param pipeline 纯 Pipeline 对象
 * @param config MPE 配置对象
 * @param fileName 文件名
 * @param keyOrder 可选的键顺序，用于保持原始 JSON 顺序
 * @returns 完整的 Pipeline 对象
 */
export function mergePipelineAndConfig(
  pipeline: PipelineObjType,
  config: MpeConfigType,
  fileName?: string,
  keyOrder?: string[]
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

  // 构建外部节点映射
  const externalNodesMap = new Map<string, { key: string; data: any }>();
  if (config.external_nodes) {
    Object.entries(config.external_nodes).forEach(([nodeName, nodeData]) => {
      externalNodesMap.set(nodeName, {
        key: externalMarkPrefix + nodeName + "_" + actualFileName,
        data: nodeData,
      });
    });
  }

  // 构建 Anchor 节点映射
  const anchorNodesMap = new Map<string, { key: string; data: any }>();
  if (config.anchor_nodes) {
    Object.entries(config.anchor_nodes).forEach(([nodeName, nodeData]) => {
      anchorNodesMap.set(nodeName, {
        key: anchorMarkPrefix + nodeName + "_" + actualFileName,
        data: nodeData,
      });
    });
  }

  // 构建便签节点映射
  const stickerNodesMap = new Map<string, { key: string; data: any }>();
  if (config.sticker_nodes) {
    Object.entries(config.sticker_nodes).forEach(([nodeName, nodeData]) => {
      stickerNodesMap.set(nodeName, {
        key: stickerMarkPrefix + nodeName + "_" + actualFileName,
        data: nodeData,
      });
    });
  }

  // 构建分组节点映射
  const groupNodesMap = new Map<string, { key: string; data: any }>();
  if (config.group_nodes) {
    Object.entries(config.group_nodes).forEach(([nodeName, nodeData]) => {
      groupNodesMap.set(nodeName, {
        key: groupMarkPrefix + nodeName + "_" + actualFileName,
        data: nodeData,
      });
    });
  }

  // 已添加的键集合
  const addedKeys = new Set<string>();
  addedKeys.add(configMarkPrefix + actualFileName);

  // 提供了键顺序时按该顺序输出
  if (keyOrder && keyOrder.length > 0) {
    keyOrder.forEach((originalKey) => {
      // 跳过配置键和已添加的键
      if (
        originalKey.startsWith(configMarkPrefix) ||
        originalKey.startsWith("__mpe_config_") ||
        originalKey.startsWith("__yamaape_config_")
      ) {
        return;
      }

      // 检查是否是外部节点
      if (originalKey.startsWith(externalMarkPrefix)) {
        const nodeInfo = externalNodesMap.get(
          extractNodeNameFromKey(
            originalKey,
            externalMarkPrefix,
            actualFileName
          )
        );
        if (nodeInfo && !addedKeys.has(nodeInfo.key)) {
          merged[nodeInfo.key] = {
            [configMark]: buildMpeCode(nodeInfo.data),
          };
          addedKeys.add(nodeInfo.key);
        }
        return;
      }

      // 检查是否是 Anchor 节点
      if (originalKey.startsWith(anchorMarkPrefix)) {
        const nodeInfo = anchorNodesMap.get(
          extractNodeNameFromKey(originalKey, anchorMarkPrefix, actualFileName)
        );
        if (nodeInfo && !addedKeys.has(nodeInfo.key)) {
          merged[nodeInfo.key] = {
            [configMark]: buildMpeCode(nodeInfo.data),
          };
          addedKeys.add(nodeInfo.key);
        }
        return;
      }

      // 检查是否是便签节点
      if (originalKey.startsWith(stickerMarkPrefix)) {
        const nodeInfo = stickerNodesMap.get(
          extractNodeNameFromKey(originalKey, stickerMarkPrefix, actualFileName)
        );
        if (nodeInfo && !addedKeys.has(nodeInfo.key)) {
          merged[nodeInfo.key] = {
            [configMark]: nodeInfo.data,
          };
          addedKeys.add(nodeInfo.key);
        }
        return;
      }

      // 检查是否是分组节点
      if (originalKey.startsWith(groupMarkPrefix)) {
        const nodeInfo = groupNodesMap.get(
          extractNodeNameFromKey(originalKey, groupMarkPrefix, actualFileName)
        );
        if (nodeInfo && !addedKeys.has(nodeInfo.key)) {
          merged[nodeInfo.key] = {
            [configMark]: nodeInfo.data,
          };
          addedKeys.add(nodeInfo.key);
        }
        return;
      }

      // 普通节点
      const nodeConfig = config.node_configs?.[originalKey];
      const pipelineValue = pipeline[originalKey];
      if (pipelineValue !== undefined) {
        if (nodeConfig?.position) {
          const mpeCode: Record<string, any> = {
            position: nodeConfig.position,
          };
          if (nodeConfig.handleDirection) {
            mpeCode.handleDirection = nodeConfig.handleDirection;
          }
          merged[originalKey] = {
            ...pipelineValue,
            [configMark]: mpeCode,
          };
        } else {
          merged[originalKey] = pipelineValue;
        }
        addedKeys.add(originalKey);
      }
    });
  } else {
    // 添加外部节点
    if (config.external_nodes) {
      Object.entries(config.external_nodes).forEach(([nodeName, nodeData]) => {
        const key = externalMarkPrefix + nodeName + "_" + actualFileName;
        if (!addedKeys.has(key)) {
          merged[key] = {
            [configMark]: buildMpeCode(nodeData),
          };
          addedKeys.add(key);
        }
      });
    }

    // 添加 Anchor 节点
    if (config.anchor_nodes) {
      Object.entries(config.anchor_nodes).forEach(([nodeName, nodeData]) => {
        const key = anchorMarkPrefix + nodeName + "_" + actualFileName;
        if (!addedKeys.has(key)) {
          merged[key] = {
            [configMark]: buildMpeCode(nodeData),
          };
          addedKeys.add(key);
        }
      });
    }

    // 添加便签节点
    if (config.sticker_nodes) {
      Object.entries(config.sticker_nodes).forEach(([nodeName, nodeData]) => {
        const key = stickerMarkPrefix + nodeName + "_" + actualFileName;
        if (!addedKeys.has(key)) {
          merged[key] = {
            [configMark]: nodeData,
          };
          addedKeys.add(key);
        }
      });
    }

    // 添加分组节点
    if (config.group_nodes) {
      Object.entries(config.group_nodes).forEach(([nodeName, nodeData]) => {
        const key = groupMarkPrefix + nodeName + "_" + actualFileName;
        if (!addedKeys.has(key)) {
          merged[key] = {
            [configMark]: nodeData,
          };
          addedKeys.add(key);
        }
      });
    }

    // 添加普通节点
    Object.entries(pipeline).forEach(([key, value]) => {
      if (addedKeys.has(key)) return;
      const nodeConfig = config.node_configs?.[key];
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
  }

  return merged;
}

/**
 * 从节点键中提取节点名
 */
function extractNodeNameFromKey(
  key: string,
  prefix: string,
  fileName: string
): string {
  const withoutPrefix = key.substring(prefix.length);
  const suffix = "_" + fileName;
  if (fileName && withoutPrefix.endsWith(suffix)) {
    return withoutPrefix.slice(0, -suffix.length);
  }
  return withoutPrefix;
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
