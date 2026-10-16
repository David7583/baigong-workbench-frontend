// ============================================================
// File: github_v0001.mjs
// 中文名: github独立栏目视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_category_github
// family: studio_category_github
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/github_v0001.mjs
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
const SCRIPT_NAME='github_v0001.mjs',SCRIPT_FAMILY='studio_category_github',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function render(ctx){renderCollection(ctx,{"title": "收集值得接入的项目", "description": "从第三方 GitHub 仓库获取信息，保存来源，逐步接入有用的能力。", "eyebrow": "GITHUB / THIRD-PARTY SOURCES", "section": "收藏的仓库", "color": "rose", "addHint": "添加仓库地址", "hint": "爬取只读取公开仓库信息；仓库代码不会自动安装或执行。需要 Skill 时，到 Skill 栏下载。"});}
