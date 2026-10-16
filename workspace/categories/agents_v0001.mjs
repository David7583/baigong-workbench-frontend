// ============================================================
// File: agents_v0001.mjs
// 中文名: agents独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_agents
// family: studio_category_agents
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/agents_v0001.mjs
// input:
//   - scoped category context and presentation options
// output:
//   - truthful category cards and explicit actions
// depends_on:
//   - Browser DOM
// used_by:
//   - studio_shell
// ============================================================
import {renderCollection} from './collection_v0001.mjs';
const SCRIPT_NAME='agents_v0001.mjs',SCRIPT_FAMILY='studio_category_agents',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "让 Agent 接取你的能力", "description": "创建独立接取入口，为每个 Agent 分配已启用的 Skill。", "eyebrow": "AI / AGENT CONNECTIONS", "section": "我的 Agent", "color": "blue", "addHint": "添加 Agent 与接取凭证", "hint": "此栏目管理 Agent 的连接与能力分配。工作台不替 Agent 调用模型。"});}
