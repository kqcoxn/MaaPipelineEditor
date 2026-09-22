export interface PiFieldHelp {
  description: string;
  example?: string;
}

const hint = (description: string, example?: string): PiFieldHelp => ({ description, example });

// 语义来源：MaaFramework docs/zh_cn/3.3-ProjectInterfaceV2协议.md 与 tools/interface.schema.json。
// 核对参考提交：b8492836568adaabec434199405083ff29c47413。示例仅供阅读，不写入草稿。
const i18n = '支持直接文本或 $翻译键。';
const richText = '支持文本、文件路径或 URL，内容可使用 Markdown，也支持 $翻译键。';
const scopeFilter = '填写定义的 name，不是显示名称或类型；省略时不限制适用范围。';

export const commonHelp: Record<string, PiFieldHelp> = {
  label: hint(`可选。界面显示名称；未设置时通常显示 name。${i18n}`, '$display_name'),
  description: hint(`可选。向使用者说明当前对象的用途。${richText}`),
  icon: hint('可选。相对于项目根目录的图标文件路径，也支持 $翻译键。', 'images/icon.png'),
  controller: hint(`可选。适用的控制器列表。${scopeFilter}`, '["Android"]'),
  resource: hint(`可选。适用的资源包列表。${scopeFilter}`, '["Official"]'),
  pipeline_override: hint('可选。按 Pipeline JSON 结构填写，最外层键必须是节点名；运行时覆盖已加载的节点字段。', '{\n  "Start": { "enabled": true }\n}'),
};

export const rootHelp: Record<string, PiFieldHelp> = {
  name: hint('项目唯一标识符，用作项目 ID；显示给用户的名称可另填 label。', 'MyProject'),
  version: hint('项目资源版本号，用于展示和更新检查；不是 MaaFramework 或 PI 协议版本。', 'v1.0.0'),
  label: hint(`可选。项目显示名称，省略时使用 name。${i18n}`, '$project_name'),
  title: hint(`可选。客户端直接使用此窗口标题；省略时由 name 和 version 拼接。${i18n}`),
  description: hint(`可选。在“关于”页面显示项目说明。${richText}`),
  icon: hint('可选。相对于项目根目录的应用图标路径；省略时使用默认图标。支持 $翻译键。', 'images/logo.png'),
  github: hint('项目 GitHub 仓库地址，用于更新检查和问题反馈。', 'https://github.com/owner/project'),
  contact: hint(`在“关于”页面显示联系方式。${richText}`),
  license: hint(`在“关于”页面显示许可证信息。${richText}`, 'LICENSE.md'),
  welcome: hint(`首次使用时展示的欢迎说明或公告。${richText} 多条公告可在整份文件的源码视图中填写字符串数组。`),
  global_option: hint('可选。填写顶层 option 的键名，参与所有任务的参数合并；仍受选项自身的控制器和资源限制。覆盖优先级：全局 < 资源 < 控制器 < 任务。', '["运行设置"]'),
  import: hint('可选。填写相对于主 interface.json 的 PI 文件路径。依次合并 task、option、preset、group、pretask、global_option、setting；同名 option 以后导入的为准。', '["tasks/daily.json", "options/common.json"]'),
  languages: hint('可选。JSON 对象：键为语言代码，值为相对于 interface.json 的翻译文件路径。', '{\n  "zh_cn": "interface_zh.json",\n  "en_us": "interface_en.json"\n}'),
  interface_version: hint('必填，固定填写数字 2，表示 JSON 结构主版本；不要填写 PI 文档的语义化版本号。', '2'),
  agent: hint('可选。单个对象或对象数组。child_exec 为可执行程序，child_args 为参数数组，identifier 可省略自动生成。工作目录为 interface.json 所在目录。', '{\n  "child_exec": "python",\n  "child_args": ["./agent/main.py"]\n}'),
};

export const objectHelp: Record<string, Record<string, PiFieldHelp>> = {
  task: {
    name: hint('任务唯一标识符。预设等位置按此名称引用；修改时使用上方“重命名”同步引用。'),
    entry: hint('填写 Pipeline 起点节点的名称，不是文件名。可选择已索引节点，也可输入名称后按 Enter 确认。', 'Start'),
    default_check: hint('可选，默认 false。决定客户端初次初始化时是否勾选此任务。'),
    group: hint('可选。填写顶层 group 的 name，可属于多个分组；省略时不属于任何显式分组。', '["daily", "battle"]'),
    option: hint('可选。填写顶层 option 的键名，按列表顺序展示任务配置项；选中值用于生成任务参数。', '["关卡", "次数"]'),
  },
  option: {
    label: hint(`可选。向用户展示的配置项标签。${i18n}`),
    type: hint('可选，默认 select。select 单选、switch 是/否、checkbox 多选、input 文本输入、hotkey 快捷键捕获。switch 需要两个分支，建议命名为 Yes 和 No。'),
    controller: hint(`可选。${scopeFilter} 不匹配时，该选项及其子选项的覆盖参数均不参与合并。`),
    resource: hint(`可选。${scopeFilter} 不匹配时，该选项及其子选项的覆盖参数均不参与合并。`),
    default_case: hint('可选。填写 cases 中的 name，而非显示名称；select / switch 为单个名称，checkbox 为名称数组。'),
    min_count: hint('仅 checkbox 使用。非负整数，默认 0（允许不选）；不能超过分支数量或 max_count。'),
    max_count: hint('仅 checkbox 使用。非负整数；省略时可选全部分支，0 表示不能选择。不能超过分支数量或小于 min_count。'),
    pipeline_override: hint('input / hotkey 类型的参数模板。最外层键是 Pipeline 节点名；用 {字段名} 引用输入值，input 按 pipeline_type 转换类型。', '{\n  "Start": { "post_delay": "{等待时间}" }\n}'),
  },
  cases: {
    name: hint('当前配置项内的分支标识，default_case 引用此名称。switch 的两个分支建议使用 Yes 和 No。', 'Yes'),
    option: hint('可选。填写顶层 option 的键名。仅当前分支被选中时显示这些子选项，避免循环引用。', '["高级设置"]'),
    pipeline_override: hint('仅当前分支激活时覆盖节点参数；多选时按 cases 定义顺序合并，与用户勾选顺序无关。', '{\n  "Start": { "enabled": true }\n}'),
  },
  inputs: {
    name: hint('当前配置项内的输入字段标识；参数模板用 {字段名} 引用此值。', '次数'),
    default: hint('可选。填写字符串形式的初始值；即使 pipeline_type 为 int 或 bool，此处也填字符串。password 为 true 时禁止设置默认值。', '3'),
    pipeline_type: hint('输入值写入 pipeline_override 时的目标类型：string 字符串、int 整数、bool 布尔值。'),
    verify: hint('可选。用于检查用户输入的正则表达式，不加 /…/ 分隔符；在表单里直接输入，JSON 转义由编辑器处理。', '^[0-9]+$'),
    pattern_msg: hint(`可选。输入不满足 verify 正则时显示的提示。${i18n}`, '请输入非负整数'),
    password: hint('可选，默认 false。标记密码或密钥输入，客户端需掩码显示并加密保存。不能同时设置 default，也不要将密码写入 preset。'),
  },
  hotkeys: {
    name: hint('当前配置项内的快捷键字段标识；参数模板用此名称引用按键值。', 'UseTool'),
    default: hint('可选。填写可读的快捷键字符串；用 + 连接，最后一段为主键。不要填写虚拟键码或 JSON 数组。', 'Ctrl+Shift+A'),
  },
  controller: {
    name: hint('控制器唯一标识符。适用控制器字段引用此名称；修改时使用上方“重命名”。'),
    type: hint('选择控制器实现类型，并在“控制器参数”中填写对应配置。可用类型和方式取决于所使用的客户端及操作系统。'),
    option: hint('可选。填写顶层 option 的键名，参数作用于使用此控制器的所有任务；覆盖资源级参数，可被任务级参数覆盖。'),
    display_short_side: hint('可选，默认 720。截图缩放后的短边像素数；与 display_long_side、display_expand、display_raw 互斥。', '720'),
    attach_resource_path: hint('可选。资源路径数组，在 resource.path 全部加载完成后追加加载；填写资源包目录。', '["resource/controller_patch"]'),
    adb: hint('Adb 控制器配置对象。PI V2 的截图和输入方式由 MaaFramework 自动检测，无需手动配置。', '{}'),
    win32: hint('可选。class_regex / window_regex 匹配窗口类名和标题；mouse、keyboard、screencap 指定控制方式，省略使用默认方式。', '{\n  "class_regex": "UnityWndClass",\n  "window_regex": "游戏标题"\n}'),
    playcover: hint('可选。仅 macOS。uuid 为控制器标识符，默认 maa.playcover，与被操控应用无关。', '{ "uuid": "maa.playcover" }'),
    gamepad: hint('可选。仅 Windows，需 ViGEm Bus Driver。gamepad_type 默认为 Xbox360，也可用 DualShock4 / DS4；可用窗口正则指定截图目标。', '{ "gamepad_type": "Xbox360" }'),
    wlroots: hint('此控制器配置取决于客户端支持；请对照所用 MaaFramework 的控制方式说明填写对象。'),
    macos: hint('仅 macOS。title_regex 匹配窗口标题，screencap 和 input 指定截图与输入方式；省略使用默认方式。', '{ "title_regex": "游戏标题" }'),
    linux: hint('仅 Linux。可配置 screencap、input、use_win32_vk_code；PipeWire 截图可用 pipewire_source 选择 Gamescope 或 Portal。'),
  },
  resource: {
    name: hint('资源包唯一标识符。适用资源字段引用此名称；修改时使用上方“重命名”。'),
    path: hint('填写相对于 interface.json 的资源包目录数组，目录内可包含 pipeline、image、model。不要直接填 pipeline 目录；按顺序加载，后加载的资源覆盖前面的同名内容。', '["resource/base", "resource/patch"]'),
    option: hint('可选。填写顶层 option 的键名，参数参与任务合并；覆盖全局参数，可被控制器级和任务级参数覆盖。'),
  },
  group: {
    name: hint('分组唯一标识符，任务通过 group 列表引用此名称；修改时使用上方“重命名”。'),
    default_expand: hint('可选，默认 true。决定客户端初次展示时是否展开该任务分组。'),
  },
  preset: { name: hint('预设唯一标识符，用于区分不同的任务勾选状态和选项快照。') },
  setting: { name: hint('设置分区唯一标识符，用作分区锚点和内部键。') },
  pretask: { name: hint('编辑器用于区分前置任务的名称；执行程序和参数请在当前对象源码中配置 exec 与 args。') },
};

export const sourceHelp: Record<string, PiFieldHelp> = {
  task: hint('编辑完整任务对象。entry 是 Pipeline 节点名，option、group、controller、resource 使用对应定义的标识。'),
  option: hint('编辑当前选项对象。按 type 填写 cases、inputs 或 hotkeys；其他对象通过顶层 option 的键名引用此选项。'),
  controller: hint('编辑完整控制器对象，可在此配置分辨率、权限和对应类型的控制参数。'),
  resource: hint('编辑完整资源对象；path 为资源包路径数组，hash 可用于资源完整性校验。'),
  group: hint('编辑分组对象；name 供任务引用，default_expand 默认为 true。'),
  preset: hint('task 数组内填写任务 name、enabled（默认 true）和 option 预设值。选项值按其类型填写；密码输入不要写入预设。', '{\n  "name": "日常",\n  "task": [{ "name": "领取奖励", "enabled": true }]\n}'),
  setting: hint('设置分区通过 option 数组引用顶层选项，按顺序展示；default_expand 默认为 true。', '{\n  "name": "通用设置",\n  "option": ["运行设置"],\n  "default_expand": true\n}'),
  pretask: hint('创建或连接控制器之前执行的程序。exec 为可执行程序，args 为参数数组，工作目录为 interface.json 所在目录；option 指定传入取值的选项。', '{\n  "exec": "python",\n  "args": ["./scripts/prepare.py"]\n}'),
};
