import { FieldTypeEnum } from "../fieldTypes";
import type { FieldType } from "../types";

/**
 * 识别字段 Schema 定义
 */
export const recoFieldSchema: Record<string, FieldType> = {
  // 通用字段
  roi: {
    key: "roi",
    type: [FieldTypeEnum.XYWH, FieldTypeEnum.String],
    default: [0, 0, 0, 0],
    desc: "识别区域坐标。可选，默认 [0, 0, 0, 0] ，即全屏。array<int, 4>: 识别区域坐标，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。string: 填写节点名，在之前执行过的某节点识别到的目标范围内识别。",
  },
  roiOffset: {
    key: "roi_offset",
    type: FieldTypeEnum.XYWH,
    default: [0, 0, 0, 0],
    desc: "在 roi 的基础上额外移动再作为范围，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  index: {
    key: "index",
    type: FieldTypeEnum.Int,
    default: 0,
    desc: `命中第几个结果。可选，默认 0 。 假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类 Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。`,
  },

  // 模板匹配字段
  template: {
    key: "template",
    type: [FieldTypeEnum.ImagePathList, FieldTypeEnum.ImagePath],
    required: true,
    default: [""],
    desc: `模板图片路径，需要 image 文件夹的相对路径。必选。所使用的图片需要是无损原图缩放到 720p 后的裁剪。支持填写文件夹路径，将递归加载其中所有图片文件。`,
  },
  templateMatchThreshold: {
    key: "threshold",
    type: [FieldTypeEnum.DoubleList, FieldTypeEnum.Double],
    default: [0.7],
    step: 0.01,
    desc: `模板匹配阈值。可选，默认 0.7 。若为数组，长度需和 template 数组长度相同。`,
  },
  templateMatchModes: {
    key: "method",
    type: FieldTypeEnum.Int,
    options: [10001, 3, 5],
    default: 5,
    desc: `模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5 。 详情请参考 OpenCV 官方文档。 10001 为 TM_SQDIFF_NORMED 的反转版本，分数越高越匹配（与原版相反）。`,
  },
  greenMask: {
    key: "green_mask",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: `是否进行绿色掩码。可选，默认 false 。 若为 true，可以将图片中不希望匹配的部分涂绿 RGB: (0, 255, 0)，则不对绿色部分进行匹配。`,
  },

  // 排序字段
  baseOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Score", "Random"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal。 可选的值：Horizontal | Vertical | Score | Random 。 可结合 index 字段使用。`,
  },
  areaOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Score", "Area", "Random"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal。 可选的值：Horizontal | Vertical | Score | Area | Random 。 可结合 index 字段使用。`,
  },
  expectedOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Score", "Random", "Expected"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal 。 可选的值：Horizontal | Vertical | Score | Random | Expected 。 可结合 index 字段使用。`,
  },
  areaExpectedOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Score", "Area", "Random", "Expected"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal 。 可选的值：Horizontal | Vertical | Score | Area | Random | Expected 。 可结合 index 字段使用。`,
  },
  lengthExpectedOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Area", "Length", "Random", "Expected"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal。 可选的值：Horizontal | Vertical | Area | Length | Random | Expected 。 可结合 index 字段使用。`,
  },

  // 特征匹配字段
  featureMatchCount: {
    key: "count",
    type: FieldTypeEnum.Int,
    default: 4,
    desc: `匹配的特征点的最低数量要求（阈值）。可选，默认 4 。`,
  },
  detector: {
    key: "detector",
    type: FieldTypeEnum.String,
    options: ["SIFT", "KAZE", "AKAZE", "BRISK", "BRISK", "ORB"],
    default: "SIFT",
    desc: `匹配的特征点的最低数量要求（阈值）。可选，默认 4 。目前支持以下算法：SIFT-计算复杂度高，具有尺度不变性、旋转不变性。效果最好；KAZE-适用于2D和3D图像，具有尺度不变性、旋转不变性；AKAZE-计算速度较快，具有尺度不变性、旋转不变性；BRISK-计算速度非常快，具有尺度不变性、旋转不变性；ORB-计算速度非常快，具有旋转不变性。但不具有尺度不变性。各算法特点详情可自行进一步查询。`,
  },
  ratio: {
    key: "ratio",
    type: FieldTypeEnum.Double,
    default: 0.6,
    step: 0.01,
    desc: `KNN 匹配算法的距离比值，[0 - 1.0] , 越大则匹配越宽松（更容易连线）。可选，默认 0.6 。`,
  },

  // 颜色匹配字段
  colorConversionCodes: {
    key: "method",
    type: FieldTypeEnum.Int,
    default: 4,
    desc: `颜色匹配方式。即 cv::ColorConversionCodes。可选，默认 4 (RGB) 。常用值：4 (RGB, 3 通道), 40 (HSV, 3 通道), 6 (GRAY, 1 通道)。`,
  },
  lower: {
    key: "lower",
    type: [FieldTypeEnum.IntListList, FieldTypeEnum.IntList],
    required: true,
    default: [[0, 0, 0]],
    desc: `颜色下限值。必选。最内层 list 长度需和 method 的通道数一致。`,
  },
  upper: {
    key: "upper",
    type: [FieldTypeEnum.IntListList, FieldTypeEnum.IntList],
    required: true,
    default: [[255, 255, 255]],
    desc: `颜色上限值。必选。最内层 list 长度需和 method 的通道数一致。`,
  },
  colorMatchCount: {
    key: "count",
    type: FieldTypeEnum.Int,
    default: 1,
    desc: `符合的像素点的最低数量要求（阈值）。可选，默认 1。`,
  },
  connected: {
    key: "connected",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: `是否是相连的点才会被计数。可选，默认 false 。若为是，在完成颜色过滤后，则只会计数像素点 全部相连 的最大块。若为否，则不考虑这些像素点是否相连。`,
  },

  // OCR 字段
  ocrExpected: {
    key: "expected",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    required: true,
    default: [""],
    desc: `期望的结果，支持正则。必选。`,
  },
  ocrThreshold: {
    key: "threshold",
    type: FieldTypeEnum.Double,
    default: 0.3,
    step: 0.01,
    desc: `模型置信度阈值。可选，默认 0.3 。`,
  },
  replace: {
    key: "replace",
    type: [FieldTypeEnum.StringPairList, FieldTypeEnum.StringPair],
    default: [["origin", "target"]],
    desc: `部分文字识别结果不准确，进行替换。可选。`,
  },
  onlyRec: {
    key: "only_rec",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: `是否仅识别（不进行检测，需要精确设置 roi）。可选，默认 false 。`,
  },
  ocrModel: {
    key: "model",
    type: FieldTypeEnum.String,
    default: "",
    desc: `模型 文件夹 路径。使用 model/ocr 文件夹的相对路径。可选，默认为空。 若为空，则为 model/ocr 根目录下的模型文件。 文件夹中需要包含 rec.onnx, det.onnx, keys.txt 三个文件。`,
  },

  // 神经网络字段
  labels: {
    key: "labels",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    default: [""],
    desc: `标注，即每个分类的名字。可选。 仅影响调试图片及日志等，若未填写则会填充 "Unknown" 。`,
  },
  neuralNetworkClassifyModel: {
    key: "model",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: `模型文件路径。使用 model/classify 文件夹的相对路径。必选。 目前仅支持 ONNX 模型，参考 NNClassify 食谱。`,
  },
  neuralNetworkExpected: {
    key: "expected",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    required: true,
    default: [0],
    step: 1,
    desc: `期望的分类下标。必选。`,
  },
  neuralNetworkDetectModel: {
    key: "model",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: `模型文件路径。使用 model/detect 文件夹的相对路径。必选。 目前支持 YoloV8 ONNX 模型，其他同样输入输出的 Yolo 模型理论上也可以支持，但未经测试。`,
  },

  // 组合识别
  allOf: {
    key: "all_of",
    type: FieldTypeEnum.ObjectList,
    required: true,
    default: [{}, {}],
    desc: "子识别列表。所有子识别都命中才算成功。必选。 列表元素写法与普通节点的 recognition 一致（兼容 v1/v2，允许混用）。",
  },
  boxIndex: {
    key: "box_index",
    type: FieldTypeEnum.Int,
    default: 1,
    desc: "指定输出哪个子识别的识别框（box）作为当前节点的识别框。可选，默认 0。 需要满足 0 <= box_index < all_of.size。",
  },
  subName: {
    key: "sub_name",
    type: FieldTypeEnum.String,
    default: "",
    desc: "后续子识别可通过 roi: sub_name 引用之前子识别的 filtered 作为 ROI；同名以最后一个为准。 仅当前节点内有效。",
  },
  anyOf: {
    key: "any_of",
    type: FieldTypeEnum.ObjectList,
    required: true,
    default: [{}, {}],
    desc: "子识别列表。命中第一个即成功，后续不再识别。必选。 列表元素写法与普通节点的 recognition 一致（兼容 v1/v2，允许混用）。",
  },

  // 自定义识别字段
  customRecognition: {
    key: "custom_recognition",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: `识别名，同注册接口传入的识别名。同时会通过 MaaCustomRecognitionCallback.custom_recognition_name 传出。必选。`,
  },
  customRecognitionParam: {
    key: "custom_recognition_param",
    type: FieldTypeEnum.Any,
    default: {},
    desc: `识别参数，任意类型，会通过 MaaCustomRecognitionCallback.custom_recognition_param 传出。可选，默认空 json，即 {} 。`,
  },
  customRoi: {
    key: "roi",
    type: [FieldTypeEnum.XYWH, FieldTypeEnum.String],
    default: [0, 0, 0, 0],
    desc: "识别区域坐标。可选，默认 [0, 0, 0, 0] ，即全屏。array<int, 4>: 识别区域坐标，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。string: 填写节点名，在之前执行过的某节点识别到的目标范围内识别。会通过 MaaCustomRecognitionCallback.roi 传出。",
  },
};

/**
 * 识别字段 Schema 键列表
 */
export const recoFieldSchemaKeyList = Array.from(
  new Set(Object.values(recoFieldSchema).map((field) => field.key))
);
