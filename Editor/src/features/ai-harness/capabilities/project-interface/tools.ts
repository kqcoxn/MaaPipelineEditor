import { piReferences } from "./references";
import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult, ToolHandler } from '../../core/types';
import { usePiEditorStore } from '@/features/pi-editor/store';
import { valueAt, rawAt } from '@/features/pi-editor/json';
import { piReference } from '../../skills/project-interface/module';
import { queryPi } from './query';
import { currentConfiguration } from './context';
import { piCommandBus } from './commandBus';
import { redactPi } from './privacy';
import type { PiOperation, PiQuery, PiQueryResult } from './types';

const mode = { type: 'string', enum: ['draft','disk'] };
const names = { type: 'array', items: { type: 'string' }, maxItems: 100 };
const configuration = { type: 'object', properties: { taskName: { type: 'string' }, controllerName: { type: 'string' }, resourceName: { type: 'string' }, optionValues: { type: 'object' } }, additionalProperties: false };
const definition = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolDefinition => ({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } });
export const piToolDefinitions: ToolDefinition[] = [
  definition('read_pi_summary', '读取项目、任务/选项摘要、来源版本和草稿状态；默认包含草稿', { mode }),
  definition('read_pi_definitions', '批量读取定义和源码；同名返回所有候选。使用返回的 file、pointer 定位写入', { mode, names, kind: { type: 'string' }, sources: { type:'array', items:{type:'object',properties:{file:{type:'string'},pointer:{type:'string'}},required:['file','pointer'],additionalProperties:false} } }),
  definition('find_pi_references', '查询直接或嵌套静态引用、任务入口和覆盖目标；配置适用性不是执行路径', { mode, name: { type: 'string' }, kind: { type: 'string' }, configuration }, ['name']),
  definition('read_project_pipeline_nodes', '跨资源文件批量读取节点各层原始定义，不切换画布，不返回框架归一化最终值', { mode, names, configuration }, ['names']),
  definition('resolve_pi_configuration', '用实际 PI 解析器分析配置及覆盖来源，缺少选择时返回错误；不加载设备/Agent/框架', { mode, configuration }),
  definition('read_mfw_pi_reference', '读取内置 PI 协议目录或章节', { section: { type: 'string' } }),
  definition('preview_pi_changes', '预览批量局部修改，返回差异、诊断和可应用方案 ID。改名须单独调用', { expectedPiVersion: {type:'integer',minimum:0}, expectedVersions: {type:'object',additionalProperties:{type:'string'}}, operations: { type:'array', minItems:1, maxItems:100, items:{type:'object', properties:{type:{type:'string',enum:['set','remove','insert','move','rename']},file:{type:'string'},pointer:{type:'string'},value:{},index:{type:'integer',minimum:0},to:{type:'integer',minimum:0},name:{type:'string',minLength:1}},required:['type','file','pointer'],additionalProperties:false} } }, ['operations','expectedPiVersion','expectedVersions']),
  definition('apply_pi_changes', '校验来源版本，将本次 Run 的方案整体加入可撤销 PI 草稿；不保存磁盘', { planId: { type:'string' } }, ['planId']),
  definition('validate_pi', '校验 PI 及明确的 Pipeline 目标引用，返回诊断和检查范围', { mode }),
];

const ok = (data: unknown, extra: Partial<ToolExecutionResult> = {}): ToolExecutionResult => ({ ok:true, data, stateDomain:'pi', stateVersion:usePiEditorStore.getState().revision, ...extra });
const metadata = (r: PiQueryResult) => ({ mode:r.mode, entryPath:r.project.entryPath, includedDrafts:r.includedDrafts, versions:r.versions, limit:r.limit, diagnostics:r.diagnostics });
async function execute(name: string, args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolExecutionResult> {
  if(name==='read_mfw_pi_reference') {
    const section=args.section as string|undefined;
    if(section && !(section in piReference))throw new Error('未知章节，请先读取目录');
    return ok(section ? {section,content:piReference[section]} : {sections:Object.keys(piReference)});
  }
  if(name==='preview_pi_changes') {const result=await piCommandBus.preview(context,args.operations as PiOperation[], Number(args.expectedPiVersion), args.expectedVersions as Record<string,string>);return ok(redactPi(result.data,result.project));}
  if(name==='apply_pi_changes') {const data=await piCommandBus.apply(context,String(args.planId));return ok(data,{undoable:true,changedDomains:['pi'],changes:data.files});}
  const query:PiQuery = {mode:args.mode as PiQuery['mode'],configuration:args.configuration as PiQuery['configuration']};
  if(name==='read_project_pipeline_nodes'){query.kind='nodes';query.names=args.names as string[];}
  if(name==='validate_pi') {query.kind='validate';query.configuration={resourceName:'',controllerName:''};}
  if(name==='resolve_pi_configuration')query.kind='nodes';
  const result=await queryPi(context,query,name==='resolve_pi_configuration'||name==='find_pi_references'&&Boolean(args.configuration));
  let data:unknown;
  switch(name){
    case 'read_pi_summary': data={...metadata(result),configuration:{...currentConfiguration(),optionValues:undefined},documents:result.project.documents.map(d=>({file:d.path,kind:d.kind,version:d.version,imported:d.imported,error:d.error})),definitions:result.project.definitions};break;
    case 'read_pi_definitions': {
      const sources=args.sources as Array<{file:string;pointer:string}>|undefined;
      data={...metadata(result),definitions:result.project.definitions.filter(d=>(!args.kind||args.kind===d.kind)&&(!(args.names as string[]|undefined)?.length||(args.names as string[]).includes(d.name))&&(!sources?.length||sources.some(s=>s.file===d.file&&s.pointer===d.pointer))).map(d=>{const doc=result.project.documents.find(doc=>doc.path===d.file)!;return {...d,version:doc.version,value:valueAt(doc.content,d.pointer),raw:rawAt(doc.content,d.pointer)};})};break;
    }
    case 'find_pi_references': data={...metadata(result),...piReferences(result,String(args.name),args.kind as string|undefined,query.configuration?.taskName??currentConfiguration().taskName)};break;
    case 'read_project_pipeline_nodes': data={...metadata(result),nodes:result.nodes,resourcePaths:result.resourcePaths};break;
    case 'resolve_pi_configuration': data={...metadata(result),valid:!result.diagnostics.some(d=>d.severity==='error'),events:result.events,values:result.values,configuration:query.configuration??{...currentConfiguration(),optionValues:undefined},redacted:true};break;
    default: data={...metadata(result),valid:!result.diagnostics.some(d=>d.severity==='error'),checked:['PI Schema','PI 静态引用','Pipeline 目标存在性'],unchecked:['框架最终值','实际执行路径']};
  }
  return ok(redactPi(data,result.project));
}
export const piToolHandlers: Record<string,ToolHandler> = Object.fromEntries(piToolDefinitions.map(d=>[d.name,async(args:Record<string,unknown>,context:ToolExecutionContext)=>{
  try{return await execute(d.name,args,context);}catch(error){return {ok:false,stateDomain:'pi' as const,stateVersion:usePiEditorStore.getState().revision,error:{code:'state_conflict' as const,message:error instanceof Error?error.message:String(error),retryable:false}};}
}]));
