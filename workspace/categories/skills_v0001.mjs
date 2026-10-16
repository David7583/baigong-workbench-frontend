// ============================================================
// File: skills_v0001.mjs
// 中文名: skills独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_skills
// family: studio_category_skills
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/skills_v0001.mjs
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
const SCRIPT_NAME='skills_v0001.mjs',SCRIPT_FAMILY='studio_category_skills',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "把经验变成可用的能力", "description": "下载、归档、启用，再把 Skill 交给合适的 Agent。", "eyebrow": "SKILL / LOCAL MARKETPLACE", "section": "已安装 Skill", "color": "gold", "addHint": "本地导入或从 GitHub 下载", "hint": "所有 Skill 统一保存在本地市场目录。查看说明、启用与分配分别进行；Skill 包不会自动执行。"});}
