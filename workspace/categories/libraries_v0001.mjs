// ============================================================
// File: libraries_v0001.mjs
// 中文名: software独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_libraries
// family: studio_category_libraries
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/libraries_v0001.mjs
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
const SCRIPT_NAME='libraries_v0001.mjs',SCRIPT_FAMILY='studio_category_libraries',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "你的第三方库资源架", "description": "展示 Python、Node 依赖及版本，保存库的用途与来源。", "eyebrow": "LIBRARIES / LOCAL DEPENDENCIES", "section": "本地第三方库", "color": "blue", "addHint": "添加库名、来源和本地路径", "hint": "扫描只读取本地区依赖元数据；卸载只移除工作台展示，保留已安装的库。"});}
