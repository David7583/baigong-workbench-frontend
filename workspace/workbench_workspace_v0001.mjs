// ============================================================
// 文件名: workbench_workspace_v0001.mjs
// 中文名: 资源工作空间、检查器与运行面板交互
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 资源工作空间、检查器与运行面板交互
//
// 职责说明:
// - 资源工作空间、检查器与运行面板交互
//
// 本脚本做什么:
// - 组织资源标签、检查器、运行面板与多库只读浏览交互
//
// 本脚本不做什么:
// - 不替代独立业务资源，不自动授权或调用模型
//
// 制度边界声明:
// - 仅工作台配置和索引可写；测试写入独立临时目录，原始业务数据只读
// - 失败保留分类诊断，不返回伪成功；依赖由项目局部安装
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: workbench_workspace_v0001
// family: workbench_workspace
// role: workbench_component
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/workbench_workspace_v0001.mjs
// input:
//   - backend snapshots, events and explicit user actions
// output:
//   - workspace UI and authenticated command requests
// depends_on:
//   - workbench_api_v0001
//   - workbench_layout_v0001
//   - workbench_canvas_v0001
//   - workbench_business_v0001 (lazy import)
//   - workbench_user_v0001 (lazy import)
// used_by: []
// ============================================================

import {Api} from './workbench_api_v0001.mjs';
import {Layout} from './workbench_layout_v0001.mjs';
import {CanvasView} from '../visualization/workbench_canvas_v0001.mjs';
const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_workspace';
const SCRIPT_NAME = 'workbench_workspace_v0001';
const SCRIPT_VERSION = 'v0001';

// ============================================================
// 纯显示工具；原始标识不改写
// ============================================================
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={inspect:'查看',health:'检查健康',attach:'连接',detach:'断开观察',logs:'日志',runs:'运行记录',open:'打开',open_folder:'打开目录',open_output:'打开输出',launch:'启动',stop:'停止',restart:'重启'};
const legacyNames={system:'系统与数据库',functions:'功能登记',tasks:'任务登记',usage:'Token 用量',events:'历史日志'};
function pretty(value){return '<pre>'+escape(JSON.stringify(value,null,2))+'</pre>';}
function resourceFacts(item){return '<section class="surface"><h3>来源与接入</h3><dl class="fact-grid"><dt>资源身份</dt><dd class="source">'+escape(item.resource_id)+'</dd><dt>位置</dt><dd class="source">'+escape(item.entry.path || item.entry.endpoint || item.source)+'</dd><dt>版本</dt><dd>'+escape(item.version)+'</dd><dt>已声明能力</dt><dd>'+escape(item.capabilities.join(' · ') || '无')+'</dd><dt>状态说明</dt><dd>'+escape(item.detail || '尚无状态观测')+'</dd></dl><details><summary>完整资源声明与观测</summary>'+pretty(item)+'</details></section>';}
// ============================================================
// UI 编排入口
// ============================================================
async function main(){
  const api=new Api(),$=id=>document.getElementById(id);
  let mode='user',userView=null,modeGeneration=0;
  let snapshot={resources:[],runs:[],problems:[],cursor:0},ui={tabs:['home'],active:'home',cameras:{},favorites:[]};
  let selected=null,objectSelection=null,panel='runs',events=[],view=null,refreshTimer=null,saveTimer=null,renderGeneration=0,actionRequest=null;
  const toast=message=>{$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,6000);};
  const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>api.call('workspace',{...ui,layout:layout.value}).catch(error=>toast(error.message)),300);};
  const layout=new Layout($('app'),save);
  const resource=id=>snapshot.resources.find(x=>x.resource_id===id);
  function title(id){return id==='home'?'工作台':id==='business'?'业务仪表盘':id==='databases'?'数据库挂载':id.startsWith('legacy.')?(legacyNames[id.slice(7)] || id):id.startsWith('graph:')?'2D · '+(resource(id.slice(6))?.display_name || '数据投影'):resource(id)?.display_name || id;}
  function tabState(id){
    const item=resource(id.startsWith('graph:')?id.slice(6):id);if(!item)return '';
    if(snapshot.runs.some(r=>r.resource_id===item.resource_id&&['queued','running'].includes(r.state)))return 'Running';
    if(item.connection.status==='error'||item.health.status==='unavailable')return 'Error';
    if(item.connection.status==='disconnected')return 'Disconnected';
    if(item.health.status==='degraded'||item.stale)return 'Warning';
    if(ui.active!==id&&events.some(e=>e.seq>(ui.seen?.[id] || 0)&&e.payload.resource_id===item.resource_id))return 'Changed';
    return item.health.status==='available'?'Ready':'Warning';
  }
  function renderTabs(){
    $('tabs').innerHTML=ui.tabs.map(id=>'<button role="tab" aria-selected="'+(id===ui.active)+'" draggable="true" class="tab '+(id===ui.active?'active':'')+'" data-tab="'+escape(id)+'">'+escape(title(id))+' <small>'+tabState(id)+'</small><span class="tab-close" data-close="'+escape(id)+'">×</span></button>').join('');
    let drag;
    for(const button of $('tabs').querySelectorAll('[data-tab]')){
      button.onclick=event=>{if(event.target.dataset.close){const index=ui.tabs.indexOf(button.dataset.tab);ui.tabs.splice(index,1);if(!ui.tabs.length)ui.tabs=['home'];if(ui.active===button.dataset.tab)ui.active=ui.tabs[Math.max(0,index-1)] || ui.tabs[0];save();renderView();}else open(button.dataset.tab);};
      button.ondragstart=()=>drag=button.dataset.tab;button.ondragover=event=>event.preventDefault();
      button.ondrop=event=>{event.preventDefault();if(!drag)return;const from=ui.tabs.indexOf(drag),to=ui.tabs.indexOf(button.dataset.tab);ui.tabs.splice(from,1);ui.tabs.splice(to,0,drag);renderTabs();save();};
      button.onkeydown=event=>{if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){const i=ui.tabs.indexOf(button.dataset.tab),j=i+(event.key==='ArrowLeft'?-1:1);if(j>=0&&j<ui.tabs.length){[ui.tabs[i],ui.tabs[j]]=[ui.tabs[j],ui.tabs[i]];renderTabs();save();}}};
    }
  }
  function renderExplorer(){
    const filter=$('command').value.toLowerCase(),category=$('category').value;
    const categories=[...new Set(snapshot.resources.map(x=>x.resource_type))].sort();
    $('category').innerHTML='<option value="">全部类型</option>'+categories.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join('');$('category').value=category;
    $('resource-list').innerHTML=snapshot.resources.filter(x=>(!category||x.resource_type===category)&&(!filter||filter.startsWith('/')||x.display_name.toLowerCase().includes(filter)||x.resource_id.toLowerCase().includes(filter))).sort((a,b)=>Number(ui.favorites.includes(b.resource_id))-Number(ui.favorites.includes(a.resource_id))).map(x=>'<button class="resource '+(x.resource_id===selected?'selected':'')+'" data-resource="'+escape(x.resource_id)+'"><strong>'+(ui.favorites.includes(x.resource_id)?'★ ':'')+escape(x.display_name)+'</strong><small>'+escape(x.resource_type)+' · '+escape(x.health.status)+(x.stale?' · 旧快照':'')+'</small></button>').join('');
    for(const button of $('resource-list').querySelectorAll('[data-resource]'))button.onclick=()=>open(button.dataset.resource);
  }
  function inspect(item){
    if(!item)return;
    if(item.resource_id){
      objectSelection=null;
      selected=item.resource_id;
      $('selected-status').textContent=item.resource_id;
      $('selection').innerHTML='<h2>'+escape(item.display_name)+'</h2><span class="badge">'+escape(item.resource_type)+'</span><dl><dt>身份</dt><dd class="source">'+escape(item.resource_id)+'</dd><dt>健康 / 运行 / 连接</dt><dd>'+escape([item.health.status,item.runtime.status,item.connection.status].join(' / '))+'</dd><dt>观测时间</dt><dd>'+escape(item.observed_at || '尚未观测')+'</dd><dt>来源</dt><dd class="source">'+escape(item.source)+'</dd><dt>说明</dt><dd>'+escape(item.detail || item.description)+'</dd></dl><button id="favorite">'+(ui.favorites.includes(item.resource_id)?'取消收藏':'收藏资源')+'</button><h3>能力</h3><div class="actions">'+item.capabilities.map(c=>'<button data-action="'+escape(c)+'">'+escape(labels[c] || c)+'</button>').join('')+'</div>';
      $('favorite').onclick=()=>{ui.favorites=ui.favorites.includes(item.resource_id)?ui.favorites.filter(x=>x!==item.resource_id):[...ui.favorites,item.resource_id];save();inspect(item);renderExplorer();};
      for(const button of $('selection').querySelectorAll('[data-action]'))button.onclick=()=>perform(item,button.dataset.action);
    }else{
      objectSelection=item;
      if(layout.value.focus_mode){$('inspector').classList.add('context-floating');$('close-inspector').hidden=false;}
      $('selection').innerHTML='<span class="eyebrow">'+(item.kind==='cluster'?'SPATIAL AGGREGATE':'SOURCE RECORD')+'</span><h2>'+escape(item.label || item.id)+'</h2>'+(item.kind==='cluster'?'<p>当前空间范围内 '+item.count+' 条记录；不表示语义主题。</p>':'')+(item.provenance?'<dl><dt>原始来源</dt><dd class="source">'+escape(item.source)+'</dd><dt>表</dt><dd>'+escape(item.provenance.table)+'</dd><dt>原始键</dt><dd>'+pretty(item.provenance.keys)+'</dd></dl>':'')+(item.record?'<h3>记录字段</h3><dl>'+Object.entries(item.record).map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+escape(typeof v==='object'?JSON.stringify(v):v)+'</dd>').join('')+'</dl>':'')+'<details><summary>投影与来源详情</summary>'+pretty(item)+'</details>';
    }
  }
  async function perform(item,action){
    if(!['inspect','health','attach','detach','logs','runs','open','open_folder','open_output'].includes(action)){
      actionRequest={resource_id:item.resource_id,action};$('action-title').textContent=(labels[action] || action)+' · '+item.display_name;$('action-input').value='{}';$('action-error').textContent='';$('action-dialog').showModal();return;
    }
    await submit({resource_id:item.resource_id,action});
  }
  async function submit(request){
    try{await api.call('actions',{...request,request_id:crypto.randomUUID()});panel='runs';await refresh();}
    catch(error){toast(error.message);}
  }
  async function open(id){$('inspector').classList.remove('context-floating');$('close-inspector').hidden=true;if(!ui.tabs.includes(id))ui.tabs.push(id);ui.active=id;ui.seen ||= {};ui.seen[id]=snapshot.cursor;if(resource(id))inspect(resource(id));save();await renderView();renderExplorer();}
  async function renderView(){
    const generation=++renderGeneration;
    view?.dispose();view=null;renderTabs();
    const target=$('workspace');target.className='';
    if(ui.active==='business'){
      target.innerHTML='<div class="loading-state">正在加载业务视图…</div>';
      try{const {renderBusiness}=await import('./workbench_business_v0001.mjs');if(generation!==renderGeneration)return;const mounted=await renderBusiness({target,api,onChanged:refresh,onOpen:open,onUnload:async()=>{snapshot=await api.call('bootstrap');ui=snapshot.workspace;selected=null;$('selection').innerHTML='<p class="muted">选择资源或数据对象，查看事实与来源。</p>';await open('home');await refresh();}});if(generation===renderGeneration)view=mounted;else mounted.dispose();}
      catch(error){if(generation===renderGeneration)target.innerHTML='<h2>视图加载失败</h2><p>'+escape(error.message)+'</p>';}
      return;
    }
    if(ui.active==='home'){
      const resources=snapshot.resources,active=snapshot.runs.filter(x=>x.state==='running');
      target.innerHTML='<div class="hero"><div class="eyebrow">YOUR LOCAL CONTROL SURFACE</div><h1>观察系统，开始工作。</h1><p>'+(snapshot.bootstrap?.zero_resource?'这是一个完整的空工作台。连接独立资源，或打开系统视图开始。':'资源独立运行，工作台把状态、运行记录和操作汇聚在这里。')+'</p><button id="hero-connect" class="primary">＋ 接入资源</button></div><div class="stats"><div class="stat">已发现资源<b>'+resources.length+'</b></div><div class="stat">执行中<b>'+active.length+'</b></div><div class="stat">待查看问题<b>'+snapshot.problems.length+'</b></div></div><h3>资源与最近工作</h3><div class="cards">'+resources.map(x=>'<button class="card" data-card="'+escape(x.resource_id)+'"><strong>'+escape(x.display_name)+'</strong><span class="badge">'+escape(x.resource_type)+'</span><span class="'+escape(x.health.status)+'">'+escape(x.health.status)+'</span></button>').join('')+'</div>';
      $('hero-connect').onclick=()=>showManifest();for(const button of target.querySelectorAll('[data-card]'))button.onclick=()=>open(button.dataset.card);
      if(snapshot.bootstrap?.zero_resource){target.innerHTML='<div class="welcome"><div class="eyebrow">LOCAL AI WORKBENCH / YOUR SPACE</div><h1>从一个空工作台开始。</h1><p>这里已经准备好。按需连接数据库、工具和业务，工作台始终保持独立。</p><div class="actions"><button id="empty-discover" class="primary">识别本地业务</button><button id="empty-import">导入资源声明</button><button id="empty-system">查看系统</button></div><div class="onboarding"><div><b>01</b><h3>识别来源</h3><p>选择目录，读取数据库与 CMD 的真实位置和登记信息。</p></div><div><b>02</b><h3>按需加载</h3><p>选择所需来源，建立业务仪表盘；不会自动执行程序。</p></div><div><b>03</b><h3>随时卸载</h3><p>卸载观察上下文，业务文件和独立程序继续保留。</p></div></div></div>';$('empty-discover').onclick=()=>open('business');$('empty-import').onclick=showManifest;$('empty-system').onclick=()=>open('workbench.system');}
    }else if(ui.active==='databases'){
      const mounted=snapshot.resources.filter(x=>x.database);
      target.innerHTML='<div class="eyebrow">DATA SOURCES / READ ONLY</div><h1>数据库挂载</h1><p class="muted">同时挂载多个数据源，为当前工作空间选择活动数据库。切换不会修改独立应用的配置。</p><div class="mount-form"><input id="db-name" aria-label="数据库名称" placeholder="连接名称"><select id="db-driver" aria-label="数据库类型"><option value="sqlite">SQLite</option><option value="duckdb">DuckDB</option><option value="chroma">Chroma</option></select><input id="db-path" aria-label="数据库路径" placeholder="项目相对路径或本机绝对路径"><button id="db-browse">选择路径</button><button id="db-mount" class="primary">挂载</button></div><p id="db-error" class="error"></p><div id="mounts">'+mounted.map(x=>'<div class="run-row"><strong>'+escape(x.display_name)+'</strong><span>'+escape(x.database.driver)+' · '+escape(x.connection.status)+'</span><button data-db="'+escape(x.resource_id)+'">'+(ui.active_database===x.resource_id?'当前数据库':'切换并浏览')+'</button><button data-db-toggle="'+escape(x.resource_id)+'">'+(x.stale?'重新连接':'断开观察')+'</button></div>').join('')+'</div><div id="db-browser"><p class="muted">选择数据库后浏览表或集合元数据。Chroma 此处只读元数据，不启动向量推理。</p></div>';
      $('db-browse').onclick=async()=>{if(!window.desktop)return toast('浏览器模式请填写路径');try{const value=await window.desktop.pickDatabase($('db-driver').value);if(value)$('db-path').value=value;}catch(error){$('db-error').textContent=error.message;}};
      $('db-mount').onclick=async()=>{
        try{await api.call('databases',{name:$('db-name').value || $('db-driver').value,driver:$('db-driver').value,path:$('db-path').value});await refresh();await renderView();}
        catch(error){$('db-error').textContent=error.message;}
      };
      for(const button of target.querySelectorAll('[data-db]'))button.onclick=async()=>{
        try{const result=await api.call('databases/select',{resource_id:button.dataset.db});ui.active_database=result.active_database;save();await browseDatabase(result.active_database);}
        catch(error){$('db-error').textContent=error.message;}
      };
      for(const button of target.querySelectorAll('[data-db-toggle]'))button.onclick=()=>perform(resource(button.dataset.dbToggle),resource(button.dataset.dbToggle).stale?'attach':'detach');
      if(ui.active_database&&resource(ui.active_database))await browseDatabase(ui.active_database);
    }else if(ui.active.startsWith('legacy.')){
      target.innerHTML='<h2>'+escape(title(ui.active))+'</h2><p class="muted">旧版只读适配；保留原字段和数据源范围。</p><div id="legacy-data">读取中…</div>';
      try{const data=await api.call('legacy/'+ui.active.slice(7));if(generation===renderGeneration)$('legacy-data').innerHTML=pretty(data);}
      catch(error){if(generation===renderGeneration)$('legacy-data').textContent=error.message;}
    }else if(ui.active.startsWith('graph:')){
      const item=resource(ui.active.slice(6));if(!item){target.textContent='资源已移除';return;}
      target.className='graph';
      try{view=new CanvasView(target,api,item,async node=>{
        if(node.kind==='cluster')inspect(node);
        else try{inspect(await api.call('resources/'+encodeURIComponent(item.resource_id)+'/objects/'+encodeURIComponent(node.id)));}catch(error){toast(error.message);}
      },ui.cameras[ui.active],camera=>{ui.cameras[ui.active]={...camera};save();});}
      catch(error){target.innerHTML='<h2>视图暂时不可用</h2><p>'+escape(error.message)+'</p><button id="view-retry">重试视图</button>';$('view-retry').onclick=()=>renderView();api.call('diagnostics',{code:'RENDERER_ERROR',message:error.message}).catch(()=>{});}
    }else{
      const item=resource(ui.active);
      if(!item){target.innerHTML='<h2>资源已移除</h2><p>原工作区仍保留，可重新连接资源。</p>';return;}
      inspect(item);
      target.innerHTML='<div class="eyebrow">'+escape(item.resource_type.toUpperCase())+'</div><h1>'+escape(item.display_name)+'</h1><p class="muted">'+escape(item.detail || '尚无健康观测')+'</p><div class="stats">'+['health','runtime','connection'].map(k=>'<div class="stat">'+escape(k)+'<b style="font-size:19px">'+escape(item[k].status)+'</b></div>').join('')+'</div><div class="actions">'+item.views.filter(v=>v.view_type==='graph').map(v=>'<button class="primary" data-graph="'+escape(item.resource_id)+'">打开数据投影</button>').join('')+'</div><h3>资源事实</h3>'+pretty(item);
      for(const button of target.querySelectorAll('[data-graph]'))button.onclick=()=>open('graph:'+button.dataset.graph);
    }
  }
  async function browseDatabase(id){
    const target=$('db-browser');if(!target)return;
    for(const button of document.querySelectorAll('[data-db]'))button.textContent=button.dataset.db===id?'当前数据库':'切换并浏览';
    try{
      const data=await api.call('databases/'+encodeURIComponent(id)+'/read',{operation:'catalog'});
      if($('db-browser')!==target||ui.active!=='databases'||ui.active_database!==id)return;
      if(resource(id))inspect(resource(id));
      target.innerHTML='<h3>'+escape(resource(id)?.display_name || id)+' · 只读</h3><p class="source">'+escape(data.source)+'</p><select id="db-table" aria-label="选择数据表">'+data.tables.map((table,index)=>'<option value="'+index+'">'+escape(table.schema+'.'+table.name)+'</option>').join('')+'</select><button id="db-prev">上一页</button><button id="db-next">下一页</button><span id="db-page"></span><div id="db-rows"></div>';
      let offset=0,more=false,pageGeneration=0;
      const graphControls=document.createElement('div');graphControls.className='record-map-controls';graphControls.innerHTML='<input id="db-map-keys" aria-label="记录唯一键列" placeholder="可选：唯一键列，用逗号分隔；默认使用主键"><button id="db-map" class="primary">打开真实记录 2D</button><small class="muted">按原始键排序排列，不表示语义距离或关系。</small>';target.insertBefore(graphControls,$('db-rows'));
      $('db-map').onclick=async()=>{const table=data.tables[Number($('db-table').value)];if(!table)return;try{const keys=$('db-map-keys').value.split(',').map(x=>x.trim()).filter(Boolean);await api.call('databases/'+encodeURIComponent(id)+'/view',{table:table.name,schema:table.schema,...(keys.length?{keys}:{})});await refresh();await open('graph:'+id);}catch(error){toast(error.message);}};
      const load=async()=>{
        const currentPage=++pageGeneration;
        const table=data.tables[Number($('db-table').value)];if(!table){$('db-rows').textContent='数据库没有可浏览的数据表';return;}
        const result=await api.call('databases/'+encodeURIComponent(id)+'/read',{operation:'preview',table:table.name,schema:table.schema,offset,limit:25});
        if(!$('db-rows')||ui.active_database!==id||currentPage!==pageGeneration)return;
        more=result.has_more;$('db-page').textContent=' 第 '+(offset/25+1)+' 页';$('db-prev').disabled=offset===0;$('db-next').disabled=!more;
        $('db-rows').innerHTML='<div class="table-scroll"><table><thead><tr>'+result.columns.map(x=>'<th>'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+result.rows.map(row=>'<tr>'+row.map(x=>'<td>'+escape(typeof x==='object'?JSON.stringify(x):x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
      };
      $('db-table').onchange=()=>{offset=0;load().catch(error=>toast(error.message));};
      $('db-prev').onclick=()=>{offset=Math.max(0,offset-25);load().catch(error=>toast(error.message));};
      $('db-next').onclick=()=>{if(more){offset+=25;load().catch(error=>toast(error.message));}};
      await load();
    }catch(error){if($('db-browser'))$('db-browser').textContent='数据库读取失败：'+error.message;}
  }
  function renderBottom(){
    const target=$('bottom-content');
    if(panel==='runs'){
      target.innerHTML=snapshot.runs.length?snapshot.runs.map(run=>'<div class="run-row"><strong class="'+escape(run.state)+'">'+escape(run.state)+'</strong><span>'+escape(run.action)+' · '+escape(run.resource_id)+'</span><small>'+escape(run.updated_at || run.created_at)+'</small><button data-run="'+escape(run.run_id)+'">详情</button>'+(['queued','running'].includes(run.state)?'<button data-cancel="'+escape(run.run_id)+'">取消请求</button>':'')+(run.state==='completed'&&(run.result?.open_url||run.result?.open_path)?'<button data-open="'+escape(run.run_id)+'">打开结果</button>':'')+'</div>').join(''):'<p class="muted">暂无运行。选择资源后发起操作。</p>';
      for(const button of target.querySelectorAll('[data-run]'))button.onclick=()=>{panel='output';target.innerHTML=pretty(snapshot.runs.find(x=>x.run_id===button.dataset.run));};
      for(const button of target.querySelectorAll('[data-cancel]'))button.onclick=()=>api.call('runs/'+button.dataset.cancel+'/cancel',{}).catch(error=>toast(error.message));
      for(const button of target.querySelectorAll('[data-open]'))button.onclick=()=>window.desktop?window.desktop.openResult(button.dataset.open).catch(error=>toast(error.message)):toast('在桌面窗口中打开此结果');
    }else if(panel==='problems')target.innerHTML=snapshot.problems.length?pretty(snapshot.problems):'<p class="muted">暂无问题。</p>';
    else if(panel==='events')target.innerHTML=events.slice(-100).reverse().map(e=>'<div class="event-row"><small>'+escape(e.at)+'</small><span>'+escape(e.type)+'</span><small>'+escape(e.payload.resource_id || e.payload.run_id || '')+'</small></div>').join('') || '<p class="muted">等待状态变化。</p>';
    else if(panel==='terminal'){
      target.innerHTML='<p class="muted">进程输出终端 · 只读尾部 · '+escape(selected || 'workbench.system')+'</p><div id="terminal-output">读取中…</div>';
      api.call('resources/'+encodeURIComponent(selected || 'workbench.system')+'/logs').then(value=>{if($('terminal-output'))$('terminal-output').innerHTML=value.text?'<pre>'+escape(value.text)+'</pre>':pretty(value);}).catch(error=>{if($('terminal-output'))$('terminal-output').textContent=error.message;});
    }
    else target.innerHTML=pretty(snapshot.runs[0]?.result || snapshot.runs[0]?.error || {message:'选择运行查看输出'});
  }
  async function refresh(){
    try {
      snapshot=await api.call('snapshot');$('boot').textContent=snapshot.bootstrap.phase==='discovery'?'后台发现中':'快照已同步';
      if(mode==='user')return;
      renderExplorer();renderTabs();renderBottom();if(selected&&resource(selected)&&!objectSelection)inspect(resource(selected));
      $('legacy-links').parentElement.querySelectorAll('#legacy-links,.panel-title').forEach(el=>{if(el.id==='legacy-links'||el.textContent==='兼容视图')el.hidden=!snapshot.business?.enabled;});
      if(!ui.active.startsWith('graph:')&&!ui.active.startsWith('legacy.')&&!['databases','business'].includes(ui.active))renderView();
    }catch(error){$('connection').textContent='后端不可用 · 保留上次快照';toast(error.message);}
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,120);}
  function showManifest(){
    $('manifest-error').textContent='';
    $('manifest-json').value=JSON.stringify({schema_version:'workbench.resource.v1',resource:{id:'my-service',type:'service',name:'My Service'},adapter:'http',endpoint:'http://127.0.0.1:8000/health',capabilities:['inspect','health','attach','detach','open'],views:[]},null,2);
    $('manifest-dialog').showModal();
  }
  $('connect').onclick=showManifest;$('close-manifest').onclick=()=>$('manifest-dialog').close();
  $('pick-manifest').onclick=async()=>{
    try {
      if(window.desktop){const value=await window.desktop.importManifest();if(value)$('manifest-json').value=JSON.stringify(value,null,2);}
      else{
        const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{const file=input.files[0];if(file.size>262144)return toast('文件超过大小限制');$('manifest-json').value=await file.text();};input.click();
      }
    }catch(error){$('manifest-error').textContent=error.message;}
  };
  $('submit-manifest').onclick=async()=>{
    try{const item=await api.call('resources',JSON.parse($('manifest-json').value));$('manifest-dialog').close();await refresh();open(item.resource_id);}
    catch(error){$('manifest-error').textContent=error.message;}
  };
  $('action-cancel').onclick=()=>$('action-dialog').close();
  $('action-submit').onclick=async()=>{
    try{const input=JSON.parse($('action-input').value);await submit({...actionRequest,input,confirmed:true});$('action-dialog').close();}
    catch(error){$('action-error').textContent=error.message;}
  };
  $('refresh').onclick=()=>api.call('discover',{}).catch(error=>toast(error.message));
  $('home').onclick=()=>open('home');$('category').onchange=()=>{ui.explorer_category=$('category').value;renderExplorer();save();};$('command').oninput=renderExplorer;
  $('databases').onclick=()=>open('databases');
  $('business').onclick=()=>open('business');
  async function showMode(next){
    const generation=++modeGeneration;mode=next;document.body.dataset.mode=mode;$('mode-switch').textContent=mode==='user'?'切换开发者模式':'返回使用者模式';
    view?.dispose?.();view=null;userView?.dispose?.();userView=null;
    if(mode==='user'){
      try{const {mountUser}=await import('./workbench_user_v0001.mjs');if(generation!==modeGeneration)return;const result=await mountUser({target:$('user-space'),api});if(generation===modeGeneration)userView=result;else result.dispose();}
      catch(error){if(generation===modeGeneration){$('user-space').innerHTML='<div class="user-wrap"><h1>暂时无法加载工作台</h1><p>'+escape(error.message)+'</p><button id="user-retry">重试</button></div>';$('user-retry').onclick=()=>showMode('user');}}
    }else{snapshot=await api.call('snapshot');ui=snapshot.workspace;ui.cameras ||= {};ui.favorites ||= [];layout.apply(ui.layout);await renderView();renderExplorer();renderBottom();}
  }
  $('mode-switch').onclick=async()=>{const button=$('mode-switch');button.disabled=true;try{const next=mode==='user'?'developer':'user';await api.call('user/mode',{mode:next});await showMode(next);}catch(error){toast(error.message);}finally{button.disabled=false;}};
  $('close-inspector').onclick=()=>{$('inspector').classList.remove('context-floating');$('close-inspector').hidden=true;};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')$('close-inspector').click();});
  $('command').onkeydown=event=>{if(event.key!=='Enter')return;const command=$('command').value;if(command==='/home')open('home');if(command==='/focus')layout.toggle('focus_mode');if(command==='/discover')$('refresh').click();};
  for(const button of document.querySelectorAll('[data-toggle]'))button.onclick=()=>layout.toggle(button.dataset.toggle);
  $('reset-layout').onclick=()=>{layout.apply({});save();};
  $('theme').onclick=()=>{layout.value.theme=layout.value.theme==='light'?'dark':'light';layout.apply(layout.value);save();view?.draw?.();};
  $('motion').onclick=()=>layout.toggle('reduced_motion');
  for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{panel=button.dataset.panel;renderBottom();};
  $('legacy-links').innerHTML=Object.entries(legacyNames).map(([key,name])=>'<button data-legacy="'+key+'">'+name+'</button>').join('');
  for(const button of $('legacy-links').querySelectorAll('[data-legacy]'))button.onclick=()=>open('legacy.'+button.dataset.legacy);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)view?.suspend?.();else view?.activate?.();});
  window.addEventListener('beforeunload',()=>{api.close();view?.dispose();userView?.dispose();layout.dispose();});
  api.onState=state=>{$('connection').textContent=state==='connected'?'● 事件已连接':'○ 事件断开 · 自动重连';};
  async function synchronize(){
    snapshot=await api.call('bootstrap');ui=snapshot.workspace;ui.cameras ||= {};ui.favorites ||= [];
    layout.apply(ui.layout);const userState=await api.call('user/home');await showMode(userState.mode);$('category').value=ui.explorer_category || '';
    events=(await api.call('events')).items;
    $('legacy-links').parentElement.querySelectorAll('#legacy-links,.panel-title').forEach(el=>{if(el.id==='legacy-links'||el.textContent==='兼容视图')el.hidden=!snapshot.business?.enabled;});
    api.subscribe(snapshot.cursor,event=>{events.push(event);events=events.slice(-200);if(event.type==='projection.updated'||event.type==='resource.state_changed')view?.refresh?.();if(event.type!=='workspace.changed')scheduleRefresh();},()=>synchronize().catch(error=>toast(error.message)));
    $('boot').textContent=snapshot.bootstrap.phase;
  }
  try{await api.connect();await synchronize();}
  catch(error){$('connection').textContent='启动失败';$('workspace').innerHTML='<h2>后端连接失败</h2><p>'+escape(error.message)+'</p><button id="retry">重试</button>';$('retry').onclick=()=>location.reload();}
}
if(typeof document!=='undefined')main();
export {main};
