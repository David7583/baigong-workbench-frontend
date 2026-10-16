// ============================================================
// File: databases_v0001.mjs
// 中文名: databases独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_databases
// family: studio_category_databases
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/databases_v0001.mjs
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
const SCRIPT_NAME='databases_v0001.mjs',SCRIPT_FAMILY='studio_category_databases',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "连接你的本地资料", "description": "选择数据库，在工作区中只读浏览。原始资料仍由自己的存储系统管理。", "eyebrow": "DATABASE / LOCAL SOURCES", "section": "已挂载数据库", "color": "blue", "addHint": "选择数据库文件或路径", "hint": "支持 SQLite、DuckDB 和 Chroma 元数据；挂载不会改写源库。"});}
