// ============================================================
// File: plugins_v0001.mjs
// 中文名: plugins独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_plugins
// family: studio_category_plugins
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/plugins_v0001.mjs
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
const SCRIPT_NAME='plugins_v0001.mjs',SCRIPT_FAMILY='studio_category_plugins',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "让工作台多一种可能", "description": "独立保管插件来源和接入入口，按需连接已有扩展。", "eyebrow": "PLUGINS / EXTENSIONS", "section": "我的插件", "color": "rose", "addHint": "添加插件地址与来源", "hint": "添加是目录接入，不会自动运行未知插件代码。可嵌入的本地 Web 界面在工作区打开。"});}
