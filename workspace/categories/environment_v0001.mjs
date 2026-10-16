// File: environment_v0001.mjs
// 中文名: 工作台环境双清单
// Version: v0001
// Main Layer: action
// Layer: workbench / category views
// ALIAS_META
// alias: studio_category_environment
// family: studio_category_environment
// role: dependency_inventory_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/environment_v0001.mjs
// input: authenticated read-only environment snapshot
// output: two searchable factual lists
// depends_on: existing workbench API and Browser DOM
// used_by: studio_shell_v0012
let generation=0,timer=null;
export async function refresh(ctx){await render(ctx);}
export async function render(ctx){
 const step=++generation;clearTimeout(timer);const {target,escape:e}=ctx;
 target.innerHTML='<span class="section-caption">ENVIRONMENT / REQUIREMENT</span><h1 class="catalog-title">环境 / Requirement</h1><p class="catalog-description">两个清单：工作台当前加载状态，以及本工作区已安装环境。只观察，不打包或安装。可见时每 5 秒刷新。</p><p data-env-status>正在读取实际安装信息…</p><div data-env-body></div>';
 let previous='',query='';
 const title=document.getElementById('library-title'),count=document.getElementById('library-count'),list=document.getElementById('library-list');if(title)title.textContent='依赖清单';if(count)count.textContent='2';if(list){list.innerHTML='<button class="library-row" data-env-jump="live">实时加载清单</button><button class="library-row" data-env-jump="current">当前环境清单</button>';list.querySelectorAll('[data-env-jump]').forEach(button=>button.onclick=()=>target.querySelector('[data-env-'+button.dataset.envJump+']')?.scrollIntoView({block:'start',behavior:'smooth'}));}
 const labels={not_observed:'尚未观察到运行实例',running:'运行中',stopped:'已停止',unavailable:'不可用',available:'可用',enabled:'已启用',disabled:'未启用',installed:'已安装',missing:'缺失',unversioned:'未声明版本','static imports matched to actual installed distribution metadata':'静态导入匹配实际安装元数据','no dependency declaration available':'未提供可识别的依赖声明','loaded capability ID':'工作台已加载','enabled Skill market entry':'Skill 已启用','actual vendored REVISION':'读取随附库 REVISION'};
 const display=value=>labels[value]||value;
 const table=(rows,columns)=>'<div class="table-wrap" style="max-height:420px;overflow:auto"><table class="body-table" style="min-width:700px"><thead><tr>'+columns.map(x=>'<th>'+e(x[1])+'</th>').join('')+'</tr></thead><tbody>'+rows.filter(x=>JSON.stringify(x).toLowerCase().includes(query)).map(x=>'<tr>'+columns.map(c=>'<td>'+e(Array.isArray(x[c[0]])?x[c[0]].join('、'):display(x[c[0]]??'未提供'))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const draw=value=>{const live=value.loaded_requirements,env=value.current_environment;
  target.querySelector('[data-env-body]').innerHTML='<label class="form-field">搜索两个清单<input data-env-search placeholder="名称、版本、工具、资源或路径" value="'+e(query)+'"></label><section data-env-live><h2>实时加载清单</h2><p>Python '+e(env.python.version)+' · Node '+e(env.node.version||'未检测到')+'</p><p>已加载指工具栏中可用的工具及已加载能力、已启用 Skill；运行状态另列。静态依赖声明不表示所有可选功能正在执行。</p><h3>工具（'+live.tools.length+'）</h3>'+table(live.tools,[['name','工具'],['version','版本'],['runtime','运行环境'],['status','观察状态'],['python_dependencies','已安装 Python 依赖'],['unresolved_imports','未解析声明'],['dependency_basis','识别依据']])+'<h3>已加载资源（'+live.resources.length+'）</h3>'+table(live.resources,[['name','资源'],['kind','类型'],['version','版本'],['status','状态'],['source','来源'],['load_basis','加载依据']])+'<p>资源自身未提供依赖声明时，不推断其运行依赖。</p><h3>工作台 npm 声明及实际安装</h3>'+table(live.node_requirements,[['name','依赖'],['requested','声明'],['version','实际版本'],['status','状态']])+'<h3>加载工具的 Python 依赖</h3>'+table(live.python_requirements,[['name','依赖'],['version','实际版本']])+'</section><hr><section data-env-current><h2>当前环境清单</h2><p>范围：本工作区 .venv、前端 node_modules 和随附运行库；不代表整台电脑的所有软件。Python '+e(env.python.version)+' · Node '+e(env.node.version||'未检测到')+'</p><h3>已安装 Python（'+env.python.packages.length+'）</h3>'+table(env.python.packages,[['name','包'],['version','实际版本'],['path','位置']])+'<h3>已安装 npm（'+env.node.packages.length+'）</h3>'+table(env.node.packages,[['name','包'],['version','实际版本'],['requested','直接依赖声明'],['path','位置']])+'<h3>随附运行库</h3>'+table(env.vendored,[['name','运行库'],['version','实际版本'],['path','位置'],['basis','依据']])+'</section>';
  target.querySelector('[data-env-search]').oninput=event=>{query=event.target.value.toLowerCase();draw(value);const input=target.querySelector('[data-env-search]');input.focus();input.setSelectionRange(input.value.length,input.value.length);};
 };
 const update=async()=>{if(step!==generation||!target.isConnected||!target.querySelector('[data-env-body]'))return;try{if(!target.hidden&&!document.hidden){const value=await ctx.api('environment');if(step!==generation)return;if(previous!==value.fingerprint){previous=value.fingerprint;draw(value);}target.querySelector('[data-env-status]').textContent='观察时间：'+new Date(value.observed_at*1000).toLocaleString()+' · 清单随加载状态更新';}}catch(error){if(step===generation&&target.querySelector('[data-env-status]'))target.querySelector('[data-env-status]').textContent='读取失败：'+error.message;}finally{if(step===generation&&target.isConnected)timer=setTimeout(update,5000);}};
 await update();
}
