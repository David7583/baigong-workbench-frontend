// ============================================================
// File: collection_v0001.mjs
// 中文名: 独立栏目共有资源卡片视图
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// Updatable: True
// Purpose: 以相同交互契约呈现各栏独立资源集合。
// Boundary: 不执行资源，打开和管理交给所属栏目服务。
// ============================================================
// ALIAS_META
// alias: studio_collection
// family: studio_collection
// role: reusable_category_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/collection_v0001.mjs
// input:
//   - scoped category context and presentation options
// output:
//   - truthful category cards and explicit actions
// depends_on:
//   - Browser DOM
// used_by:
//   - seven independent category modules
// ============================================================
const SCRIPT_NAME='collection_v0001.mjs',SCRIPT_FAMILY='studio_collection',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export function renderCollection(ctx,options={}){
 const {target,escape:e,items,category,icon}=ctx;
 const description=options.description||category.description;
 const tags={tools:'独立工具',skills:'本地 Skill',agents:'接取入口',databases:'只读挂载',plugins:'扩展目录',software:'软件目录',github:'来源仓库'};
 target.innerHTML='<div class="catalog-banner"><div><span class="section-caption">'+e(options.eyebrow||'LOCAL / '+category.id.toUpperCase())+'</span><h1 class="catalog-title">'+e(options.title||category.name+'资源库')+'</h1><p class="catalog-description">'+e(description)+'</p></div><div class="category-stamp">'+icon+'</div></div><div class="catalog-toolbar"><strong>'+e(options.section||'我的'+category.name)+'</strong><span>'+items.length+' 项资源 · 独立栏目</span></div><div class="card-grid">'+items.map(item=>'<article class="resource-card" data-card="'+e(item.id)+'"><div class="card-top"><span class="card-symbol '+e(options.color||'')+'">'+icon+'</span><span class="card-tag">'+e(item.native?'待适配':category.id==='skills'?(item.enabled?'已启用':'未启用'):tags[category.id]||'资源')+'</span></div><h3>'+e(item.name)+'</h3><p>'+e(item.description||category.description)+'</p><div class="card-bottom"><span>'+e(item.native?'原生窗口':item.builtin?'独立运行':category.id==='skills'?(item.origin==='local'?'本地导入':'已下载'):category.id==='agents'?(item.skill_ids.length+' 个 Skill'):'已添加')+'</span><span><button data-remove="'+e(item.id)+'" title="只从工作台移除，不删除功能">解除加载</button>'+(category.id==='skills'?'<button data-enable="'+e(item.id)+'">'+(item.enabled?'停用':'启用')+'</button>':'')+'<button data-open="'+e(item.id)+'">'+(category.id==='skills'?'查看说明':category.id==='agents'?'分配 Skill':category.id==='databases'?'浏览':'打开')+' ↗</button></span></div></article>').join('')+'<button class="resource-card card-add" data-add><span class="add-glyph">＋</span><strong>'+e(category.add_label||('添加'+category.name))+'</strong><p>'+e(options.addHint||'连接你需要的资源')+'</p></button></div><p class="category-hint"><span>'+icon+'</span>'+e(options.hint||'每个资源由自己的应用负责执行，工作台负责目录、接入与展示。')+'</p>';
 target.querySelector('[data-add]').onclick=ctx.add;
 target.querySelectorAll('[data-remove]').forEach(button=>button.onclick=event=>{event.stopPropagation();ctx.remove(items.find(x=>x.id===button.dataset.remove));});
 target.querySelectorAll('[data-card]').forEach(card=>card.onclick=()=>ctx.inspect(items.find(x=>x.id===card.dataset.card)));
 target.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>ctx.open(items.find(x=>x.id===button.dataset.open)));
 target.querySelectorAll('[data-enable]').forEach(button=>button.onclick=()=>ctx.action(async()=>{const item=items.find(x=>x.id===button.dataset.enable);await ctx.api('studio/toggle',{id:item.id,enabled:!item.enabled});await ctx.reload();},'Skill 状态已更新'));
}
export function render(ctx){renderCollection(ctx);}
