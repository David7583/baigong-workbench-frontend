// ============================================================
// File: github_v0002.mjs
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
// entry_point: frontend/local_ai_workbench/workspace/categories/github_v0002.mjs
// input:
//   - scoped category context and presentation options
// output:
//   - truthful category cards and explicit actions
// depends_on:
//   - Browser DOM
// used_by:
//   - studio_shell
// ============================================================
import {open} from './capability_hub_v0002.mjs';
export function render(ctx){const {target,escape:e,items}=ctx;target.innerHTML='<span class="section-caption">GITHUB / 来源与本地包监管</span><h1 class="catalog-title">GitHub</h1><p class="catalog-description">来源登记、固定版本与已下载源码统一展示。文件核验无需启用或执行仓库。</p><div class="hub-grid">'+items.map(x=>'<article class="hub-card"><small>'+e(x.capability_record?(x.asset_state==='downloaded'?'已下载':x.asset_state==='missing'?'文件缺失':'仅来源登记'):'旧目录记录')+' · '+e(x.version||'未指定版本')+'</small><h2>'+e(x.name)+'</h2><p>'+e(x.description||'')+'</p><p>'+e(x.source||x.url||'')+'</p><small>'+e(x.license||'许可未确认')+' · '+e(x.enabled?'已启用':'未启用')+'</small><button data-github-open="'+e(x.id)+'">查看与监管</button></article>').join('')+'<button class="hub-card" data-github-add>＋ 收集仓库</button></div>';target.querySelector('[data-github-add]').onclick=ctx.add;target.querySelectorAll('[data-github-open]').forEach(b=>b.onclick=()=>{const item=items.find(x=>x.id===b.dataset.githubOpen);item.capability_record?ctx.action(()=>open(ctx,item)):ctx.open(item);});}
