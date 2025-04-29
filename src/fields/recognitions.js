// 识别算法
export const recognitionFields = {
  DirectHit: {
    description: "直接命中，即不进行识别，直接执行动作。",
  },
  TemplateMatch: {
    description: "模板匹配，即“找图”。",
    extras: {
      roi: {
        type: "number[4]",
        description: `
            识别区域坐标。可选，默认 [0, 0, 0, 0] ，即全屏。
            array<int, 4>: 识别区域坐标，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。
            string: 填写节点名，在之前执行过的某节点识别到的目标范围内识别。
        `,
        default: [0, 0, 0, 0],
      },
      roi_offset: {
        type: "number[4]",
        description: `
            在 roi 的基础上额外移动再作为范围，四个值分别相加。可选，默认 [0, 0, 0, 0] 。
        `,
        default: [0, 0, 0, 0],
      },
      template: {
        required: true,
        type: "string[]",
        description: `
            模板图片路径，需要 image 文件夹的相对路径。必选。
            所使用的图片需要是无损原图缩放到 720p 后的裁剪。
        `,
        default: [""],
      },
      threshold: {
        type: "number[]",
        description: `
            模板匹配阈值。可选，默认 0.7 。
            若为数组，长度需和 template 数组长度相同。
        `,
        default: [0.7],
      },
      order_by: {
        type: "enum",
        options: ["Horizontal", "Vertical", "Score", "Random"],
        description: `
            结果排序方式。可选，默认 Horizontal。
            可选的值：Horizontal | Vertical | Score | Random 。
            可结合 index 字段使用。
        `,
        default: "Horizontal",
      },
      index: {
        type: "number",
        description: `
            命中第几个结果。可选，默认0 。
            假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类 Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。
        `,
        default: 0,
      },
      method: {
        type: "enum",
        options: [1, 3, 5],
        description: `
            模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5 。
            仅支持 1、3、5，可简单理解为越大的越精确，但也会更慢。
            详情请参考 OpenCV 官方文档。
        `,
        default: 5,
      },
      green_mask: {
        type: "boolean",
        description: `
            是否进行绿色掩码。可选，默认 false 。
            若为 true，可以将图片中不希望匹配的部分涂绿 RGB: (0, 255, 0)，则不对绿色部分进行匹配。
          `,
        default: false,
      },
    },
  },
  FeatureMatch: {
    description: `
        特征匹配，泛化能力更强的“找图”，具有抗透视、抗尺寸变化等特点。
      `,
    extras: {
      roi: {
        type: "number[4]",
        description: `
                识别区域坐标。可选，默认 [0, 0, 0, 0] ，即全屏。
                array<int, 4>: 识别区域坐标，[x, y, w, h]，若希望全屏可设为 [0, 0, 0, 0] 。
                string: 填写节点名，在之前执行过的某节点识别到的目标范围内识别。
            `,
        default: [0, 0, 0, 0],
      },
      roi_offset: {
        type: "number[4]",
        description: `
                在 roi 的基础上额外移动再作为范围，四个值分别相加。可选，默认 [0, 0, 0, 0] 。
            `,
        default: [0, 0, 0, 0],
      },
      template: {
        required: true,
        type: "string[]",
        description: `
                模板图片路径，需要 image 文件夹的相对路径。必选。
                所使用的图片需要是无损原图缩放到 720p 后的裁剪。
            `,
        default: [""],
      },
      threshold: {
        type: "number[]",
        description: `
                模板匹配阈值。可选，默认 0.7 。
                若为数组，长度需和 template 数组长度相同。
            `,
        default: 0.7,
      },
      order_by: {
        type: "enum",
        options: ["Horizontal", "Vertical", "Score", "Area", "Random"],
        description: `
                结果排序方式。可选，默认 Horizontal。
                可选的值：Horizontal | Vertical | Score | Area | Random 。
                可结合 index 字段使用。
                详情请参考 OpenCV 官方文档。
            `,
        default: "Horizontal",
      },
      index: {
        type: "number",
        description: `
                命中第几个结果。可选，默认0 。
                假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类 Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。
            `,
        default: 0,
      },
      method: {
        type: "enum",
        options: [1, 3, 5],
        description: `
                模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5 。
                仅支持 1、3、5，可简单理解为越大的越精确，但也会更慢。
                详情请参考 OpenCV 官方文档。
                `,
        default: 5,
      },
      green_mask: {
        type: "boolean",
        description: `
                是否进行绿色掩码。可选，默认 false 。
                若为 true，可以将图片中不希望匹配的部分涂绿 RGB: (0, 255, 0)，则不对绿色部分进行匹配。
            `,
        default: false,
      },
      detector: {
        type: "enum",
        options: ["SIFT", "KAZE", "AKAZE", "BRISK", "ORB"],
        description: `
                特征检测器。可选，默认 SIFT 。
                目前支持以下算法：

                SIFT
                计算复杂度高，具有尺度不变性、旋转不变性。效果最好。
                KAZE
                适用于2D和3D图像，具有尺度不变性、旋转不变性。
                AKAZE
                计算速度较快，具有尺度不变性、旋转不变性。
                BRISK
                计算速度非常快，具有尺度不变性、旋转不变性。
                ORB
                计算速度非常快，具有旋转不变性。但不具有尺度不变性。
                各算法特点详情可自行进一步查询。
            `,
        default: "SIFT",
      },
      ratio: {
        type: "number",
        description: `
                KNN 匹配算法的距离比值，[0 - 1.0] , 越大则匹配越宽松（更容易连线）。可选，默认 0.6 。
            `,
        default: 0.6,
      },
    },
  },
  ColorMatch: {
    description: `
        颜色匹配，即“找色”。
          `,
    extras: {
      roi: {
        required: true,
        type: "string",
        description: `
                  YAMaaPE目前仅支持字符串。
                  ROI 区域。可选，默认 [0, 0, 0, 0] 。
                  若为字符串，则表示图片文件夹中的图片路径。
                  若为数组，则表示 ROI 区域的坐标。
                  `,
        default: "",
      },
      roi_offset: {
        type: "number[4]",
        description: `
                  ROI 偏移。可选，默认 [0, 0, 0, 0] 。
                  若为数组，则表示 ROI 偏移的坐标。
                  `,
        default: [0, 0, 0, 0],
      },
      method: {
        type: "enum",
        options: [4, 40, 6],
        description: `
                  颜色匹配方式。即 cv::ColorConversionCodes。可选，默认 4 (RGB) 。
                  常用值：4 (RGB, 3 通道), 40 (HSV, 3 通道), 6 (GRAY, 1 通道)。
                  `,
        default: 4,
      },
      lower: {
        required: true,
        type: "number[]",
        description: `
                  颜色下限值。必选。最内层 list 长度需和 method 的通道数一致。
                  `,
        default: [0, 0, 0],
      },
      upper: {
        required: true,
        type: "number[]",
        description: `
                  颜色上限值。必选。最内层 list 长度需和 method 的通道数一致。
                  `,
        default: [255, 255, 255],
      },
      count: {
        type: "number",
        description: `
                  符合的点的数量要求（阈值）。可选，默认 1。
                  `,
        default: 1,
      },
      order_by: {
        type: "enum",
        options: ["Horizontal", "Vertical", "Score", "Area", "Random"],
        description: `
                  结果排序方式。可选，默认 Horizontal 。
                  可选的值：Horizontal | Vertical | Score | Area | Random 。
                  可结合 index 字段使用。
                  `,
        default: "Horizontal",
      },
      index: {
        type: "number",
        description: `
                  命中第几个结果。可选，默认 0 。
                  假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类 Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。
                  `,
        default: 0,
      },
      connected: {
        type: "boolean",
        description: `
                  是否是相连的点才会被计数。可选，默认 false 。
                  若为是，在完成颜色过滤后，则只会计数像素点 全部相连 的最大块。
                  若为否，则不考虑这些像素点是否相连。
                  `,
        default: false,
      },
    },
  },
  OCR: {
    description: `
        文字识别。
          `,
    extras: {
      roi: {
        type: "number[4]",
        description: `
                  ROI 区域。可选，默认 [0, 0, 0, 0] 。
                  若为字符串，则表示图片文件夹中的图片路径。
                  若为数组，则表示 ROI 区域的坐标。
                  `,
        default: [0, 0, 0, 0],
      },
      roi_offset: {
        type: "number[4]",
        description: `
                  ROI 偏移。可选，默认 [0, 0, 0, 0] 。
                  若为数组，则表示 ROI 偏移的坐标。
                  `,
        default: [0, 0, 0, 0],
      },
      expected: {
        required: true,
        type: "string[]",
        description: `
                  期望的结果，支持正则。必选。
                  `,
        default: [""],
      },
      threshold: {
        type: "number",
        description: `
                  模型置信度阈值。可选，默认 0.3 。
                  `,
        default: 0.3,
      },
      order_by: {
        type: "enum",
        options: ["Horizontal", "Vertical", "Area", "Length", "Random"],
        description: `
                  结果排序方式。可选，默认 Horizontal 。
                  可选的值：Horizontal | Vertical | Area | Length | Random 。
                  可结合 index 字段使用。
                  `,
        default: "Horizontal",
      },
      index: {
        type: "number",
        description: `
                  命中第几个结果。可选，默认 0 。
                  假设共有 N 个结果，则 index 的取值范围为 [-N, N - 1] ，其中负数使用类
                  Python 的规则转换为 N - index 。若超出范围，则视为当前识别无结果。
                  `,
        default: 0,
      },
      only_rec: {
        type: "boolean",
        description: `
                  是否仅识别（不进行检测，需要精确设置 roi）。可选，默认 false 。
                  `,
        default: false,
      },
      model: {
        type: "string",
        description: `
                  模型 文件夹 路径。使用 model/ocr 文件夹的相对路径。可选，默认为空。
                  若为空，则为 model/ocr 根目录下的模型文件。
                  文件夹中需要包含 rec.onnx, det.onnx, keys.txt 三个文件。
                  `,
        default: "",
      },
    },
  },
  Custom: {
    description: `执行通过 MaaResourceRegisterCustomRecognition 接口传入的识别器句柄。`,
    extras: {
      custom_recognition: {
        required: true,
        type: "string",
        description: `
                  识别名，同注册接口传入的识别名。
                  同时会通过 MaaCustomRecognitionCallback.custom_recognition_name 传出。
                  必选。
                  `,
        default: "",
      },
      custom_recognition_param: {
        type: "object",
        description: `
                  识别参数，任意类型，会通过 MaaCustomRecognitionCallback.custom_recognition_param 传出。
                  可选，默认空 json，即 {} 。
                  `,
        default: {},
      },
      roi: {
        type: "number[4]",
        description: `
                  同 TemplateMatch.roi，会通过 MaaCustomRecognitionCallback.roi 传出。
                  可选，默认 [0, 0, 0, 0] 。
                  `,
        default: [0, 0, 0, 0],
      },
      roi_offset: {
        type: "number[4]",
        description: `
                  同 TemplateMatch.roi_offset 。
                  `,
        default: [0, 0, 0, 0],
      },
    },
  },
};
