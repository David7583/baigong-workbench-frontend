// ============================================================
// 文件名: studio_loading_v0002.mjs
// 中文名: 通用扫描加载解除加载工具条与选择面板
// 版本号: v0002
// 主层级: action
// 层级: workbench / loading
// 脚本定位: 通用扫描加载解除加载工具条与选择面板
// 职责说明: 显式管理工作台接入，保留原资源和独立生命周期
// 本脚本做什么: 通用扫描加载解除加载工具条与选择面板
// 本脚本不做什么: 不删除文件，不安装依赖，不自动授权或执行资源
// 制度边界声明: 扫描与加载分开；错误留证；只修改工作台接入
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_loading_v0002
// family: studio_loading
// role: workbench_loading
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_loading_v0002.mjs
// input:
//   - explicit scoped selection and existing resource inventories
// output:
//   - truthful loading state and per-resource results
// depends_on:
//   - Browser DOM
//   - authenticated loading APIs
// used_by:
//   - studio_shell
// ============================================================

const SCRIPT_NAME='studio_loading_v0002',SCRIPT_VERSION='v0002';
const explanations={assets:'资产通过导入和项目引用复用；此处不移除资产文件或引用。',standards:'规范的生效、停用须走规范中心审批流程。',tasks:'任务请使用启动、暂停、继续或取消；切换栏目不停止任务。',environment:'环境清单用于观察依赖；依赖包不通过解除加载删除。'};
export function installLoading(ctx){
 const {api,escape:e}=ctx,bar=document.createElement('div');bar.className='loading-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','资源扫描与加载');bar.innerHTML='<span data-loading-scope></span><select data-database-group aria-label="数据库管理分组" hidden></select><select data-database-type aria-label="数据库种类" hidden></select><button data-loading-scan>扫描</button><button data-loading-load>加载 ▾</button><button data-loading-unload>解除加载 ▾</button><small data-loading-hint></small>';
 document.getElementById('studio-tabs').after(bar);
 const modal=document.createElement('dialog');modal.className='loading-dialog';modal.setAttribute('aria-label','加载资源');document.body.append(modal);let busy=false,currentScope='all',focusBefore;
 const notice=message=>{bar.querySelector('[data-loading-hint]').textContent=message;};
 function update(){currentScope=ctx.scope();const label=ctx.name(currentScope);bar.querySelector('[data-loading-scope]').textContent=label;bar.dataset.scope=currentScope;const select=bar.querySelector('[data-database-group]');select.hidden=currentScope!=='databases';select.innerHTML='<option value="all">全部分组</option>'+(ctx.groups?.()||[]).map(g=>'<option value="'+e(g.id)+'">'+e(g.name)+'</option>').join('');select.value=ctx.databaseGroup?.()||'all';select.disabled=busy;const typeSelect=bar.querySelector('[data-database-type]');typeSelect.hidden=currentScope!=='databases';typeSelect.innerHTML='<option value="all">全部种类</option>'+(ctx.types?.()||[]).map(t=>'<option value="'+e(t.id)+'">'+e(t.name)+'</option>').join('');typeSelect.value=ctx.databaseType?.()||'all';typeSelect.disabled=busy;for(const [action,selector] of [['scan','scan'],['load','load'],['unload','unload']]){const button=bar.querySelector('[data-loading-'+selector+']');const unsupported=explanations[currentScope]&&(action!=='scan'||currentScope==='standards');button.disabled=busy||!!unsupported;button.title=unsupported?explanations[currentScope]:action==='scan'?'发现或核对当前范围的资源，不自动加载':action==='load'?'选择全部加载或按需加载':'选择全部或按需解除加载，保留文件和独立进程';}notice(explanations[currentScope]||'加载仅接入工作台；执行与权限单独管理');}
 function close(){if(busy)return;modal.close();focusBefore?.focus();}
 function open(){focusBefore=document.activeElement;if(!modal.open)modal.showModal();modal.querySelector('input,button')?.focus();}
 const counts=cat=>{const loaded=cat.items.filter(x=>x.loaded).length;return '已加载 '+loaded+' / '+cat.items.length+' 项'+(cat.errors?.length?' · '+cat.errors.length+' 项目录异常':'');};
 async function picker(operation,scope=currentScope,initialKeys=[]){
  const group=scope==='databases'?(ctx.databaseGroup?.()||'all'):'all',type=scope==='databases'?(ctx.databaseType?.()||'all'):'all';
  const cat=await api('loading?scope='+encodeURIComponent(scope)+'&group='+encodeURIComponent(group)+'&type='+encodeURIComponent(type));if(cat.disabled_reason)throw Error(cat.disabled_reason);const load=operation==='load',title=load?'加载资源':'解除加载资源';let mode='selected',query='',keys=new Set(initialKeys),working=false;
  modal.setAttribute('aria-label',title);modal.innerHTML='<form method="dialog"><header><h2>'+e(title)+' · '+e(ctx.name(scope)+(group!=='all'?' / '+(cat.groups.find(g=>g.id===group)?.name||group):'')+(type!=='all'?' / '+type:''))+'</h2><button type="button" data-close aria-label="关闭资源选择">×</button></header><p>'+e(counts(cat))+'。'+(load?'全部加载仅包含本次清单中可加载的资源；当前项目需单项选择。':'全部解除加载仅包含当前已加载的资源，保留文件和独立进程。')+'</p><fieldset><legend>操作方式</legend><label><input type="radio" name="load-mode" value="selected" checked>按需'+(load?'加载':'解除加载')+'</label><label><input type="radio" name="load-mode" value="all" '+(scope==='projects'&&load?'disabled':'')+'>全部'+(load?'加载':'解除加载')+'</label></fieldset><div class="loading-filter"><input data-loading-search aria-label="搜索待选资源" placeholder="搜索名称、栏目或路径"><button type="button" data-select-visible>选中可操作的筛选结果</button><button type="button" data-clear-selection>清除选择</button></div><p class="loading-selection" role="status"></p><div class="loading-table"></div><div class="loading-issues"></div><footer><button type="button" data-close>取消</button><button type="submit" data-apply class="filled">确认'+(load?'加载':'解除加载')+'</button></footer></form>';
  const valid=x=>x.loaded!==load&&(!load||x.available),affected=()=>mode==='all'?cat.items.filter(x=>valid(x)&&(!load||!x.single)):cat.items.filter(x=>keys.has(x.key));
  function draw(){const shown=cat.items.filter(x=>([x.name,...x.scopes,x.path].join(' ')).toLowerCase().includes(query));modal.querySelector('.loading-selection').textContent=(mode==='all'?'全部范围':'按需选择')+'：'+affected().length+' 项。'+(mode==='all'?'搜索仅筛选展示，不改变全部操作范围。':'');modal.querySelector('[data-apply]').disabled=working||!affected().length;modal.querySelector('[data-select-visible]').disabled=mode==='all'||working;modal.querySelector('[data-clear-selection]').disabled=mode==='all'||working;
   const shownRows=shown.slice(0,400);modal.querySelector('.loading-table').innerHTML='<table><thead><tr><th>选择</th><th>名称 / 栏目</th><th>加载状态</th><th>位置 / 说明</th></tr></thead><tbody>'+shownRows.map(x=>'<tr><td><input type="checkbox" data-loading-key="'+e(x.key)+'" aria-label="选择 '+e(x.name)+'" '+((mode==='all'?affected().some(a=>a.key===x.key):keys.has(x.key))?'checked':'')+' '+(!valid(x)||mode==='all'||working?'disabled':'')+'></td><td><strong>'+e(x.name)+'</strong><small>'+e(x.scopes.map(ctx.name).join(' / ')+(x.database_group?' / '+(cat.groups.find(g=>g.id===x.database_group)?.name||x.database_group)+' / '+x.database_type:''))+'</small></td><td>'+e(x.loaded?'已加载':'未加载')+'</td><td>'+e(x.reason||x.description)+'<small>'+e(x.path)+'</small></td></tr>').join('')+'</tbody></table>'+(shown.length>400?'<p>当前只展示前 400 项，请搜索缩小范围。全部操作仍依据完整清单。</p>':'');modal.querySelector('.loading-issues').textContent=(cat.errors||[]).map(x=>ctx.name(x.scope)+'：'+x.error).join('\n');
   modal.querySelectorAll('[data-loading-key]').forEach(box=>box.onchange=()=>{const item=cat.items.find(x=>x.key===box.dataset.loadingKey);if(box.checked){if(load&&item.single)for(const key of keys)if(cat.items.find(x=>x.key===key)?.single)keys.delete(key);keys.add(item.key);}else keys.delete(item.key);draw();});
  }
  modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);modal.querySelectorAll('[name=load-mode]').forEach(r=>r.onchange=()=>{mode=r.value;draw();});modal.querySelector('[data-loading-search]').oninput=ev=>{query=ev.target.value.toLowerCase();draw();};modal.querySelector('[data-select-visible]').onclick=()=>{for(const row of cat.items.filter(x=>valid(x)&&[x.name,...x.scopes,x.path].join(' ').toLowerCase().includes(query))){if(load&&row.single)continue;keys.add(row.key);}draw();};modal.querySelector('[data-clear-selection]').onclick=()=>{keys.clear();draw();};
  modal.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(working||!affected().length)return;working=busy=true;update();draw();try{const value=await window.desktop.taskAction('loading',{scope,group,type,operation,mode,keys:[...keys],revision:cat.revision,request_id:crypto.randomUUID()});if(value.cancelled)return;await ctx.reload();showResult(value);notice(value.status==='completed'?'操作已完成':'部分操作未完成，请查看逐项结果');}catch(err){modal.querySelector('.loading-issues').textContent=err.message;}finally{working=busy=false;update();if(modal.querySelector('[data-apply]'))draw();}};
  draw();open();
 }
 function showResult(result){modal.setAttribute('aria-label','加载操作结果');modal.innerHTML='<header><h2>'+e(result.status==='completed'?'接入操作完成':'部分接入未完成')+'</h2><button data-close aria-label="关闭结果">×</button></header><p>成功 '+result.results.filter(x=>x.status==='completed').length+' 项；失败 '+result.results.filter(x=>x.status==='failed').length+' 项；跳过 '+result.skipped.length+' 项。文件、执行许可和独立进程保留。</p><div class="loading-table"><table><thead><tr><th>资源</th><th>结果</th></tr></thead><tbody>'+result.results.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.status==='completed'?(x.loaded?'已加载':'已解除加载'):x.error)+'</td></tr>').join('')+result.skipped.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e('跳过：'+x.reason)+'</td></tr>').join('')+'</tbody></table></div><small>记录 '+e(result.id)+'</small><footer><button data-close>关闭</button></footer>';modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);}
 async function scan(){const scope=currentScope;if(explanations[scope])return ctx.localScan(scope);busy=true;update();notice('正在扫描 '+ctx.name(scope)+'…');try{const result=await api('loading/scan',{scope,group:scope==='databases'?(ctx.databaseGroup?.()||'all'):'all',type:scope==='databases'?(ctx.databaseType?.()||'all'):'all'});await ctx.reload();busy=false;update();notice(counts(result)+(result.status==='partial'?'；部分扫描失败，见清单异常':''));await picker('load',scope);}finally{busy=false;update();}}
 bar.querySelector('[data-database-type]').onchange=ev=>ctx.setDatabaseType(ev.target.value);
 bar.querySelector('[data-database-group]').onchange=ev=>ctx.setDatabaseGroup(ev.target.value);
 bar.querySelector('[data-loading-scan]').onclick=()=>ctx.action(scan);bar.querySelector('[data-loading-load]').onclick=()=>ctx.action(()=>picker('load'));bar.querySelector('[data-loading-unload]').onclick=()=>ctx.action(()=>picker('unload'));modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});modal.addEventListener('close',()=>focusBefore?.focus());update();return {update,picker,scan};
}
