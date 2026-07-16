/** 使用协议版本号 — 修改此值将要求所有用户重新确认条款 */
export const TERMS_VERSION = "1.0.0";

export interface TermsItem {
  id: string;
  content: string;
}

/** 使用协议条款列表 */
export const termsItems: TermsItem[] = [
  {
    id: "tool_nature",
    content:
      "我已了解 MaaPipelineEditor (MPE) 是 MaaFramework 的辅助可视化编辑器，不能替代对 MaaFW 本身的学习与理解。",
  },
  {
    id: "no_warranty",
    content:
      "我理解本工具为开源社区项目，按「原样」提供，不附带任何明示或暗示的保证，因使用本工具产生的任何后果由使用者自行承担。",
  },
  {
    id: "data_local",
    content:
      "我已知晓本工具的所有数据均存储在本地浏览器中，不会上传至任何服务器；清除浏览器数据可能导致工作内容丢失，我将自行在必要时做好备份。（配置面板可导出配置文件）",
  },
  {
    id: "project_allow",
    content:
      "对于即将使用 MPE 开发或辅助的项目，我是主决策者，或我已咨询项目主维护者并得到其允许使用 MPE 进行开发或辅助的答复。（部分项目不使用 MPE 作为主开发工具，一般项目架构会不适配，或会产生大量冗余内容，如果正在参与其他项目的贡献请遵循其项目规范与工具建议）",
  },
];
