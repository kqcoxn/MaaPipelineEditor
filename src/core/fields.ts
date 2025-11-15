export enum FieldTypeEnum {
  Int = "int",
  Double = "double",
  True = "true",
  Bool = "bool",
  String = "string",
  IntList = "list<int, >",
  IntListList = "list<list<int, >>",
  DoubleList = "list<double, >",
  StringList = "list<string, >",
  XYWH = "array<int, 4>",
  XYWHList = "list<array<int, 4>>",
  PositionList = "list<true | string | array<int, 4>>",
  IntPair = "array<int, 2>",
  StringPair = "array<string, 2>",
  StringPairList = "list<array<string, 2>>",
  Any = "any",
  ObjectList = "list<object,>",
}

export type FieldType = {
  key: string;
  type: FieldTypeEnum | FieldTypeEnum[];
  required?: boolean;
  options?: any[];
  default: any;
  step?: number;
  desc: string;
};

export const recoFieldSchemaKeyList = [
  "roi",
  "roi_offset",
  "template",
  "threshold",
  "order_by",
  "index",
  "method",
  "green_mask",
  "count",
  "detector",
  "ratio",
  "lower",
  "upper",
  "connected",
  "expected",
  "replace",
  "only_rec",
  "model",
  "labels",
  "custom_recognition",
  "custom_recognition_param",
];
const recoFieldSchema = {
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
  template: {
    key: "template",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
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
  lengthOrderBy: {
    key: "order_by",
    type: FieldTypeEnum.String,
    options: ["Horizontal", "Vertical", "Area", "Length ", "Random"],
    default: "Horizontal",
    desc: `结果排序方式。可选，默认 Horizontal。 可选的值：Horizontal | Vertical | Area | Length | Random 。 可结合 index 字段使用。`,
  },
  index: {
    key: "index",
    type: FieldTypeEnum.Int,
    default: 0,
    desc: `命中第几个结果。可选，默认 0 。 假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类 Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。`,
  },
  templateMatchModes: {
    key: "method",
    type: FieldTypeEnum.Int,
    options: [1, 3, 5],
    default: 1,
    desc: `模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5 。 仅支持 1、3、5，可简单理解为越大的越精确，但也会更慢。 详情请参考 OpenCV 官方文档。`,
  },
  greenMask: {
    key: "green_mask",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: `是否进行绿色掩码。可选，默认 false 。 若为 true，可以将图片中不希望匹配的部分涂绿 RGB: (0, 255, 0)，则不对绿色部分进行匹配。`,
  },
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
  ocrExpected: {
    key: "expected",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    required: true,
    default: [""],
    desc: `期望的结果，支持正则。必选。`,
  },
  ocrThreshold: {
    key: "threshold",
    type: [FieldTypeEnum.DoubleList, FieldTypeEnum.Double],
    default: [0.3],
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

export const actionFieldSchemaKeyList = [
  "target",
  "target_offset",
  "duration",
  "begin",
  "begin_offset",
  "end",
  "end_offset",
  "end_hold",
  "only_hover",
  "swipes",
  "contact",
  "pressure",
  "key",
  "input_text",
  "package",
  "exec",
  "args",
  "detach",
  "custom_action",
  "custom_action_param",
];
const actionFieldSchema = {
  clickTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "点击目标的位置。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  targetOffset: {
    key: "target_offset",
    type: FieldTypeEnum.XYWH,
    default: [0, 0, 0, 0],
    desc: "在 target 的基础上额外移动再作为点击目标，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  longPressTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "长按目标的位置。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  longPressDuration: {
    key: "duration",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 100,
    desc: "长按持续时间，单位毫秒。可选，默认 1000 。",
  },
  begin: {
    key: "begin",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "滑动起点。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  beginOffset: {
    key: "begin_offset",
    type: FieldTypeEnum.XYWH,
    default: [0, 0, 0, 0],
    desc: "在 begin 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  end: {
    key: "end",
    type: [
      FieldTypeEnum.PositionList,
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [[0, 0, 0, 0]],
    desc: "滑动终点。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。v4.5.x 版本新增支持 list，可用于添加滑动途径点！相较多次 swipe 的区别是多个 end 之间不会抬手，即一次折线滑动。",
  },
  endOffset: {
    key: "end_offset",
    type: [FieldTypeEnum.XYWHList, FieldTypeEnum.XYWH],
    default: [[0, 0, 0, 0]],
    desc: "在 end 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  swipeDuration: {
    key: "duration",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    default: [1000],
    step: 100,
    desc: "滑动持续时间，单位毫秒。可选，默认 200 。",
  },
  endHold: {
    key: "end_hold",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    default: [200],
    step: 100,
    desc: "滑动到终点后，额外等待一定时间再抬起，单位 ms。可选，默认 0。",
  },
  onlyHover: {
    key: "only_hover",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "仅鼠标悬停移动，无按下/抬起动作。可选，默认 false。",
  },
  swipes: {
    key: "swipes",
    type: FieldTypeEnum.ObjectList,
    required: true,
    default: [{}],
    desc: "多个滑动的数组。必选。swipes: list<object,> 多个滑动的数组。必选。 数组元素顺序没有影响，只基于 starting 确定顺序。 starting: uint 滑动起始时间，单位毫秒。可选，默认 0 。 MultiSwipe 额外字段，该滑动会在本 action 中第 starting 毫秒才开始。 begin: true | string | array<int, 2> | array<int, 4> 滑动起点。可选，默认 true 。值同 swipe-end。 begin_offset: array<int, 4> 在 begin 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。 end: true | string | array<int, 2> | array<int, 4> | list<true | string | array<int, 2> | array<int, 4>> 滑动终点。可选，默认 true 。值同 swipe-end。 💡 v4.5.x 版本新增支持 list，可用于添加滑动途径点！相较多次 swipe 的区别是多个 end 之间不会抬手，即一次折线滑动。 end_offset: array<int, 4> | list<array<int, 4>> 在 end 的基础上额外移动再作为终点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。 duration: uint | list<uint,> 滑动持续时间，单位毫秒。可选，默认 200 。 end_hold: uint | list<uint,> 滑动到终点后，额外等待一定时间再抬起，单位 ms。可选，默认 0。 only_hover: bool 仅鼠标悬停移动，无按下/抬起动作。可选，默认 false。 contact: uint 触点编号，用于区分不同的触控点。可选，默认 0 。 Adb 控制器：表示手指编号（0 为第一根手指，1 为第二根手指，以此类推） Win32 控制器：表示鼠标按键编号（0 为左键，1 为右键，2 为中键，3 为 XBUTTON1，4 为 XBUTTON2） 注意：在 MultiSwipe 中，如果 contact 为 0，将使用该滑动在数组中的索引作为触点编号。",
  },
  contact: {
    key: "contact",
    type: FieldTypeEnum.Int,
    default: [1],
    step: 1,
    desc: "触点编号，用于区分不同的触控点。可选，默认 0 。Adb 控制器：表示手指编号（0 为第一根手指，1 为第二根手指，以此类推） Win32 控制器：表示鼠标按键编号（0 为左键，1 为右键，2 为中键，3 为 XBUTTON1，4 为 XBUTTON2）",
  },
  touchTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "触控目标的位置。可选，默认 true。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  pressure: {
    key: "pressure",
    type: FieldTypeEnum.Int,
    default: [1],
    step: 1,
    desc: "触控压力，范围取决于控制器实现。可选，默认 0 。",
  },
  clickKey: {
    key: "key",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    required: true,
    default: [1],
    step: 1,
    desc: "要单击的键，仅支持对应控制器的虚拟按键码。必选。",
  },
  longPressKey: {
    key: "key",
    type: FieldTypeEnum.Int,
    required: true,
    default: 1,
    desc: "要按下或松开的键，仅支持对应控制器的虚拟按键码。必选。",
  },
  longPressKeyDuration: {
    key: "duration",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 100,
    desc: "要按的键，仅支持对应控制器的虚拟按键码。必选。",
  },
  inputText: {
    key: "input_text",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "要输入的文本，部分控制器仅支持 ascii 。必选。",
  },
  package: {
    key: "package",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "启动入口。必选。需要填入 package name 或 activity ，例如 com.hypergryph.arknights 或 com.hypergryph.arknights/com.u8.sdk.U8UnityContext 。",
  },
  exec: {
    key: "exec",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "执行的程序路径。必选。",
  },
  commandArgs: {
    key: "args",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    default: "",
    desc: "执行的参数。可选。 支持部分运行期参数替换： {ENTRY}: 任务入口名。 {NODE}: 当前节点名。 {IMAGE}: 截图保存到文件的路径。该文件在进程退出前删除，若要持久保存请自行复制。 {BOX}: 识别命中的目标，格式为 [x, y, w, h]。 {RESOURCE_DIR}: 最后一次加载的资源文件夹路径。 {LIBRARY_DIR}: MaaFW 库所在的文件夹路径。",
  },
  detach: {
    key: "detach",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "分离子进程，即不等待子进程执行完成，直接继续执行后面的任务。可选，默认 false。",
  },
  customAction: {
    key: "custom_action",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "动作名，同注册接口传入的识别器名。同时会通过 MaaCustomActionCallback.custom_action_name 传出。必选。",
  },
  customActionParam: {
    key: "custom_action_param",
    type: FieldTypeEnum.Any,
    default: {},
    desc: "动作参数，任意类型，会通过 MaaCustomActionCallback.custom_action_param 传出。可选，默认空 json，即 {} 。",
  },
  customTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "目标的位置，会通过 MaaCustomActionCallback.box 传出。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
};

export const otherFieldSchemaKeyList = [
  "rate_limit",
  "timeout",
  "inverse",
  "enabled",
  "pre_delay",
  "post_delay",
  "pre_wait_freezes",
  "post_wait_freezes",
  "focus",
];
const otherFieldSchema = {
  rateLimit: {
    key: "rate_limit",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 500,
    desc: "识别速率限制，单位毫秒。可选，默认 1000 。 每轮识别 next + interrupt 最低消耗 rate_limit 毫秒，不足的时间将会 sleep 等待。",
  },
  timeout: {
    key: "timeout",
    type: FieldTypeEnum.Int,
    default: 20000,
    step: 1000,
    desc: "next + interrupt 识别超时时间，毫秒。可选，默认 20 * 1000 。 具体逻辑为 while(!timeout) { foreach(next + interrupt); sleep_until(rate_limit); } 。",
  },
  inverse: {
    key: "inverse",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "反转识别结果，识别到了当做没识别到，没识别到的当做识别到了。可选，默认 false 。 请注意由此识别出的节点，Click 等动作的点击自身将失效（因为实际并没有识别到东西），若有需求可单独设置 target 。",
  },
  enabled: {
    key: "enabled",
    type: FieldTypeEnum.Bool,
    default: false,
    desc: "是否启用该 node。可选，默认 true 。 若为 false，其他 node 的 next 列表中的该 node 会被跳过，既不会被识别也不会被执行。",
  },
  preDelay: {
    key: "pre_delay",
    type: FieldTypeEnum.Int,
    default: 400,
    step: 100,
    desc: "识别到 到 执行动作前 的延迟，毫秒。可选，默认 200 。 推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。",
  },
  postDelay: {
    key: "post_delay",
    type: FieldTypeEnum.Int,
    default: 400,
    step: 100,
    desc: "执行动作后 到 识别 next 的延迟，毫秒。可选，默认 200 。 推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。",
  },
  preWaitFreezes: {
    key: "pre_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 0,
    desc: "识别到 到 执行动作前，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。 若为 object，可设置更多参数，详见 等待画面静止。 具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。",
  },
  postWaitFreezes: {
    key: "post_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 0,
    desc: "行动动作后 到 识别 next，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。 若为 object，可设置更多参数，详见 等待画面静止。 具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。",
  },
  focus: {
    key: "focus",
    type: FieldTypeEnum.Any,
    default: "",
    desc: "关注节点，会额外产生部分回调消息。可选，默认 null，不产生回调消息。 详见 节点通知。",
  },
  isSub: {
    key: "is_sub",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "（已在 2.x 版本中废弃，但保留兼容性，推荐使用 interrupt 替代） 是否是子节点。可选，默认 false 。 如果是子节点，执行完本节点（及后续 next 等）后，会返回来再次识别本节点 所在的 next 列表。 例如：A.next = [B, Sub_C, D]，这里的 Sub_C.is_sub = true， 若匹配上了 Sub_C，在完整执行完 Sub_C 及后续节点后，会返回来再次识别 [B, Sub_C, D] 并执行命中项及后续节点。",
  },
};

export type FieldsType = {
  params: FieldType[];
  desc: string;
};

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
    desc: "模板匹配，即“找图”。",
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
    desc: "颜色匹配，即“找色”。",
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
    desc: "特征匹配，泛化能力更强的“找图”，具有抗透视、抗尺寸变化等特点。",
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
    desc: "深度学习分类，判断图像中的 固定位置 是否为预期的“类别”。",
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
    desc: "深度学习目标检测，高级版“找图”。与分类器主要区别在于“找”，即支持任意位置。但通常来说模型复杂度会更高，需要更多的训练集、训练时间，使用时的资源占用（推理开销）也会成倍上涨。",
  },
};

export const actionFields: Record<string, FieldsType> = {
  DoNothing: {
    params: [],
    desc: "什么都不做。",
  },
  Click: {
    params: [actionFieldSchema.clickTarget, actionFieldSchema.targetOffset],
    desc: "点击。",
  },
  Custom: {
    params: [
      actionFieldSchema.customAction,
      actionFieldSchema.customActionParam,
      actionFieldSchema.customTarget,
      actionFieldSchema.targetOffset,
    ],
    desc: "执行通过 MaaResourceRegisterCustomAction 接口传入的动作句柄。",
  },
  Swipe: {
    params: [
      actionFieldSchema.begin,
      actionFieldSchema.beginOffset,
      actionFieldSchema.end,
      actionFieldSchema.endOffset,
      actionFieldSchema.swipeDuration,
      actionFieldSchema.endHold,
      actionFieldSchema.onlyHover,
    ],
    desc: "线性滑动。",
  },
  ClickKey: {
    params: [actionFieldSchema.clickKey],
    desc: "单击按键。",
  },
  LongPress: {
    params: [
      actionFieldSchema.longPressTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.longPressDuration,
    ],
    desc: "长按。",
  },
  MultiSwipe: {
    params: [actionFieldSchema.swipes],
    desc: "多指线性滑动。",
  },
  TouchDown: {
    params: [
      actionFieldSchema.contact,
      actionFieldSchema.touchTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.pressure,
    ],
    desc: "按下触控点。",
  },
  TouchMove: {
    params: [
      actionFieldSchema.contact,
      actionFieldSchema.touchTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.pressure,
    ],
    desc: "移动触控点。字段含义与 TouchDown 一致，用于更新触点位置。",
  },
  TouchUp: {
    params: [actionFieldSchema.contact],
    desc: "抬起触控点。",
  },
  LongPressKey: {
    params: [
      actionFieldSchema.longPressKey,
      actionFieldSchema.longPressKeyDuration,
    ],
    desc: "长按按键。",
  },
  KeyDown: {
    params: [actionFieldSchema.longPressKey],
    desc: "按下按键但不立即松开。可与 KeyUp 配合实现自定义按键时序。",
  },
  KeyUp: {
    params: [actionFieldSchema.longPressKey],
    desc: "松开按键。用于结束 KeyDown 建立的按键状态。",
  },
  InputText: {
    params: [actionFieldSchema.inputText],
    desc: "输入文本。",
  },
  StartApp: {
    params: [actionFieldSchema.package],
    desc: "启动 App 。",
  },
  StopApp: {
    params: [actionFieldSchema.package],
    desc: "关闭 App 。",
  },
  StopTask: {
    params: [],
    desc: "停止当前任务链（MaaTaskerPostTask 传入的单个任务链）。",
  },
  Command: {
    params: [
      actionFieldSchema.exec,
      actionFieldSchema.commandArgs,
      actionFieldSchema.detach,
    ],
    desc: "执行命令。",
  },
  Key: {
    params: [actionFieldSchema.clickKey],
    desc: "（已在 4.5 版本中废弃，但保留兼容性，推荐使用 ClickKey 替代）按键。",
  },
};

type TypeParamKeysType = Record<
  string,
  {
    all: string[];
    requires: string[];
    required_default: any[];
  }
>;
export const recoParamKeys = (() => {
  const dict: TypeParamKeysType = {};
  Object.keys(recoFields).forEach((fieldKey) => {
    const field = recoFields[fieldKey];
    dict[fieldKey] = {
      all: field.params.map((param) => param.key),
      requires: field.params.flatMap((param) =>
        param.required ? param.key : []
      ),
      required_default: field.params.flatMap((param) =>
        param.required ? param.default : []
      ),
    };
  });
  return dict;
})();
export const actionParamKeys = (() => {
  const dict: TypeParamKeysType = {};
  Object.keys(actionFields).forEach((fieldKey) => {
    const field = actionFields[fieldKey];
    dict[fieldKey] = {
      all: field.params.map((param) => param.key),
      requires: field.params.flatMap((param) =>
        param.required ? param.key : []
      ),
      required_default: field.params.flatMap((param) =>
        param.required ? param.default : []
      ),
    };
  });
  return dict;
})();

export const otherFieldParams: FieldType[] = [
  otherFieldSchema.rateLimit,
  otherFieldSchema.timeout,
  otherFieldSchema.preDelay,
  otherFieldSchema.postDelay,
  otherFieldSchema.focus,
  otherFieldSchema.enabled,
  otherFieldSchema.inverse,
  otherFieldSchema.preWaitFreezes,
  otherFieldSchema.postWaitFreezes,
  otherFieldSchema.isSub,
];

// 大写值
export const upperRecoValues = (() => {
  const dict: Record<string, string> = {};
  Object.keys(recoFields).forEach((fieldKey) => {
    dict[fieldKey.toUpperCase()] = fieldKey;
  });
  return dict;
})();

export const upperActionValues = (() => {
  const dict: Record<string, string> = {};
  Object.keys(actionFields).forEach((fieldKey) => {
    dict[fieldKey.toUpperCase()] = fieldKey;
  });
  return dict;
})();
