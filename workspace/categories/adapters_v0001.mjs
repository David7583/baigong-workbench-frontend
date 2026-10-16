// ============================================================
// 文件名: adapters_v0001.mjs
// 中文名: 适配器分目录管理界面
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 适配器目录及版本详情界面
// 职责说明: 展示真实适配目录、版本契约与接入状态。
// 本脚本做什么: 分目录搜索、显式加载卸载、只读检查和契约引用。
// 本脚本不做什么: 不执行适配器、不删除原文件、不推断后台进程状态。
// 制度边界声明: 操作使用统一加载审批，元数据由后端提供。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: adapters_v0001
// family: adapters
// role: adapter_catalog_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/adapters_v0001.mjs
// input:
//   - adapter catalog and scoped loading API
// output:
//   - directory tree, contract details and explicit selection
// depends_on:
//   - Browser DOM
// used_by:
//   - studio_shell_v0022
// ============================================================
const SCRIPT_NAME='adapters_v0001',SCRIPT_VERSION='v0001',SCRIPT_FAMILY='adapters',DEFAULT_ENCODING='utf8';
let query='',stateFilter='all';
const closed=new Set();
function style(){if(document.querySelector('link[data-adapter-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../adapter_catalog_v0001.css',import.meta.url).href;link.dataset.adapterStyle='';document.head.append(link);}
const status=x=>x.source_changed?'来源已变化':!x.available?'来源待修复':x.loaded?'已加载':'未加载';
export function render(ctx){
 style();const {target,escape:e}=ctx;target.classList.add('adapter-catalog');const catalog=ctx.data.adapter_catalog;
 target.innerHTML='<span class="section-caption">ADAPTERS</span><h1 class="catalog-title">适配器</h1><p class="catalog-description">按来源、实际子目录和脚本家族管理版本。加载接入契约目录；卸载保留文件与原后端调用。</p><div class="adapter-controls"><input data-adapter-search aria-label="搜索适配器目录" placeholder="搜索目录、家族、名称、版本或契约"><select data-adapter-state aria-label="适配器接入状态"><option value="all">全部状态</option><option value="loaded">已加载</option><option value="unloaded">未加载</option><option value="attention">需检查</option></select><button data-adapter-expand>全部展开</button><button data-adapter-collapse>全部折叠</button><button data-adapter-rescan>扫描适配器</button></div><p class="adapter-summary" role="status"></p><div class="adapter-tree"></div><details class="adapter-sources"><summary>扫描范围与结果</summary><p>'+e(catalog.scan?'上次扫描：'+catalog.scan.at:'尚未扫描；打开栏目不会自动扫描或加载')+'</p>'+catalog.sources.map(x=>'<p>'+e(x.name)+' · '+e(x.path)+'</p>').join('')+(catalog.scan?.errors||[]).map(x=>'<p class="adapter-warning">'+e(x.path+'：'+x.error)+'</p>').join('')+'</details>';
 target.querySelector('[data-adapter-search]').value=query;target.querySelector('[data-adapter-state]').value=stateFilter;
 function draw(){
  const needle=query.toLocaleLowerCase(),rows=ctx.items.filter(x=>[x.name,x.path,x.alias,x.family,x.version,...x.directory,...x.input,...x.output].join(' ').toLocaleLowerCase().includes(needle)).filter(x=>stateFilter==='all'||stateFilter==='loaded'&&x.loaded||stateFilter==='unloaded'&&!x.loaded||stateFilter==='attention'&&(!x.available||x.source_changed));
  target.querySelector('.adapter-summary').textContent='显示 '+rows.length+' / '+catalog.items.length+' 个版本 · 已加载 '+catalog.items.filter(x=>x.loaded).length+'。目录操作只作用于当前筛选结果中的条目。';
  const tree={children:new Map(),items:[],all:[]};for(const row of rows){let branch=tree;branch.all.push(row);for(const part of row.directory){if(!branch.children.has(part))branch.children.set(part,{children:new Map(),items:[],all:[]});branch=branch.children.get(part);branch.all.push(row);}branch.items.push(row);}
  const container=target.querySelector('.adapter-tree');container.replaceChildren();
  function append(branch,parent,parts=[]){for(const [name,child] of [...branch.children].sort((a,b)=>a[0].localeCompare(b[0]))){const key=JSON.stringify([...parts,name]),details=document.createElement('details');details.className='adapter-directory';details.dataset.adapterDirectory=[...parts,name].join('/');details.open=!!query||!closed.has(key);details.innerHTML='<summary><strong>'+e(name)+'</strong><small>'+child.all.length+' 个版本 · '+child.all.filter(x=>x.loaded).length+' 已加载</small><span class="adapter-directory-actions"><button data-dir-load '+(!child.all.some(x=>!x.loaded&&x.available)?'disabled':'')+'>加载本目录</button><button data-dir-unload '+(!child.all.some(x=>x.loaded)?'disabled':'')+'>卸载本目录</button></span></summary>';details.addEventListener('toggle',()=>{if(details.open)closed.delete(key);else closed.add(key);});for(const load of [true,false])details.querySelector(load?'[data-dir-load]':'[data-dir-unload]').onclick=ev=>{ev.preventDefault();ev.stopPropagation();ctx.action(()=>ctx.loading(load?'load':'unload',child.all.filter(x=>load?!x.loaded&&x.available:x.loaded).map(x=>x.key),'adapters'));};append(child,details,[...parts,name]);parent.append(details);}
   for(const item of branch.items.sort((a,b)=>a.version.localeCompare(b.version)||a.path.localeCompare(b.path))){const row=document.createElement('article');row.className='adapter-entry';row.dataset.adapterId=item.id;row.innerHTML='<button class="adapter-entry-title" data-adapter-open><strong>'+e(item.name)+'</strong><small>'+e(item.version+' · '+item.declared_status)+'</small></button><span class="adapter-state '+(!item.available||item.source_changed?'adapter-warning':'')+'">'+e(status(item))+'</span><span class="adapter-entry-path">'+e(item.path)+'</span><button data-adapter-toggle '+(!item.loaded&&!item.available?'disabled':'')+'>'+(item.loaded?'卸载':'加载')+'</button>';row.querySelector('[data-adapter-open]').onclick=()=>ctx.action(()=>open(ctx,item));row.querySelector('[data-adapter-toggle]').onclick=()=>ctx.action(()=>ctx.loading(item.loaded?'unload':'load',[item.key],'adapters'));parent.append(row);}
  }
  append(tree,container);if(!rows.length)container.innerHTML='<p class="platform-empty">'+(catalog.scan?'没有符合筛选条件的适配器。':'尚无扫描结果。点击“扫描适配器”读取后端真实文件声明。')+'</p>';
 }
 target.querySelector('[data-adapter-search]').oninput=ev=>{query=ev.target.value;draw();};target.querySelector('[data-adapter-state]').onchange=ev=>{stateFilter=ev.target.value;draw();};
 target.querySelector('[data-adapter-expand]').onclick=()=>{closed.clear();target.querySelectorAll('.adapter-directory').forEach(x=>x.open=true);};target.querySelector('[data-adapter-collapse]').onclick=()=>target.querySelectorAll('.adapter-directory').forEach(x=>x.open=false);
 target.querySelector('[data-adapter-rescan]').onclick=()=>ctx.action(ctx.scanLoading);draw();
}
export async function open(ctx,initial){
 style();const e=ctx.escape,newView=document.createElement('section');newView.className='platform-pane adapter-detail';newView.dataset.adapterDetail=initial.id;const view=ctx.openTab(initial.id,initial.name,newView);if(view!==newView){await view.adapterRefresh?.();return;}
 let item=initial,check=null,reference=null,disposed=false;const abort=new AbortController();
 async function refresh(){const catalog=await ctx.api('adapters');if(disposed)return;item=catalog.items.find(x=>x.id===initial.id);paint();}
 function paint(){if(!item){view.textContent='此适配器不在当前扫描目录中。';return;}const values=items=>items.length?items.map(x=>'<li>'+e(x)+'</li>').join(''):'<li>未声明</li>';
  view.innerHTML='<span class="section-caption">'+e(item.directory.join(' / '))+'</span><h1>'+e(item.name)+'</h1><p>'+e(item.version+' · 声明状态 '+item.declared_status+' · '+status(item))+'</p><p class="adapter-warning">'+e(item.reason||(item.source_changed?'接入版本与文件已不一致；卸载后核对并重新加载。':''))+'</p><div class="adapter-controls"><button data-adapter-toggle '+(!item.loaded&&!item.available?'disabled':'')+'>'+(item.loaded?'卸载':'加载到工作台')+'</button><button data-adapter-check>检查来源与依赖</button><button data-adapter-reference '+(!item.reference_ready?'disabled':'')+'>查看可复用契约引用</button><button data-adapter-refresh>刷新状态</button></div><dl class="adapter-facts"><dt>家族 / Alias</dt><dd>'+e(item.family+' / '+item.alias)+'</dd><dt>来源</dt><dd>'+e(item.path)+'</dd><dt>SHA-256</dt><dd>'+e(item.sha256)+'</dd><dt>加载版本指纹</dt><dd>'+e(item.pinned_sha256||'未加载')+'</dd><dt>后台运行</dt><dd>'+e(item.runtime_state)+'</dd></dl><div class="adapter-contract"><section><h3>输入声明</h3><ul>'+values(item.input)+'</ul></section><section><h3>输出声明</h3><ul>'+values(item.output)+'</ul></section><section><h3>依赖声明</h3><ul>'+values(item.depends_on)+'</ul></section><section><h3>调用方声明</h3><ul>'+values(item.used_by)+'</ul></section></div><p>加载后可在全局检索找到本版本，也可在能力编排的“资源 / 适配器契约”中引用说明。执行转换仍使用原调用入口及其权限。</p><div data-adapter-check-result></div><div data-adapter-reference-result></div>';
  if(check)view.querySelector('[data-adapter-check-result]').innerHTML='<h3>只读检查结果</h3><p>检查时刻 '+e(check.at)+' · 来源'+(check.source_available?'通过':'未通过')+' · 未执行脚本或测试真实服务</p><ul>'+check.dependencies.map(x=>'<li>'+e(x.name+'：'+x.status+' · '+x.detail)+'</li>').join('')+'</ul>';
  if(reference)view.querySelector('[data-adapter-reference-result]').innerHTML='<h3>固定版本契约引用</h3><pre>'+e(JSON.stringify(reference,null,2))+'</pre>';
  view.querySelector('[data-adapter-toggle]').onclick=()=>ctx.action(()=>ctx.loading(item.loaded?'unload':'load',[item.key],'adapters'));
  view.querySelector('[data-adapter-check]').onclick=()=>ctx.action(async()=>{check=await ctx.api('adapters/check',{id:item.id});await refresh();});
  view.querySelector('[data-adapter-reference]').onclick=()=>ctx.action(async()=>{reference=await ctx.api('adapters/reference',{id:item.id,sha256:item.pinned_sha256});paint();});
  view.querySelector('[data-adapter-refresh]').onclick=()=>ctx.action(refresh);
 }
 view.adapterRefresh=refresh;window.addEventListener('workbench-adapters-change',()=>{reference=null;void ctx.action(refresh);},{signal:abort.signal});const observer=new MutationObserver(()=>{if(view.isConnected)return;disposed=true;abort.abort();observer.disconnect();});observer.observe(document.body,{subtree:true,childList:true});await refresh();
}
