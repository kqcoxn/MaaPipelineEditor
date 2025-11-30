import type { FieldsType } from "../types";
import { recoFieldSchema } from "./schema";

/**
 * 识别字段配置
 */
export const recoFields: Record<string, FieldsType> = {
  DirectHit: {
    params: [],
    desc: "直接命中，即不进行识别，直接执行动作。",
  },
  OCR: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.ocrExpected,
      recoFieldSchema.ocrThreshold,
      recoFieldSchema.replace,
      recoFieldSchema.lengthOrderBy,
      recoFieldSchema.index,
      recoFieldSchema.onlyRec,
      recoFieldSchema.ocrModel,
    ],
    desc: "文字识别。",
  },
  TemplateMatch: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.template,
      recoFieldSchema.templateMatchThreshold,
      recoFieldSchema.baseOrderBy,
      recoFieldSchema.index,
      recoFieldSchema.templateMatchModes,
      recoFieldSchema.greenMask,
    ],
    desc: '模板匹配，即"找图"。',
  },
  ColorMatch: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.colorConversionCodes,
      recoFieldSchema.lower,
      recoFieldSchema.upper,
      recoFieldSchema.colorMatchCount,
      recoFieldSchema.areaOrderBy,
      recoFieldSchema.index,
    ],
    desc: '颜色匹配，即"找色"。',
  },
  Custom: {
    params: [
      recoFieldSchema.customRecognition,
      recoFieldSchema.customRecognitionParam,
      recoFieldSchema.customRoi,
      recoFieldSchema.roiOffset,
    ],
    desc: "执行通过 MaaResourceRegisterCustomRecognition 接口传入的识别器句柄。",
  },
  FeatureMatch: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.template,
      recoFieldSchema.featureMatchCount,
      recoFieldSchema.areaOrderBy,
      recoFieldSchema.index,
      recoFieldSchema.greenMask,
      recoFieldSchema.detector,
      recoFieldSchema.ratio,
    ],
    desc: '特征匹配，泛化能力更强的"找图"，具有抗透视、抗尺寸变化等特点。',
  },
  NeuralNetworkClassify: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.labels,
      recoFieldSchema.neuralNetworkClassifyModel,
      recoFieldSchema.neuralNetworkExpected,
      recoFieldSchema.baseOrderBy,
      recoFieldSchema.index,
    ],
    desc: '深度学习分类，判断图像中的 固定位置 是否为预期的"类别"。',
  },
  NeuralNetworkDetect: {
    params: [
      recoFieldSchema.roi,
      recoFieldSchema.roiOffset,
      recoFieldSchema.labels,
      recoFieldSchema.neuralNetworkDetectModel,
      recoFieldSchema.neuralNetworkExpected,
      recoFieldSchema.ocrThreshold,
      recoFieldSchema.areaOrderBy,
      recoFieldSchema.index,
    ],
    desc: '深度学习目标检测，高级版"找图"。与分类器主要区别在于"找"，即支持任意位置。但通常来说模型复杂度会更高，需要更多的训练集、训练时间，使用时的资源占用（推理开销）也会成倍上涨。',
  },
};
