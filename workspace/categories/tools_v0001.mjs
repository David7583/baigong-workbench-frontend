// ============================================================
// File: tools_v0001.mjs
// 中文名: tools独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_tools
// family: studio_category_tools
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/tools_v0001.mjs
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
const SCRIPT_NAME='tools_v0001.mjs',SCRIPT_FAMILY='studio_category_tools',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "你的本地工具箱", "description": "把独立工具放到同一张工作台上。打开它，界面就在这里。", "eyebrow": "TOOLS / INDEPENDENT RESOURCES", "section": "我的工具", "addHint": "接入一个独立工具", "hint": "工具保持独立运行；关闭标签或工作台，只会关闭观察界面。原生窗口工具需要提供嵌入接口。"});}
