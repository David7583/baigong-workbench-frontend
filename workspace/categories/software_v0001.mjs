// ============================================================
// File: software_v0001.mjs
// 中文名: software独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_software
// family: studio_category_software
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/software_v0001.mjs
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
const SCRIPT_NAME='software_v0001.mjs',SCRIPT_FAMILY='studio_category_software',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "你的软件资源架", "description": "统一管理本机软件和界面入口，让各应用保持自己的运行方式。", "eyebrow": "SOFTWARE / LOCAL APPLICATIONS", "section": "本机软件", "color": "blue", "addHint": "添加软件入口或本地服务", "hint": "软件目录与工具栏独立管理。可嵌入的本地服务使用工作区标签，原生应用需提供界面适配。"});}
