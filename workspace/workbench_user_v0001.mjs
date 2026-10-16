// ============================================================
// 文件名: workbench_user_v0001.mjs
// 中文名: 使用者首页、功能入口与资料阅读
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 使用者首页、功能入口与资料阅读
//
// 职责说明:
// - 提供添加并打开功能、收藏、最近使用、自动识别数据库及真实项目数据消费
//
// 本脚本做什么:
// - 提供添加并打开功能、收藏、最近使用、自动识别数据库及真实项目数据消费
//
// 本脚本不做什么:
// - 不改写原始库，不启动模型或更改 AI 许可
//
// 制度边界声明:
// - 用户操作显式触发；仅工作台私有状态可写；测试使用隔离目录
// - 失败分类返回；不把入口存在或配置保存冒充业务执行成功
//
// 可更新: True
// ============================================================
//
// ============================================================
// ALIAS_META
// ============================================================
// alias: workbench_user_v0001
// family: workbench_user
// role: workbench_user
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/workbench_user_v0001.mjs
// input:
//   - target DOM, authenticated API client and backend project/source facts
// output:
//   - rendered user views, explicit API commands and dispose callback
// depends_on:
//   - workbench_api_v0001
// used_by:
//   - workbench_workspace_v0001
// ============================================================

const DEFAULT_ENCODING='utf8';
const SCRIPT_FAMILY='workbench_user';
const SCRIPT_NAME='workbench_user_v0001';
const SCRIPT_VERSION='v0001';
// ============================================================
// 使用者视图；技术配置保留在独立开发者模式
// ============================================================
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountUser({target,api}){
 const controller=new AbortController();let state,screen='home',query='',generation=0,busy=false;
 const call=(route,input)=>api.call('user/'+route,input,controller.signal);
 const q=id=>target.querySelector('#'+id);
 const status=(message,error=false)=>{const el=q('user-notice');if(el){el.textContent=message?(error?'操作未完成：':'')+message:'';el.classList.toggle('error',error);}};
 const navigate=fn=>()=>Promise.resolve().then(fn).catch(e=>{if(!controller.signal.aborted)status('暂时无法打开：'+e.message+'。请重试。',true);});
 const act=fn=>async()=>{if(busy)return;busy=true;try{await fn();}catch(e){if(!controller.signal.aborted)status(e.message,true);}finally{busy=false;}};
 function shell(title,description){
  target.innerHTML='<div class="user-wrap"><nav class="user-nav" aria-label="使用者导航"><button id="user-home">首页</button><button id="user-add">添加功能</button><button id="user-data">我的数据</button><details id="user-manage" class="user-manage"><summary>工作台管理</summary><div class="management-actions"><button id="user-empty" class="danger-action">清空工作台</button></div></details></nav><dialog id="user-empty-dialog" aria-labelledby="empty-title"><h2 id="empty-title">回到空工作台？</h2><p>移除这里的功能和数据连接，不删除文件，也不关闭外部应用。</p><div class="dialog-actions"><button id="empty-cancel" autofocus>保留</button><button id="empty-confirm" class="danger-action">确认清空</button></div></dialog><div class="user-heading"><span class="eyebrow">我的工作台</span><h1>'+esc(title)+'</h1><p class="muted">'+esc(description)+'</p></div><p id="user-notice" role="status" aria-live="polite"></p><section id="user-content"></section></div>';
  q('user-home').onclick=navigate(home);q('user-add').onclick=navigate(catalog);q('user-data').onclick=navigate(data);
  const current={home:'user-home',catalog:'user-add',data:'user-data'}[screen];
  if(current)q(current).setAttribute('aria-current','page');
  q('user-manage').hidden=!state.projects.length&&!state.sources.length;
  const dialog=q('user-empty-dialog'),manage=q('user-manage');
  manage.onkeydown=e=>{if(e.key==='Escape'){manage.open=false;manage.querySelector('summary').focus();}};
  q('user-empty').onclick=()=>{manage.open=false;dialog.showModal();q('empty-cancel').focus();};
  dialog.onclose=()=>manage.querySelector('summary').focus();
  q('empty-cancel').onclick=()=>dialog.close();
  q('empty-confirm').onclick=act(async()=>{dialog.close();await call('empty',{});await home();});
 }
 function cards(items,adding=false){
  return items.map(p=>'<article class="user-card" data-project="'+esc(p.id)+'"><span class="user-icon" aria-hidden="true">'+(p.kind==='builtin'?'▤':'↗')+'</span><h2>'+esc(p.name)+'</h2><p>'+esc(p.description)+'</p><div class="card-actions"><button class="primary" data-open="'+esc(p.id)+'" '+(!p.available?'disabled':'')+'>'+(adding?(state.selected.includes(p.id)?'打开':'添加并打开'):'打开')+'</button>'+(adding?'':'<button data-favorite="'+esc(p.id)+'" aria-label="收藏 '+esc(p.name)+'" aria-pressed="'+state.favorites.includes(p.id)+'">'+(state.favorites.includes(p.id)?'★ 已收藏':'☆ 收藏')+'</button><details class="card-more"><summary aria-label="更多操作 '+esc(p.name)+'">更多</summary><button class="danger-action" data-remove="'+esc(p.id)+'" aria-label="移除 '+esc(p.name)+'">移除</button></details>')+'</div><small class="muted">'+(!p.available?'入口尚未接好，请切换开发者模式检查':p.bindable?'使用你选择的资料库':'独立窗口 · 保留应用自己的设置')+'</small></article>').join('');
 }
 function cardActions(){
  for(const menu of target.querySelectorAll('.card-more'))menu.onkeydown=e=>{if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}};
  for(const b of target.querySelectorAll('[data-open]'))b.onclick=act(async()=>{
   const id=b.dataset.open;if(!state.selected.includes(id)){await call('select',{project_id:id});state=await call('home');}
   await open(id);
  });
  for(const b of target.querySelectorAll('[data-remove]'))b.onclick=act(async()=>{await call('remove',{project_id:b.dataset.remove});await home();});
 for(const b of target.querySelectorAll('[data-favorite]'))b.onclick=act(async()=>{await call('favorite',{project_id:b.dataset.favorite});await home();});
 }
 async function open(id){
  const p=(await call('catalog')).items.find(x=>x.id===id);
  if(p.kind==='external'&&!window.desktop){status('请使用桌面启动器打开此功能。',true);return;}
  status('正在打开…');const value=await call('open',{project_id:id});
  if(value.kind==='builtin')return reader();
  await window.desktop.openProject(value.ticket);state=await call('home');status('已交给系统打开，请查看应用窗口。应用运行结果以自身界面为准。');
 }
 async function home(){
  const revision=++generation;screen='home';state=await call('home');if(controller.signal.aborted||revision!==generation)return;
  shell(state.projects.length?'开始今天的工作':'你的工作台，按需开始',state.projects.length?'打开常用功能，或继续阅读你的资料。':'先添加一个需要的功能。你也可以保持空工作台。');
  const recent=state.recent.map(id=>state.projects.find(p=>p.id===id)).filter(Boolean).slice(0,3);
  q('user-content').innerHTML=(recent.length?'<section><h2>最近使用</h2><div class="recent-links">'+recent.map(p=>'<button data-open="'+esc(p.id)+'">'+esc(p.name)+' →</button>').join('')+'</div></section>':'')+
   (state.projects.length?'<div class="section-heading"><h2>我的功能</h2><input id="user-search" aria-label="搜索功能" placeholder="搜索功能名称或用途"></div><div id="my-projects" class="user-cards"></div>':'<section class="user-welcome"><h2>想做什么，从这里开始。</h2><p>选择功能即可打开；资料库接入后，由支持它的功能直接使用。</p><button id="first-add" class="primary">添加功能</button> <button id="first-data">接入数据</button></section>');
  if(q('first-add')){q('first-add').onclick=navigate(catalog);q('first-data').onclick=navigate(data);}
  if(q('user-search')){const filter=()=>{const term=q('user-search').value.toLowerCase();const list=state.projects.filter(p=>(p.name+' '+p.description).toLowerCase().includes(term)).sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id)));q('my-projects').innerHTML=cards(list)||'<p>没有找到，试试“添加功能”。</p>';cardActions();};q('user-search').oninput=filter;filter();}else cardActions();
 }
 async function catalog(){
  const revision=++generation;screen='catalog';state=await call('home');const items=(await call('catalog')).items;if(controller.signal.aborted||revision!==generation)return;
  shell('添加功能','已经找到本机现有入口。选择后直接打开，不需要扫描目录或配置声明。');
  q('user-content').innerHTML='<input id="catalog-search" class="wide-search" aria-label="查找可用功能" placeholder="搜索名称或用途，例如：对话、规范、阅读"><div id="catalog-cards" class="user-cards"></div>';
  const filter=()=>{const term=q('catalog-search').value.toLowerCase();q('catalog-cards').innerHTML=cards(items.filter(p=>(p.name+' '+p.description).toLowerCase().includes(term)),true)||'<p>暂未找到对应入口。可切换开发者模式检查接入。</p>';cardActions();};q('catalog-search').oninput=filter;filter();
 }
 async function data(){
  const revision=++generation;screen='data';state=await call('home');if(controller.signal.aborted||revision!==generation)return;
  shell('我的数据','选择文件或资料文件夹，工作台自动识别。原始数据保持只读。');
  q('user-content').innerHTML='<section class="surface"><h2>接入资料库</h2><div class="actions"><button id="source-file" class="primary">选择数据库文件</button><button id="source-folder">选择资料文件夹</button></div><details '+(!window.desktop?'open':'')+'><summary>手动填写位置</summary><label for="source-path">数据库文件或资料文件夹</label><input id="source-path" class="wide-search" placeholder="粘贴本机路径"><button id="source-connect">接入</button></details><div id="source-result"></div></section><h2>已接入的资料库</h2><div class="user-cards">'+state.sources.map(s=>'<article class="user-card"><h3>'+esc(s.display_name)+'</h3><p>'+esc(s.database.driver.toUpperCase())+' · 只读连接</p>'+(s.content_profile?.supported===false?'<p>暂不能用于资料阅读。'+(s.content_profile.reason==='documents_not_stored'?'该库未保存正文，请接入对应内容库。':'此内容格式需要适配。')+'</p>':'<button data-use-source="'+esc(s.resource_id)+'">用于资料阅读</button>')+'</article>').join('')+'</div><p class="muted">独立应用仍使用自己的数据设置；资料阅读使用这里接入的资料库。</p>';
  if(!state.sources.length)q('user-content').querySelector('.user-cards').innerHTML='<div class="user-welcome data-empty"><h3>还没有接入资料库</h3><p>使用上方按钮选择文件或文件夹，接入后即可交给支持它的功能使用。</p></div>';
  const attach=async path=>{if(!path)return;status('正在识别并检查资料…');const r=await call('attach',{path});state=await call('home');if(controller.signal.aborted||revision!==generation)return;status(r.message,!r.usable);q('source-result').innerHTML='<p>'+esc(r.name)+' · '+esc(r.driver.toUpperCase())+'</p>'+(r.usable?'<button id="read-attached" class="primary">用这些资料开始阅读</button>':'<p>文件已连接。需要开发者添加内容适配后，才能供资料阅读使用。</p>');if(q('read-attached'))q('read-attached').onclick=act(()=>useSource(r.resource_id));};
  q('source-connect').onclick=act(()=>attach(q('source-path').value.trim()));
  q('source-file').onclick=act(async()=>{if(window.desktop)await attach(await window.desktop.pickSource(false));else status('请展开“手动填写位置”，粘贴数据库路径。');});
  q('source-folder').onclick=act(async()=>{if(window.desktop)await attach(await window.desktop.pickSource(true));else status('请展开“手动填写位置”，粘贴文件夹路径。');});
  for(const b of target.querySelectorAll('[data-use-source]'))b.onclick=act(()=>useSource(b.dataset.useSource));
 }
 async function useSource(id){
  await call('select',{project_id:'library.reader'});state=await call('home');
  const ids=[...new Set([...(state.bindings['library.reader']||[]),id])];
  await call('bind',{project_id:'library.reader',resource_ids:ids});await open('library.reader');
 }
 async function reader(){
  const revision=++generation;screen='reader';state=await call('home');if(controller.signal.aborted||revision!==generation)return;
  shell('资料阅读','直接阅读和搜索已接入的资料。需要时展开来源查看依据。');
  const ids=state.bindings['library.reader']||[],sources=state.sources.filter(s=>ids.includes(s.resource_id));
  q('user-content').innerHTML='<div class="section-heading"><button id="choose-data">选择资料库</button></div><section id="reader-selection" hidden></section>'+
   (sources.length?'<div class="reader-controls"><select id="reader-source" aria-label="当前资料库">'+sources.map(s=>'<option value="'+esc(s.resource_id)+'">'+esc(s.display_name)+'</option>').join('')+'</select><input id="reader-query" aria-label="搜索资料内容" placeholder="搜索资料内容"><button id="reader-search">搜索</button></div><div id="reader-items"></div><div class="actions"><button id="reader-prev">上一页</button><span id="reader-page"></span><button id="reader-next">下一页</button></div>':'<section class="user-welcome"><h2>先选择要阅读的资料</h2><p>接入一次后，即可在这里使用，无需选择数据表或填写主键。</p><button id="reader-connect" class="primary">接入数据</button></section>');
  q('choose-data').onclick=()=>{const pane=q('reader-selection');pane.hidden=false;pane.innerHTML=state.sources.map(s=>'<label class="source-choice"><input type="checkbox" value="'+esc(s.resource_id)+'" '+(ids.includes(s.resource_id)?'checked':'')+' '+(s.content_profile?.supported===false?'disabled':'')+'>'+esc(s.display_name)+(s.content_profile?.supported===false?'（暂无可阅读内容）':'')+'</label>').join('')+'<button id="save-bindings">使用所选资料</button> <button id="more-data">接入其他资料</button>';q('more-data').onclick=navigate(data);q('save-bindings').onclick=act(async()=>{await call('bind',{project_id:'library.reader',resource_ids:[...pane.querySelectorAll('input:checked')].map(x=>x.value)});await reader();});};
  if(!sources.length){q('reader-connect').onclick=navigate(data);return;}
  let offset=0,hasMore=false,request=0;
  const load=async()=>{const seq=++request;status('正在读取资料…');try{const r=await call('read',{project_id:'library.reader',resource_id:q('reader-source').value,query:q('reader-query').value,offset});if(controller.signal.aborted||screen!=='reader'||revision!==generation||seq!==request)return;
   hasMore=r.library.has_more;q('reader-items').innerHTML=r.library.items.map((item,i)=>'<article class="reading-card"><span class="muted">资料 '+(offset+i+1)+'</span><p class="reading-text">'+esc(item.text)+'</p>'+(item.truncated?'<small>此处展示前 8000 字符</small>':'')+'<details><summary>查看来源</summary><p class="source">'+esc(r.source)+'</p><pre>'+esc(JSON.stringify(item.provenance,null,2))+'</pre></details></article>').join('')||'<section class="user-welcome">没有匹配内容。换个关键词，或选择其他资料库。</section>';q('reader-page').textContent='第 '+(offset/20+1)+' 页';q('reader-prev').disabled=offset===0;q('reader-next').disabled=!hasMore;status('');}
   catch(e){if(revision===generation&&!controller.signal.aborted)status('读取失败：'+e.message+'。请检查资料是否还在原位置，再重试。',true);}
  };
  q('reader-search').onclick=()=>{offset=0;load();};q('reader-query').onkeydown=e=>{if(e.key==='Enter'){offset=0;load();}};
  q('reader-source').onchange=()=>{offset=0;load();};q('reader-prev').onclick=()=>{offset=Math.max(0,offset-20);load();};q('reader-next').onclick=()=>{if(hasMore){offset+=20;load();}};
  await load();
 }
 await home();
 return {dispose(){generation++;controller.abort();}};
}
