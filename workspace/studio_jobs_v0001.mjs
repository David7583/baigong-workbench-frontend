// ============================================================
// 文件名: studio_jobs_v0001.mjs
// 中文名: 核心数据任务操作面板
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace / jobs
// 脚本定位: 独立于聊天的后端任务入口
// 职责说明:
// - 提交明确的扫描、排队、入库与暂停操作
// 本脚本做什么:
// - 展示有界来源列表，确认写入后请求后台
// 本脚本不做什么:
// - 不自行入库，不执行模型，不自动扫描资料
// 制度边界声明:
// - 任务通过 backend.jobs.v1 JSON 交接，不以接收请求冒充完成
// - 动态来源转义，入库确认默认关闭
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_jobs_v0001
// family: studio_jobs
// role: explicit_core_job_controls
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_jobs_v0001.mjs
// input:
//   - authenticated UI context
// output:
//   - explicit backend job requests
// depends_on:
//   - backend.jobs.v1
// used_by:
//   - studio_operations_v0001
// ============================================================
const DEFAULT_ENCODING='utf8',SCRIPT_FAMILY='studio_jobs',SCRIPT_NAME='studio_jobs_v0001',SCRIPT_VERSION='v0001';
export function installJobs({view,api,escape,action}){
 const panel=document.createElement('section');panel.className='operations-panel';panel.dataset.coreJobs='';
 panel.innerHTML='<h2>核心数据任务</h2><p>不需要打开聊天。扫描只登记候选来源，勾选排队后才可显式开始入库。</p><label class="form-field">扫描目录<input data-jobs-folder placeholder="资料文件夹完整路径"><button data-jobs-pick>选择文件夹</button></label><div class="operations-buttons"><button data-jobs-scan>扫描来源</button><button data-jobs-refresh>刷新队列</button><button data-jobs-enqueue>选中来源入队</button></div><div data-jobs-sources class="jobs-source-list"></div><label><input type="checkbox" data-jobs-confirm>确认将队列资料写入正式事实库</label><div class="operations-buttons"><button data-jobs-start>开始 / 恢复入库</button><button data-jobs-pause>完成当前来源后暂停</button><button data-jobs-stores>启动原派生服务</button></div><p data-jobs-result role="status"></p>';
 view.append(panel);const q=s=>panel.querySelector(s);
 const refresh=async()=>{const value=await api('operations/status');const queue=value.diagnostics?.pipelines?.ingestion||{};q('[data-jobs-sources]').innerHTML=(queue.sources||[]).map(s=>'<label><input type="checkbox" value="'+escape(s.id)+'" '+(['discovered','failed','interrupted','queued'].includes(s.status)?'':'disabled')+'> '+escape(s.status)+' · '+escape(s.path)+(s.error?' · 有错误记录':'')+'</label>').join('')||'<p>暂无可观察来源。缺失账本或观察失败不代表队列已完成。</p>';};
 const submit=async(operation,params={})=>{const result=await api('operations/jobs',{operation,...params});q('[data-jobs-result]').textContent='请求结果：'+result.status+'。任务完成情况以后台账本为准。';await refresh();};
 const bind=(selector,fn)=>q(selector).onclick=()=>action(async()=>{q(selector).disabled=true;try{await fn();}finally{q(selector).disabled=false;}});
 bind('[data-jobs-refresh]',refresh);
 bind('[data-jobs-scan]',()=>submit('scan',{folder:q('[data-jobs-folder]').value}));
 bind('[data-jobs-enqueue]',()=>submit('enqueue',{ids:[...q('[data-jobs-sources]').querySelectorAll('input:checked')].map(x=>x.value)}));
 bind('[data-jobs-start]',async()=>{if(!q('[data-jobs-confirm]').checked)throw new Error('请先确认写入正式事实库');await submit('start',{confirm_write:true});q('[data-jobs-confirm]').checked=false;});
 bind('[data-jobs-pause]',()=>submit('pause'));
 bind('[data-jobs-stores]',()=>submit('stores_start'));
 bind('[data-jobs-pick]',async()=>{const folder=await window.desktop?.pickSource(true);if(folder)q('[data-jobs-folder]').value=folder;});
 void action(refresh);
}
