// ============================================================
// 文件名: studio_overview_v0001.mjs
// 中文名: 空工作台后端总览
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace / overview
// 脚本定位: 核心后端事实的只读界面
// 职责说明:
// - 展示实时服务、账本、事实库和工具运行状态
// 本脚本做什么:
// - 有界刷新认证观察接口，标注来源时间及失联
// 本脚本不做什么:
// - 不加载工具，不启动任务、模型或业务服务
// 制度边界声明:
// - 未观察、失联、账本记录与完成分别展示
// - 所有动态内容转义，失败保留上次观察时间
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_overview_v0001
// family: studio_overview
// role: read_only_backend_dashboard
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_overview_v0001.mjs
// input:
//   - authenticated UI context
// output:
//   - backend observation view
// depends_on:
//   - backend.monitor.v1
// used_by:
//   - studio_shell_v0003
// ============================================================
const DEFAULT_ENCODING='utf8',SCRIPT_FAMILY='studio_overview',SCRIPT_NAME='studio_overview_v0001',SCRIPT_VERSION='v0001';
const labels={offline:'离线',unavailable:'无法确认',not_configured:'未配置',not_initialized:'未初始化',available:'可读取',running:'运行中',stopped:'已退出',not_observed:'未观察',pausing:'暂停中',paused:'已暂停',ready:'空闲就绪',computing:'计算中',idle:'空闲',failed:'失败',interrupted:'待恢复',queued:'排队中',discovered:'已发现',completed:'已完成',committed:'已提交',rejected:'被拒绝'};
const text=value=>labels[value]||value||'未知';
export async function openOverview({api,escape,openTab,action}){
 const existing=document.querySelector('[data-backend-overview]');
 if(existing){openTab('backend-overview','后端总览',existing);return;}
 const view=document.createElement('section');view.className='operations-view document-view';view.dataset.backendOverview='';
 view.innerHTML='<div class="operations-heading"><div><span class="section-caption">SYSTEM / 核心后端</span><h1>后端总览</h1></div><button data-overview-refresh>刷新观察</button></div><p class="category-hint">工作台提供监控视角。工具按需加载；本页只观察，不启动模型或处理任务。</p><p data-observed-at role="status">正在读取后端事实…</p><div data-overview-body></div>';
 const q=s=>view.querySelector(s);let refreshing=false,lastAt=null;
 const count=value=>Number.isFinite(value)?value.toLocaleString('zh-CN'):'未观察';
 const refresh=async()=>{
  if(refreshing)return;refreshing=true;q('[data-overview-refresh]').disabled=true;
  try{
   const [state,tools]=await Promise.all([api('operations/status'),api('studio/tool-status')]);const diagnostics=state.diagnostics||{},pipelines=diagnostics.pipelines||{},paragraph=pipelines.paragraph_vectors||{},ingestion=pipelines.ingestion||{},resources=diagnostics.resources||{};
   lastAt=state.observed_at;q('[data-observed-at]').textContent='观察时间：'+new Date(lastAt).toLocaleString('zh-CN',{hour12:false})+' · 每 15 秒刷新可见总览';
   const panel=(name,body)=>'<section class="operations-panel"><h2>'+escape(name)+'</h2>'+body+'</section>';
   const live=Object.entries(state.services||{}).map(([id,s])=>'<p><strong>'+escape(id==='paragraph'?'原段落向量服务':'原派生服务')+'</strong>：'+escape(text(s.status))+'</p><p class="category-hint">'+escape(s.gpu_released===true?'自身进程已退出':s.status==='pausing'?'等待当前单元完成与提交':s.status==='offline'?'尚未运行；账本仍可查看':'实时接口观察；状态异常时不推断任务完成')+'</p>').join('');
   const states=Object.entries(paragraph.states||{}).map(([key,n])=>escape(text(key))+' '+count(n)).join(' · ')||'暂无段落账本';
   const queues=Object.entries(ingestion.source_states||{}).map(([key,n])=>escape(text(key))+' '+count(n)).join(' · ')||'暂无队列记录';
   const dbs=Object.entries(diagnostics.databases||{}).map(([id,db])=>panel(id==='source'?'来源事实库':'Action 事实库','<p>'+escape(text(db.status))+'</p>'+Object.entries(db.counts||{}).map(([table,n])=>'<p><code>'+escape(table)+'</code> <strong>'+count(n)+'</strong></p>').join(''))).join('');
   const errors=Object.entries(pipelines).filter(([,v])=>v.last_error||v.status==='unavailable'||(v.states?.rejected||0)>0).map(([id,v])=>'<li>'+escape(id)+'：'+escape(v.last_error||v.error_type||'存在拒绝项')+'</li>').join('');
   const toolRows=(tools.items||[]).map(t=>'<tr><td>'+escape(t.name)+'</td><td>'+escape(t.loaded?'已加载':'已卸载接入')+'</td><td>'+escape(text(t.status))+'</td></tr>').join('');
   q('[data-overview-body]').innerHTML='<div class="operations-grid">'+panel('实时服务',live||'未观察')+panel('原段落向量账本','<p>'+states+'</p><p>扫描：'+escape(paragraph.scan_complete===true?'已遍历当前来源':'尚未确认扫描完成')+'</p><p class="category-hint">段落与来源文本单元口径不同，不据此计算全库百分比。</p>')+panel('数据处理账本','<p>'+queues+'</p><p>暂停请求：'+escape(ingestion.paused===true?'已记录':'未记录')+'</p><p>最近工作状态：'+escape(text(ingestion.worker_recorded?.status))+'</p><p class="category-hint">这是持久账本记录，不代表对应进程当前在线。</p>')+dbs+panel('计算资源',resources.status==='observed'?'<p>CPU：'+escape(resources.cpu_percent)+'%</p><p>可用内存：'+escape((resources.memory_available/1073741824).toFixed(1))+' / '+escape((resources.memory_total/1073741824).toFixed(1))+' GiB</p><p class="category-hint">显存使用未观测；不以模型文件存在推断模型已加载。</p>':'当前资源不可观测')+'</div>'+panel('故障与待处理',errors?'<ul>'+errors+'</ul>':'本次观察范围未发现记录错误；未配置与未观察项目仍需分别核查。')+panel('独立工具','<p class="category-hint">加载、关闭标签、运行和停止分别管理。观察不会启动工具。</p><div class="table-wrap"><table class="body-table"><thead><tr><th>工具</th><th>接入状态</th><th>运行状态</th></tr></thead><tbody>'+toolRows+'</tbody></table></div>')+'<details class="operations-panel"><summary>观察范围与原始状态</summary><pre>'+escape(JSON.stringify({observed_at:state.observed_at,diagnostics,services:state.services},null,2))+'</pre></details>';
  }catch(error){q('[data-observed-at]').textContent='观察失败：'+error.message+(lastAt?' · 以下为上次 '+new Date(lastAt).toLocaleString('zh-CN')+' 的记录，已过期':' · 尚无可用观察');throw error;}
  finally{refreshing=false;q('[data-overview-refresh]').disabled=false;}
 };
 q('[data-overview-refresh]').onclick=()=>action(refresh);
 const timer=setInterval(()=>{if(!view.isConnected){clearInterval(timer);return;}if(!view.hidden&&!document.hidden)void action(refresh);},15000);
 openTab('backend-overview','后端总览',view);await action(refresh);
}
