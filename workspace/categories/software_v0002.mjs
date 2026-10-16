// ============================================================
// 文件名: software_v0002.mjs
// 中文名: 本机应用清单与 Blender 操作面
// 版本号: v0002
// 主层级: action
// 层级: workbench / integration
// 脚本定位: 本机应用清单与 Blender 操作面
// 职责说明: 通过已有索引和显式 JSON 契约提供真实信息
// 本脚本做什么: 本机应用清单与 Blender 操作面
// 本脚本不做什么: 不自动授权模型、不安装软件、不卸载系统应用
// 制度边界声明: 只在明确操作后执行；用户数据保留；错误可追溯
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_category_software_v0002
// family: studio_category_software
// role: managed_integration
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/software_v0002.mjs
// input: authenticated explicit operation or JSON request
// output: factual inventory or versioned result
// depends_on: standard library and existing managed APIs
// used_by: workbench_server_v0011
// ============================================================

const SCRIPT_NAME='studio_category_software_v0002',SCRIPT_FAMILY='studio_category_software',SCRIPT_VERSION='v0002',DEFAULT_ENCODING='utf8';
const desktopAction=(operation,input)=>{if(!window.desktop?.softwareAction)throw Error('软件执行需要桌面工作台，请从 LocalAIWorkbench.exe 打开');return window.desktop.softwareAction(operation,input);};
export async function render(ctx){
 const {target,escape:e,api}=ctx;target.classList.add('integration-catalog');
 target.innerHTML='<header class="integration-head"><div><h2>本机软件</h2><p>扫描已安装的软件与快捷方式，按需加载。解除加载只移除接入关联，登记、系统软件和文件保留。</p></div><button data-software-scan>扫描本机</button><button data-software-add>登记 EXE</button></header><p data-software-state role="status"></p><div class="integration-filters"><input data-software-search placeholder="搜索软件名称、安装路径"><label><input type="checkbox" data-loaded-only>仅已加载</label></div><div data-software-list class="integration-table"></div>';
 const legacy=(ctx.data.items||[]).filter(x=>x.category==='software'&&!x.managed_software);if(legacy.length){const section=document.createElement('details');section.innerHTML='<summary>已有软件接入（兼容）</summary>'+legacy.map(x=>'<button data-legacy-software="'+e(x.id)+'">'+e(x.name)+'</button>').join('');target.append(section);section.querySelectorAll('[data-legacy-software]').forEach(b=>b.onclick=()=>ctx.open(legacy.find(x=>x.id===b.dataset.legacySoftware)));}
 let snapshot;function draw(){
  const query=target.querySelector('[data-software-search]').value.toLowerCase(),only=target.querySelector('[data-loaded-only]').checked;
  const items=snapshot.items.filter(x=>(!only||x.loaded)&&JSON.stringify(x).toLowerCase().includes(query));
  target.querySelector('[data-software-state]').textContent=items.length+' / '+snapshot.items.length+' 个入口 · 最近扫描：'+(snapshot.observed_at||'尚未扫描')+(snapshot.errors?.length?' · '+snapshot.errors.length+' 项扫描异常':'')+'。'+(snapshot.scope||'');
  target.querySelector('[data-software-list]').innerHTML='<table><thead><tr><th>软件 / 版本</th><th>来源与入口</th><th>接入状态</th><th>操作</th></tr></thead><tbody>'+items.map(x=>'<tr data-software-id="'+e(x.id)+'"><td><strong>'+e(x.name)+'</strong><small>'+e(x.version||'版本未登记')+'</small></td><td>'+e((x.sources||[x.source]).join(' / '))+'<small>'+e(x.path||x.location||'未定位 EXE')+'</small></td><td>'+(x.missing?'文件缺失':x.loaded?'已加载':x.launchable?'可加载':'仅安装信息')+(x.adapter==='blender'?'<small>Blender 操作面</small>':'')+'</td><td><button data-load="'+e(x.id)+'" '+(!x.launchable&&!x.loaded?'disabled':'')+'>'+(x.loaded?'解除加载':'加载')+'</button>'+(x.loaded?'<button data-open="'+e(x.id)+'">打开窗口</button>'+(x.adapter==='blender'?'<button data-panel="'+e(x.id)+'">操作面</button>':''):'')+'</td></tr>').join('')+'</tbody></table>';
  target.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>ctx.action(async()=>{const item=snapshot.items.find(x=>x.id===b.dataset.load);await api('software/load',{id:item.id,loaded:!item.loaded});await ctx.reload();}));
  target.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>ctx.action(()=>desktopAction('open',{id:b.dataset.open}),'已请求软件打开原生窗口'));
  target.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>ctx.action(()=>open(ctx,snapshot.items.find(x=>x.id===b.dataset.panel))));
 }
 async function refresh(){snapshot=await api('software');draw();}
 target.querySelector('[data-software-search]').oninput=draw;target.querySelector('[data-loaded-only]').onchange=draw;
 target.querySelector('[data-software-scan]').onclick=()=>ctx.action(async()=>{const b=target.querySelector('[data-software-scan]');b.disabled=true;b.textContent='扫描中…';try{await api('software/scan',{});await refresh();}finally{b.disabled=false;b.textContent='扫描本机';}});
 target.querySelector('[data-software-add]').onclick=()=>ctx.action(async()=>{const file=await window.desktop?.pickSource(false);if(file){await desktopAction('register',{path:file});await refresh();}});
 await refresh();
}
export async function open(ctx,item){
 const {escape:e,api}=ctx;let view=document.createElement('section');view.className='integration-catalog blender-panel';
 view.innerHTML='<header class="integration-head"><div><h2>Blender 操作面</h2><p>'+e(item.path)+' · 原生完整编辑器通过“打开 Blender”使用。</p></div><button data-blender-open>打开 Blender</button></header><div class="integration-filters"><input data-blend-path placeholder="选择 .blend 文件，或新建演示场景"><button data-blend-pick>选择场景</button><button data-blend-action="inspect">读取场景</button><button data-blend-action="render">渲染预览</button><button data-blend-action="demo">新建演示场景</button></div><p data-blend-state role="status">操作由本机 Blender 执行；禁用文件中的自动脚本。变换结果保存为独立版本，不覆盖原场景。</p><div class="blender-body"><div class="blender-preview"><img data-blend-preview alt="实际 Blender 渲染结果" hidden><p data-blend-empty>尚无渲染结果</p></div><aside><h3>场景对象</h3><select data-blend-objects size="8"></select><label>位置 X / Y / Z</label><div class="blender-vector"><input data-axis="0" type="number" step="0.1" value="0"><input data-axis="1" type="number" step="0.1" value="0"><input data-axis="2" type="number" step="0.1" value="0"></div><button data-blend-action="transform">保存变换并预览</button><p data-blend-output></p></aside></div><details open><summary>作业记录（关闭视图不会停止后台作业）</summary><div data-blend-jobs></div></details>';
 view=ctx.openTab('software:'+item.id,'Blender',view);if(view.dataset.bound)return;view.dataset.bound='true';
 let current=null,objects=[],timer=null;const source=()=>view.querySelector('[data-blend-path]').value;
 function adopt(job){current=job.id;if(job.result){objects=job.result.objects||[];view.querySelector('[data-blend-objects]').innerHTML=objects.map(o=>'<option value="'+e(o.name)+'">'+e(o.name)+' · '+e(o.type)+'</option>').join('');fill();if(job.result.blend)view.querySelector('[data-blend-path]').value=job.result.blend;else if(job.source)view.querySelector('[data-blend-path]').value=job.source;const img=view.querySelector('[data-blend-preview]');img.hidden=!job.result.render;if(job.result.render){img.src='/api/workbench/software/preview/'+job.id;view.querySelector('[data-blend-empty]').hidden=true;}view.querySelector('[data-blend-output]').textContent=job.result.blend||job.source||'';}view.querySelector('[data-blend-state]').textContent='作业 '+job.operation+'：'+job.status+(job.error?' · '+job.error:'')+' · 日志：'+job.directory;}
 function fill(){const object=objects.find(x=>x.name===view.querySelector('[data-blend-objects]').value);if(object)view.querySelectorAll('[data-axis]').forEach(i=>i.value=object.location[Number(i.dataset.axis)]);}
 async function refresh(){
  if(!view.isConnected){clearTimeout(timer);return;}
  const jobs=(await api('software/jobs')).items.filter(x=>x.software_id===item.id).reverse();
  view.querySelector('[data-blend-jobs]').innerHTML=jobs.map(j=>'<button data-job="'+e(j.id)+'">'+e(j.started_at)+' · '+e(j.operation)+' · '+e(j.status)+'</button>').join('');
  view.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>adopt(jobs.find(j=>j.id===b.dataset.job)));
  const latest=jobs.find(x=>x.id===current)||(!current?jobs[0]:null);if(latest)adopt(latest);
  const busy=jobs.some(x=>x.status==='running');view.querySelectorAll('[data-blend-action]').forEach(b=>b.disabled=busy);
  clearTimeout(timer);if(busy)timer=setTimeout(()=>ctx.action(refresh),1500);
 }
 view.querySelector('[data-blender-open]').onclick=()=>ctx.action(()=>desktopAction('open',{id:item.id,...(source()?{source:source()}:{})}));
 view.querySelector('[data-blend-pick]').onclick=()=>ctx.action(async()=>{const file=await window.desktop.pickSource(false);if(file)view.querySelector('[data-blend-path]').value=file;});
 view.querySelector('[data-blend-objects]').onchange=fill;
 view.querySelectorAll('[data-blend-action]').forEach(b=>b.onclick=()=>ctx.action(async()=>{const input={id:item.id,operation:b.dataset.blendAction,source:source(),object:view.querySelector('[data-blend-objects]').value,location:[...view.querySelectorAll('[data-axis]')].map(x=>Number(x.value))};view.querySelectorAll('[data-blend-action]').forEach(x=>x.disabled=true);try{const result=await desktopAction('run',input);current=result.job.id;}finally{await refresh();}}));
 await refresh();
}
