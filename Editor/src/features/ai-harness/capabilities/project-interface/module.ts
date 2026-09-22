import type { HarnessModule } from '../../core/types';
import { piToolDefinitions, piToolHandlers } from './tools';
export const piHarnessModule: HarnessModule = { tools:piToolDefinitions, toolHandlers:piToolHandlers, capabilityPacks:[{id:'project-interface',version:'1.0.0',description:'PI 查询、配置解析与草稿编辑',skillIds:['maafw-project-interface','mpe-pi-editing'],toolNames:piToolDefinitions.map(t=>t.name)}] };
