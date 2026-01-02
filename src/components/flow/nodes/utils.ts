import type { IconNames } from "../../iconfonts";

/**图标配置类型 */
export type IconConfig = {
  name: IconNames | null;
  size: number;
};

export type RequiredIconConfig = {
  name: IconNames;
  size: number;
};

/**获取识别类型图标 */
export const getRecognitionIcon = (type: string): IconConfig => {
  switch (type) {
    case "DirectHit":
      return { name: "icon-Deactivate", size: 15 };
    case "OCR":
      return { name: "icon-ocr-yinshuawenzishibie", size: 13 };
    case "TemplateMatch":
      return { name: "icon-Imagetuxiangshibie", size: 16 };
    case "ColorMatch":
      return { name: "icon-icon_secai", size: 13 };
    case "Custom":
      return { name: "icon-zidingyi1", size: 15 };
    case "FeatureMatch":
      return { name: "icon-tezhengpipei", size: 14 };
    case "And":
      return { name: "icon-bingqie", size: 14 };
    case "Or":
      return { name: "icon-huozhe", size: 14 };
    case "NeuralNetworkClassify":
      return { name: "icon-BDshenjingwangluofenlei-01", size: 16 };
    case "NeuralNetworkDetect":
      return { name: "icon-jiqiren", size: 16 };
    default:
      return { name: null, size: 16 };
  }
};

/**获取动作类型图标 */
export const getActionIcon = (type: string): IconConfig => {
  switch (type) {
    case "DoNothing":
      return { name: "icon-Deactivate", size: 15 };
    case "Click":
      return { name: "icon-custom521", size: 18 };
    case "Custom":
      return { name: "icon-zidingyishujuchuli", size: 15 };
    case "Swipe":
      return { name: "icon-xiahua", size: 14 };
    case "Scroll":
      return { name: "icon-qiyongshubiaogunlun", size: 14 };
    case "ClickKey":
      return { name: "icon-yanjizhushou-shangchuan_anjiangongneng", size: 16 };
    case "LongPress":
      return { name: "icon-shubiaozuojian", size: 15 };
    case "MultiSwipe":
      return { name: "icon-xiahua", size: 14 };
    case "TouchDown":
      return { name: "icon-shubiaozuojian", size: 15 };
    case "TouchMove":
      return { name: "icon-shubiaozuojian", size: 15 };
    case "TouchUp":
      return { name: "icon-shubiaozuojian", size: 15 };
    case "LongPressKey":
      return { name: "icon-yanjizhushou-shangchuan_anjiangongneng", size: 16 };
    case "KeyDown":
      return { name: "icon-a-04-15anxiaqidongPushtoactivate", size: 17 };
    case "KeyUp":
      return { name: "icon-a-04-15anxiaqidongPushtoactivate", size: 17 };
    case "InputText":
      return { name: "icon-biaodanzujian-shurukuang", size: 13 };
    case "StartApp":
      return { name: "icon-start", size: 14 };
    case "StopApp":
      return { name: "icon-finish", size: 14 };
    case "StopTask":
      return { name: "icon-finish", size: 14 };
    case "Command":
      return { name: "icon-shell", size: 15 };
    case "Key":
      return { name: "icon-yanjizhushou-shangchuan_anjiangongneng", size: 16 };
    default:
      return { name: null, size: 16 };
  }
};

/**获取节点类型图标 */
export const getNodeTypeIcon = (nodeType: string): RequiredIconConfig => {
  switch (nodeType) {
    case "pipeline":
      return { name: "icon-m_act", size: 18 };
    case "external":
      return { name: "icon-lianjie", size: 16 };
    case "anchor":
      return { name: "icon-a-11maodian2", size: 16 };
    default:
      return { name: "icon-m_act", size: 16 };
  }
};

/**极简节点颜色配置 */
export type MinimalNodeColor = {
  primary: string; // 主色（边框、图标）
  background: string; // 背景色（带透明度）
};

/**根据识别类型获取极简节点颜色 */
export const getMinimalNodeColor = (recoType: string): MinimalNodeColor => {
  switch (recoType) {
    // 识别类节点 - 科技蓝
    case "OCR":
      return { primary: "#1890ff", background: "#e6f4ff" };
    case "TemplateMatch":
      return { primary: "#13c2c2", background: "#e6fffb" };
    case "ColorMatch":
      return { primary: "#722ed1", background: "#f9f0ff" };
    case "FeatureMatch":
      return { primary: "#2f54eb", background: "#f0f5ff" };
    // AI类节点 - 渐变紫
    case "NeuralNetworkClassify":
    case "NeuralNetworkDetect":
      return { primary: "#9254de", background: "#f9f0ff" };
    // 逻辑类节点 - 橙色
    case "And":
    case "Or":
      return { primary: "#fa8c16", background: "#fff7e6" };
    // 自定义节点 - 青色
    case "Custom":
      return { primary: "#52c41a", background: "#f6ffed" };
    // 默认/DirectHit - 中性灰
    case "DirectHit":
    default:
      return { primary: "#595959", background: "#fafafa" };
  }
};
