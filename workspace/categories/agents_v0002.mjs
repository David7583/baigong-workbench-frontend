// ============================================================
// 文件名: agents_v0002.mjs
// 中文名: AI 总控与本机 Agent 信息目录
// 版本号: v0002
// 主层级: action
// 层级: workbench / integration
// 脚本定位: AI 总控与本机 Agent 信息目录
// 职责说明: 通过已有索引和显式 JSON 契约提供真实信息
// 本脚本做什么: AI 总控与本机 Agent 信息目录
// 本脚本不做什么: 不自动授权模型、不安装软件、不卸载系统应用
// 制度边界声明: 只在明确操作后执行；用户数据保留；错误可追溯
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_category_agents_v0002
// family: studio_category_agents
// role: managed_integration
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/agents_v0002.mjs
// input: authenticated explicit operation or JSON request
// output: factual inventory or versioned result
// depends_on: standard library and existing managed APIs
// used_by: workbench_server_v0011
// ============================================================

const SCRIPT_NAME='studio_category_agents_v0002',SCRIPT_FAMILY='studio_category_agents',SCRIPT_VERSION='v0002',DEFAULT_ENCODING='utf8';
export async function render(ctx){
 const {target,escape:e,api}=ctx;target.classList.add('integration-catalog');
 target.innerHTML='<header class="integration-head"><div><h2>AI / Agent 信息目录</h2><p>总控目录、应用许可与本机检测分别展示。登记信息不代表已登录、已授权或已验证可调用。</p></div><button data-ai-refresh>刷新总控</button><button data-agent-scan>扫描本机 Agent</button></header><p data-ai-state role="status">正在连接 AI 总控…</p><div class="integration-filters"><input data-ai-search placeholder="搜索名称、模型、来源、路径"><select data-ai-kind><option value="">全部类型</option><option value="model">AI 模型</option><option value="controller_agent">总控 Agent</option><option value="application">总控应用</option><option value="local_agent">本机 Agent</option><option value="workbench_agent">工作台 Agent</option></select><span data-ai-count></span></div><div data-ai-list class="integration-table"></div><details><summary>观察边界与来源</summary><p data-ai-source></p></details>';
 let control=null,software=null,error='',rows=[];
 function draw(){
  rows=[];
  for(const provider of control?.providers||[])for(const model of provider.models)rows.push({kind:provider.provider==='local_agents'?'controller_agent':'model',label:provider.provider==='local_agents'?'总控 Agent':'AI 模型',name:model.display_name||model.model,id:provider.provider+':'+model.model,source:'AI 总控 / '+provider.provider,status:provider.provider==='local_agents'?(model.message||model.status):'目录已登记 · 调用未验证',detail:(model.capabilities||[]).join(' / '),path:''});
  for(const app of control?.applications||[])rows.push({kind:'application',label:'总控应用',name:app.app_id,source:'AI 总控',status:app.retired?'已退役':app.allowed?'应用许可已开':'应用许可关闭',detail:(app.selection?app.selection.provider+' / '+app.selection.model:'未选择模型')+' · 运行意图：'+(app.running?'启动':'暂停'),path:''});
  for(const agent of software?.agents||[])rows.push({kind:'local_agent',label:'本机 Agent · '+agent.kind,name:agent.name,source:agent.source,status:'检测到 · 未运行验证',detail:(agent.version?'版本 '+agent.version+' · ':'')+agent.evidence,path:agent.path||''});
  for(const agent of ctx.data.agents||[])rows.push({kind:'workbench_agent',label:'工作台 Agent',id:agent.id,name:agent.name,source:'工作台接取登记',status:'已登记',detail:(agent.skill_ids?.length||0)+' 个关联 Skill',path:'',agent});
  const query=target.querySelector('[data-ai-search]').value.toLowerCase(),kind=target.querySelector('[data-ai-kind]').value;
  const selected=rows.filter(row=>(!kind||row.kind===kind)&&JSON.stringify(row).toLowerCase().includes(query));
  target.querySelector('[data-ai-count]').textContent=selected.length+' / '+rows.length+' 条记录';
  const types=(control?.providers||[]).reduce((count,p)=>count+p.total,0);
  target.querySelector('[data-ai-state]').textContent=(error?'总控读取失败：'+error:control?'总控 '+(control.status==='connected'?'已连接':'部分来源不可用')+' · 总许可：'+(control.enabled===null?'未知':control.enabled?'开启':'关闭')+' · '+types+' 个模型/Agent · '+control.applications.length+' 个应用':'尚未连接')+'；本机 Agent '+(software?.agents?.length||0)+' 个。'+(software?.errors?.length?' 扫描有 '+software.errors.length+' 项异常。':'');
  target.querySelector('[data-ai-list]').innerHTML='<table><thead><tr><th>名称 / 标识</th><th>类型</th><th>来源</th><th>状态与证据</th></tr></thead><tbody>'+selected.slice(0,500).map(row=>'<tr><td><strong>'+e(row.name)+'</strong><small>'+e(row.id||'')+'</small></td><td>'+e(row.label)+'</td><td>'+e(row.source)+'</td><td>'+e(row.status)+'<small>'+e(row.detail)+'</small><small>'+e(row.path)+'</small>'+(row.agent?'<button data-bind-agent="'+e(row.id)+'">Skill 关联</button>':'')+'</td></tr>').join('')+'</tbody></table>'+(selected.length>500?'<p>显示前 500 条，请通过搜索缩小范围。</p>':'');
  target.querySelectorAll('[data-bind-agent]').forEach(b=>b.onclick=()=>ctx.bind(rows.find(x=>x.agent&&x.id===b.dataset.bindAgent).agent));
  target.querySelector('[data-ai-source]').textContent='总控配置：'+(control?.controller_config||'不可用')+'。总控问题：'+JSON.stringify(control?.problems||[])+'。本机扫描：'+(software?.scope||'尚未扫描')+'。扫描时间：'+(software?.observed_at||'无')+'。异常：'+JSON.stringify(software?.errors||[]);
 }
 async function refresh(force=false){error='';try{control=await api('ai/inventory'+(force?'?refresh=1':''));}catch(ex){error=ex.message;}software=await api('software');draw();}
 target.querySelector('[data-ai-search]').oninput=draw;target.querySelector('[data-ai-kind]').onchange=draw;
 target.querySelector('[data-ai-refresh]').onclick=()=>ctx.action(()=>refresh(true));
 target.querySelector('[data-agent-scan]').onclick=()=>ctx.action(async()=>{const button=target.querySelector('[data-agent-scan]');button.disabled=true;try{software=await api('software/scan',{});draw();}finally{button.disabled=false;}});
 await refresh();
}
