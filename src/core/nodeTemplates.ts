import { NodeTypeEnum } from "../components/flow/nodes";

export interface NodeTemplateType {
  label: string;
  iconName: string;
  iconSize?: number;
  nodeType?: NodeTypeEnum;
  data?: () => any;
}

export const nodeTemplates: NodeTemplateType[] = [
  {
    label: "空节点",
    iconName: "icon-kongjiedian",
    iconSize: 32,
  },
  {
    label: "文字识别",
    iconName: "icon-ocr",
    data: () => ({
      recognition: {
        type: "OCR",
        param: { expected: [""] },
      },
      action: {
        type: "Click",
        param: {},
      },
    }),
  },
  {
    label: "图像识别",
    iconName: "icon-tuxiang",
    data: () => ({
      recognition: {
        type: "TemplateMatch",
        param: { template: [""] },
      },
      action: {
        type: "Click",
        param: {},
      },
    }),
  },
  {
    label: "无延迟节点",
    iconName: "icon-weizhihang",
    iconSize: 30,
    data: () => ({
      others: {
        pre_delay: 0,
        post_delay: 0,
      },
    }),
  },
  {
    label: "直接点击",
    iconName: "icon-dianji",
    data: () => ({
      action: {
        type: "Click",
        param: { target: [0, 0, 0, 0] },
      },
    }),
  },
  {
    label: "Custom",
    iconName: "icon-daima",
    iconSize: 27,
    data: () => ({
      action: {
        type: "Custom",
        param: { custom_action: "", custom_action_param: "" },
      },
      others: {
        pre_delay: 0,
        post_delay: 0,
      },
    }),
  },
  {
    label: "外部节点",
    iconName: "icon-xiaofangtongdao",
    iconSize: 24,
    nodeType: NodeTypeEnum.External,
  },
];
