import type { HarnessModule } from '../../core/types';

export const piReference: Record<string, string> = {
  项目结构: 'interface.json 声明任务、选项、资源、控制器、导入和翻译。task.entry 指向 Pipeline 节点，task.option 引用 option 字典。定义应写回其原始来源文件。',
  导入: 'import 中 task、preset、group、pretask、setting 追加；option 后导入的同名定义覆盖前面的定义；global_option 追加去重。同名定义不代表可以任意修改其中一份。',
  覆盖顺序: '任务自身 pipeline_override 先应用，再按 global_option、resource.option、controller.option、task.option 解析覆盖。预任务选项只生成程序参数，不参与 Pipeline 覆盖。对象合并和数组替换应由实际解析工具确认，不能把静态关系描述成执行路径。',
  选项: 'select/switch 选择一个 case；checkbox 按 cases 的定义顺序应用被选分支，与勾选先后无关。嵌套选项只随适用且选中的父分支参与。controller/resource 限制不满足时，选项及子分支不生效。',
  输入: 'input.inputs 声明输入字段；pipeline_override 用 {字段名} 占位，pipeline_type 可声明 string/int/bool。修改保留表达式，不能把解析值回写为常量。password 字段实际值不进入 AI 上下文。hotkey 由控制器类型决定键码。',
  草稿与校验: '默认纳入当前 PI 草稿及明确属于资源的 Pipeline 草稿，磁盘模式可显式选择。resolve_pi_configuration 仅解析 PI，未加载框架，不提供框架默认值或真实运行结果。apply_pi_changes 仅加入草稿，保存使用编辑器。',
};
export const piSkillsModule: HarnessModule = { skills: [
  { id: 'maafw-project-interface', version: '1.0.0', name: 'MaaFramework ProjectInterface', description: 'PI 项目、选项和静态覆盖语义', instructions: '先用 read_pi_summary 了解项目；用 read_pi_definitions 和 find_pi_references 批量取得来源证据。按需用 read_mfw_pi_reference 查询协议。解释配置时调用 resolve_pi_configuration，不自行猜测条件、覆盖顺序或框架最终值。关联节点用 read_project_pipeline_nodes 批量查询。缺失任务、资源或控制器时读取候选，不静默选择其他任务。' },
  { id: 'mpe-pi-editing', version: '1.0.0', name: 'MPE PI 编辑', description: '有来源和版本校验的 PI 草稿修改流程', instructions: '画布与 PI 的 stateVersion 独立，不得混用；修改前读取目标域的具体定义、版本及引用；共享选项先检查影响。preview_pi_changes 携带最近查询返回的 stateVersion 作为 expectedPiVersion、versions 作为 expectedVersions，生成 JSONC 局部变更方案，然后 apply_pi_changes 自动应用可用方案，无需额外批准。工具失败不得声称成功，版本变化需重新读取。新增任务可向 task 数组插入定义；新增输入项需设置 option 定义、task.option 引用和目标节点 pipeline_override，保留占位符。批量任务与选项修改使用一个方案。定义改名单独生成方案，复用明确引用检查。只读查询可显式 mode=disk；修改始终基于草稿。应用不等于磁盘保存，完成时说明修改文件、校验和保存状态。Pipeline 修改仅可使用当前画布工具，两域不构成原子事务，一侧失败必须报告已完成部分。' },
] };
