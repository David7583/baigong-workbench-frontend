// ============================================================
// File: capability_hub_v0001.mjs
// 中文名: 能力仓库、项目与 MCP 栏目界面
// Version: v0001
// Main Layer: action
// Layer: workbench / workspace
// Responsibilities: 展示能力收集、加载、分配、项目上下文与显式调用。
// Does: 根据后台事实渲染并提交明确操作。
// Does not: 执行代码、保存凭证或伪装连接成功。
// Boundary: 仅使用认证 API；所有内容转义；项目与资产卸载后保留。
// Updatable: True
// ============================================================
// ALIAS_META
// alias: capability_hub_v0001
// family: capability_hub
// role: capability_workspace_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/capability_hub_v0001.mjs
// input:
//   - scoped category context and authenticated capability facts
// output:
//   - category cards, forms and explicit operation results
// depends_on:
//   - Browser DOM
// used_by:
//   - studio_shell_v0004
// ============================================================
const SCRIPT_NAME='capability_hub_v0001',SCRIPT_FAMILY='capability_hub',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
const kinds={skill:'Skill',github:'GitHub 仓库',library:'第三方库',mcp:'MCP',json_cli:'JSON 文件工具'};
const input=(e,name,label,value='')=>'<label class="form-field">'+e(label)+'<input name="'+e(name)+'" value="'+e(value)+'"></label>';
const textarea=(e,name,label,value='',rows=4)=>'<label class="form-field">'+e(label)+'<textarea rows="'+rows+'" name="'+e(name)+'">'+e(value)+'</textarea></label>';
const choices=(e,name,items,selected)=>'<div class="form-options">'+items.map(x=>'<label><input type="checkbox" name="'+e(name)+'" value="'+e(x.id)+'" '+(selected.includes(x.id)?'checked':'')+'>'+e(x.name)+'</label>').join('')+'</div>';
export function render(ctx){
 const {escape:e,target,category,items,data}=ctx;
 const project=category.id==='projects',mcp=category.id==='mcp';
 target.innerHTML='<span class="section-caption">'+(project?'PROJECTS':mcp?'MCP':'CAPABILITIES')+'</span><h1 class="catalog-title">'+e(category.name)+'</h1><p class="catalog-description">'+(project?'保存项目目标、资料目录和能力引用，供你与 Agent 在同一上下文中使用。':mcp?'添加服务后显式启用，再发现工具。实际调用需要单独确认。':'先收集到独立文件夹，再登记 SQL 目录。加载、启用和分配分别管理。')+'</p>'+(!project?'<p class="path-label">资产目录：'+e(data.capability_directory)+'</p>':'')+'<div class="hub-grid">'+items.map(x=>'<article class="hub-card"><span class="section-caption">'+e(project?(x.archived?'已归档':'项目'):kinds[x.kind])+'</span><h2>'+e(x.name)+'</h2><p>'+e(x.description)+'</p><small>'+e(project?(x.id===data.active_project?'当前项目':'未选择'):(x.enabled?'已启用':'未启用')+' · '+(data.loaded_capability_ids.includes(x.id)?'已加载':'未加载'))+'</small><button class="filled" data-hub-open="'+e(x.id)+'">查看与管理</button></article>').join('')+'<button class="hub-card" data-hub-add>＋ '+e(category.add_label)+'</button></div><p class="category-hint">'+(project?'归档只改变目录状态；项目文件保持原位。':'仓库和第三方库作为来源资料保存，执行入口须登记为明确的工具。资产哈希改变时调用会被拒绝。')+'</p>';
 target.querySelector('[data-hub-add]').onclick=()=>add(ctx);
 if(category.id==='capabilities'){const collect=document.createElement('button');collect.textContent='收录已有 Skill、仓库与库记录';collect.dataset.collectExisting='';collect.onclick=()=>ctx.action(async()=>{const result=await ctx.api('capabilities/importExisting',{});await ctx.reload();ctx.log('已收录 '+result.collected+' 项既有资源；启用和分配仍单独管理');});target.prepend(collect);}
 target.querySelectorAll('[data-hub-open]').forEach(button=>button.onclick=()=>open(ctx,items.find(x=>x.id===button.dataset.hubOpen)));
}
export function add(ctx,item){
 const {escape:e,category,data}=ctx;
 if(category.id==='projects'||item?.project_record){
  ctx.dialog(item?'编辑项目':'新建项目',input(e,'name','项目名称',item?.name||'')+input(e,'path','本地项目文件夹（可选）',item?.path||'')+input(e,'description','说明',item?.description||'')+textarea(e,'context','项目目标与上下文',item?.context||'')+'<p>关联能力</p>'+choices(e,'capability',data.capabilities,item?.capability_ids||[])+'<p>共享上下文的 Agent</p>'+choices(e,'agent',data.agents,item?.agent_ids||[]),async f=>ctx.api('capabilities/saveProject',{id:item?.id,name:f.get('name'),path:f.get('path'),description:f.get('description'),context:f.get('context'),capability_ids:f.getAll('capability'),agent_ids:f.getAll('agent')}),'保存项目');return;
 }
 const selected=category.id==='mcp'?'mcp':'skill';
 ctx.dialog('收集能力','<label class="form-field">能力类型<select name="kind">'+Object.entries(kinds).map(([id,name])=>'<option value="'+id+'" '+(id===selected?'selected':'')+'>'+e(name)+'</option>').join('')+'</select></label>'+input(e,'name','名称')+input(e,'path','本地资产文件夹或文件（Skill 须指向含 SKILL.md 的目录）')+input(e,'source','来源网址或说明')+input(e,'version','版本 / GitHub ref','unversioned')+input(e,'license','许可证','unknown')+textarea(e,'description','用途说明','',2)+textarea(e,'descriptor','MCP / JSON 工具接入配置',selected==='mcp'?JSON.stringify({transport:'http',url:'http://127.0.0.1:8000/mcp'},null,2):'{}')+'<label class="form-field"><span><input type="checkbox" name="download"> 从 GitHub 下载完整仓库（来源填仓库网址，版本填分支、标签或 commit）</span></label><p class="category-hint">本地资产复制保存。MCP stdio 配置使用 command、args；凭证使用 token_env 或 env_names 引用环境变量。JSON 工具配置 entry 为相对 .py 入口。</p>',async f=>ctx.api('capabilities/collect',{kind:f.get('kind'),name:f.get('name'),path:f.get('path'),source:f.get('source'),url:f.get('source'),version:f.get('version'),ref:f.get('version'),license:f.get('license'),description:f.get('description'),descriptor:JSON.parse(f.get('descriptor')||'{}'),download:f.has('download')}),'收集并登记');
}
export async function open(ctx,item){
 const {escape:e}=ctx;
 const id='capability-detail:'+item.id;
 let view=[...document.querySelectorAll('[data-hub-detail]')].find(x=>x.dataset.hubDetail===item.id);
 if(!view){view=document.createElement('section');view.className='hub-detail';view.dataset.hubDetail=item.id;}
 ctx.openTab(id,item.name,view);
 const refresh=async()=>{await ctx.reload();const snapshot=await ctx.api('capabilities');item=(item.project_record?snapshot.projects:snapshot.items).find(x=>x.id===item.id);await paint(snapshot);};
 async function paint(snapshot){
  if(item.project_record||item.capability_ids){
   item.project_record=true;
   view.innerHTML='<span class="section-caption">项目上下文</span><h1>'+e(item.name)+'</h1><p>'+e(item.description)+'</p><p class="path-label">'+e(item.path||'未绑定本地目录')+'</p><div class="hub-actions"><button data-project-select class="filled">设为当前项目</button><button data-project-edit>编辑项目</button><button data-project-archive>'+(item.archived?'恢复项目':'归档项目')+'</button></div><pre class="skill-document">'+e(item.context||'暂无上下文')+'</pre><h3>关联能力</h3><ul>'+item.capability_ids.map(id=>'<li>'+e(snapshot.items.find(x=>x.id===id)?.name||id)+'</li>').join('')+'</ul>';
   view.querySelector('[data-project-select]').onclick=()=>ctx.action(async()=>{await ctx.api('capabilities/selectProject',{id:item.id});await refresh();},'已切换当前项目');
   view.querySelector('[data-project-edit]').onclick=()=>add(ctx,item);
   view.querySelector('[data-project-archive]').onclick=()=>ctx.action(async()=>{await ctx.api('capabilities/archiveProject',{id:item.id,archived:!item.archived});await refresh();});return;
  }
  const loaded=snapshot.loaded_ids.includes(item.id);
  view.innerHTML='<span class="section-caption">'+e(kinds[item.kind])+'</span><h1>'+e(item.name)+'</h1><p>'+e(item.description)+'</p><dl class="hub-facts"><dt>版本</dt><dd>'+e(item.version)+'</dd><dt>来源</dt><dd>'+e(item.source)+'</dd><dt>许可证</dt><dd>'+e(item.license)+'</dd><dt>校验</dt><dd>'+e(item.bundle_hash||'服务配置记录，无本地资产')+'</dd></dl><div class="hub-actions"><button data-cap-load>'+(loaded?'从工具栏卸载':'加载到工具栏')+'</button><button data-cap-enable>'+(item.enabled?'停用能力':'启用能力')+'</button><button data-cap-grant>分配给 Agent / 系统</button>'+(['skill','github','library'].includes(item.kind)?'<button data-cap-read class="filled">'+(item.kind==='skill'?'读取 Skill':'解析来源')+'</button>':'')+(item.kind==='mcp'?'<button data-mcp-discover class="filled">连接并发现工具</button>':'')+(item.kind==='json_cli'?'<button data-cli-call class="filled">调用 JSON 工具</button>':'')+'</div><p data-cap-state>'+e(item.enabled?'已启用':'未启用')+' · '+(loaded?'已加载':'未加载')+'</p><div data-mcp-tools></div><pre class="skill-document" data-cap-result>尚未调用。</pre>';
  const perform=async input=>{const value=await ctx.api('capabilities/invoke',{id:item.id,...input});view.querySelector('[data-cap-result]').textContent=JSON.stringify(value,null,2);return value;};
  view.querySelector('[data-cap-load]').onclick=()=>ctx.action(async()=>{await ctx.api('capabilities/load',{id:item.id,loaded:!loaded});await refresh();});
  view.querySelector('[data-cap-enable]').onclick=()=>ctx.action(async()=>{await ctx.api('capabilities/enable',{id:item.id,enabled:!item.enabled});await refresh();});
  view.querySelector('[data-cap-grant]').onclick=()=>ctx.dialog('分配能力','<label class="form-field">调用方<select name="principal"><option value="system">本地系统</option>'+ctx.data.agents.map(x=>'<option value="agent:'+e(x.id)+'">'+e(x.name)+'</option>').join('')+'</select></label><label><input type="checkbox" name="allow" checked>允许接取与按需调用</label>',async f=>ctx.api('capabilities/grant',{id:item.id,principal:f.get('principal'),allow:f.has('allow')}),'保存分配');
  if(view.querySelector('[data-cap-read]'))view.querySelector('[data-cap-read]').onclick=()=>ctx.action(()=>perform({operation:item.kind==='skill'?'read':'reference'}));
  const callDialog=tool=>ctx.dialog('调用 '+(tool?.name||item.name),textarea(e,'arguments','工具参数 JSON','{}')+'<label><input type="checkbox" name="confirm">我确认执行此工具</label>',async f=>{if(!f.has('confirm'))throw new Error('请先确认执行工具');return perform({operation:'call',tool:tool?.name,arguments:JSON.parse(f.get('arguments')||'{}'),confirm_execute:true});},'执行调用');
  if(view.querySelector('[data-cli-call]'))view.querySelector('[data-cli-call]').onclick=()=>callDialog();
  if(view.querySelector('[data-mcp-discover]'))view.querySelector('[data-mcp-discover]').onclick=()=>ctx.action(async()=>{const result=await perform({operation:'discover'});const area=view.querySelector('[data-mcp-tools]');area.innerHTML='<h3>已发现 '+result.tools.length+' 个工具</h3>'+result.tools.map((tool,i)=>'<article class="hub-card"><h3>'+e(tool.name)+'</h3><p>'+e(tool.description||'')+'</p><details><summary>参数格式</summary><pre>'+e(JSON.stringify(tool.inputSchema,null,2))+'</pre></details><button data-mcp-call="'+i+'">调用</button></article>').join('');area.querySelectorAll('[data-mcp-call]').forEach(button=>button.onclick=()=>callDialog(result.tools[Number(button.dataset.mcpCall)]));});
 }
 await paint(await ctx.api('capabilities'));
}
