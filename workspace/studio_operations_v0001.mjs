// ============================================================
// 文件名: studio_operations_v0001.mjs
// 中文名: 工作台运行中心
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace / operations
// 脚本定位: 状态观察与显式路径选择的界面
//
// 职责说明:
// - 显示运行进度、错误、向量路径、资源预算与存储预览
//
// 本脚本做什么:
// - 调用认证工作台接口，提供新旧向量切换和有限任务按钮
//
// 本脚本不做什么:
// - 不自行查询业务库，不执行模型，不删除文件
//
// 制度边界声明:
// - 使用真实状态，区分离线与账本记录；切换不隐含启动
// - 所有内容作为文本显示；后台操作显式触发并保留错误
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: studio_operations_v0001
// family: studio_operations
// role: runtime_status_and_explicit_vector_control_view
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_operations_v0001.mjs
// input:
//   - authenticated workbench UI context
// output:
//   - runtime center view and explicit commands
// depends_on:
//   - workbench_runtime_control_v0001
// used_by:
//   - studio_shell_v0002
// ============================================================
import {installJobs} from './studio_jobs_v0001.mjs';
const DEFAULT_ENCODING='utf8',SCRIPT_FAMILY='studio_operations',SCRIPT_NAME='studio_operations_v0001',SCRIPT_VERSION='v0001';
function runtimeLabel(live){
 if(live?.status==='pausing')return '正在暂停：等待当前单元完成并释放资源';
 if(live?.pause_completed&&live.gpu_released)return '已暂停：计算进程已退出';
 return live?.status;
}
export async function openOperations({api,escape,openTab,action,log}){
 const view=document.createElement('section');view.className='operations-view document-view';
 view.innerHTML='<div class="operations-heading"><div><span class="section-caption">RUNTIME / 运行观察</span><h1>运行中心</h1></div><button data-refresh>刷新状态</button></div><p class="category-hint">关闭标签、从工作台移除、暂停计算、停止服务分别管理。向量路径切换只作用于后续查询与任务。</p><div data-status>正在读取真实状态…</div><section class="operations-panel"><h2>向量路径</h2><label class="form-field">默认计算与检索路径<select data-vector-path><option value="paragraph">锚点原段落 · 新流水线</option><option value="legacy">概念 / 实例 · 原流水线</option></select></label><button data-select>应用路径选择</button><p data-selection-note></p><div class="operations-controls"><label>本次最多段落<input data-limit type="number" min="1" max="1000" value="30"></label><label>本次时间预算（秒）<input data-seconds type="number" min="5" max="3600" value="60"></label></div><div class="operations-buttons"><button data-service-start>开启新路径空闲服务</button><button data-start>开始 / 续跑所选路径</button><button data-pause>暂停所选路径</button><button data-stop>停止所选服务</button><button data-retry>重试新路径未恢复段落</button></div><p class="category-hint">新路径按原段落恢复，不截断超长段落。时间预算在段落之间检查；在途模型请求可能超过预算。原路径未运行时请使用原入口启动。</p><pre data-result class="skill-document" hidden></pre></section><section class="operations-panel"><h2>存储使用</h2><p>区分原始资料、事实库、索引、缓存及恢复备份。此存储清点仅显示占用；中间文件清理请使用下方的独立清理入口。</p><button data-storage>清点本地存储</button><div data-storage-result></div></section>';
 const cleanupPanel=document.createElement('section');cleanupPanel.className='operations-panel';cleanupPanel.innerHTML='<h2>中间文件清理</h2><p>清理已核验、已消费的交接文件，并重试正式入库完成后的准备副本清理。失败、暂停和运行中的任务保留；原始资料、正式库、附件、Skill 和恢复备份保留。</p><button data-cleanup-preview>预览可清理任务</button><button data-cleanup-execute disabled>清理本次预览中的已完成任务</button><pre data-cleanup-result></pre>';view.append(cleanupPanel);
 installJobs({view,api,escape,action});const q=selector=>view.querySelector(selector);let state,cleanupTasks=[];
 q('[data-cleanup-preview]').onclick=()=>action(async()=>{const result=await api('operations/cleanup',{operation:'preview'});cleanupTasks=result.tasks.filter(x=>x.eligible).map(x=>({manifest:x.manifest,sha256:x.sha256,...(x.kind?{kind:x.kind}:{})}));q('[data-cleanup-result]').textContent=JSON.stringify(result,null,2);q('[data-cleanup-execute]').disabled=cleanupTasks.length===0;},'已预览任务清单，未删除文件');
 q('[data-cleanup-execute]').onclick=()=>action(async()=>{q('[data-cleanup-execute]').disabled=true;const result=await api('operations/cleanup',{operation:'execute',tasks:cleanupTasks});cleanupTasks=[];q('[data-cleanup-result]').textContent=JSON.stringify(result,null,2);},'清理已执行，逐项结果与保留原因见下方');
 const refresh=async()=>{state=await api('operations/status');q('[data-vector-path]').value=state.selection.selected;const pipeline=state.diagnostics.pipelines||{};const cards=[['新段落向量',state.services.paragraph,pipeline.paragraph_vectors],['原向量路径',state.services.legacy,pipeline.legacy_vectors],['数据摄取',null,pipeline.ingestion]];q('[data-status]').innerHTML='<div class="operations-grid">'+cards.map(([name,live,stored])=>'<section class="operations-panel"><h2>'+escape(name)+'</h2><strong class="operations-state">'+escape(runtimeLabel(live)||stored?.status||(stored?.paused?'已暂停':'仅有账本记录'))+'</strong><dl><dt>实时状态</dt><dd>'+escape(live?'由服务接口观察':'未启动探测，仅显示账本')+'</dd><dt>进度 / 账本</dt><dd><pre>'+escape(JSON.stringify(stored||{},null,2))+'</pre></dd><dt>当前服务</dt><dd><pre>'+escape(JSON.stringify(live||{},null,2))+'</pre></dd></dl></section>').join('')+'</div><details class="operations-panel"><summary>启动依赖检查</summary><pre>'+escape(JSON.stringify({environment:state.diagnostics.environment,agents:state.diagnostics.agent_dependencies},null,2))+'</pre></details>';q('[data-selection-note]').textContent='当前已保存：'+state.selection.choices.find(x=>x.id===state.selection.selected).name+'。切换不移动或删除旧索引，也不会自动开始全量计算。';};
 const perform=async(operation,settings)=>{const path=q('[data-vector-path]').value;if(path!==state.selection.selected)throw new Error('路径选择尚未应用，请先点击“应用路径选择”');const result=await api('operations/control',{path,operation,settings});q('[data-result]').hidden=false;q('[data-result]').textContent=JSON.stringify(result,null,2);await refresh();};
 q('[data-refresh]').onclick=()=>action(refresh,'运行状态已刷新');
 q('[data-select]').onclick=()=>action(async()=>{await api('operations/select',{selected:q('[data-vector-path]').value});await refresh();},'已保存向量路径选择；后续请求使用此路径');
 q('[data-service-start]').onclick=()=>action(async()=>{if(q('[data-vector-path]').value!=='paragraph')throw new Error('空闲服务开启仅支持新路径');await perform('service_start');},'已请求开启空闲服务；未领取向量计算任务');
 q('[data-start]').onclick=()=>action(async()=>{if(!q('[data-limit]').reportValidity()||!q('[data-seconds]').reportValidity())return;await perform('start',{max_paragraphs:Number(q('[data-limit]').value),max_work_seconds:Number(q('[data-seconds]').value)});},'已提交有限向量任务；完成状态请刷新查看');
 q('[data-pause]').onclick=()=>action(()=>perform('pause'),'正在暂停：当前单元完成、校验并保存进度后释放资源');
 q('[data-stop]').onclick=()=>action(()=>perform('shutdown'),'已请求停止服务');
 q('[data-retry]').onclick=()=>action(()=>perform('retry_rejected'),'已重置新路径拒绝项，点击续跑重试');
 q('[data-storage]').onclick=()=>action(async()=>{q('[data-storage]').disabled=true;try{const result=await api('operations/storage');q('[data-storage-result]').innerHTML='<p>观察到 '+escape((result.total_bytes_observed/1073741824).toFixed(2))+' GiB'+(result.truncated?' · 尚未清点完毕':'')+'</p><table class="body-table"><thead><tr><th>目录</th><th>用途</th><th>大小</th><th>文件数</th></tr></thead><tbody>'+(result.groups||[]).map(x=>'<tr><td>'+escape(x.directory)+'</td><td>'+escape(x.purpose)+'</td><td>'+escape((x.bytes/1073741824).toFixed(2))+' GiB</td><td>'+escape(x.files)+'</td></tr>').join('')+'</tbody></table>';}finally{q('[data-storage]').disabled=false;}},'存储清点完成；未删除文件');
 openTab('runtime-center','运行中心',view);await refresh();log('已读取真实运行状态');
}
