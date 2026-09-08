import type { AchievementDef } from "../types";

export const materialAchievements: AchievementDef[] = [
  {
    id: "material_device",
    title: "接通现场",
    subtitle: "画布之外，信号已接通。",
    description: "首次成功连接设备",
    category: "material",
    trigger: {
      kind: "counter",
      counter: "device_connected",
      target: 1
    }
  },
  {
    id: "material_capture",
    title: "定格这一刻",
    subtitle: "就是这一帧。",
    description: "首次成功保存模板截图",
    category: "material",
    trigger: {
      kind: "counter",
      counter: "screenshot_saved",
      target: 1
    }
  },
  {
    id: "material_roi",
    title: "圈定范围",
    subtitle: "目光放在关键处。",
    description: "使用 ROI 工具将结果应用到字段",
    category: "material",
    trigger: {
      kind: "counter",
      counter: "roi_applied",
      target: 1
    }
  },
  {
    id: "material_ocr",
    title: "字里行间",
    subtitle: "屏幕上的字，读懂了。",
    description: "使用 OCR 工具识别出非空文字",
    category: "material",
    trigger: {
      kind: "counter",
      counter: "ocr_recognized",
      target: 1
    }
  },
  {
    id: "material_color",
    title: "本色出演",
    subtitle: "找到这一抹颜色。",
    description: "将取色结果应用到字段",
    category: "material",
    trigger: {
      kind: "counter",
      counter: "color_applied",
      target: 1
    }
  }
];
