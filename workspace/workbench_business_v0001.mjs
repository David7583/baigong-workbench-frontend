// ============================================================
// 文件名: workbench_business_v0001.mjs
// 中文名: 按需业务发现与仪表盘视图
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 按需业务发现与仪表盘视图
//
// 职责说明:
// - 展示扫描候选、登记证据、选择加载和空工作台恢复，不执行候选程序
//
// 本脚本做什么:
// - 展示扫描候选、登记证据、选择加载和空工作台恢复，不执行候选程序
//
// 本脚本不做什么:
// - 不自动执行业务，不发起模型调用，不改写原始数据库
//
// 制度边界声明:
// - 业务来源只读；工作台状态写入私有索引；测试产物仅在临时目录
// - 错误保留分类信息，缺失语义不推断为运行成功
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: workbench_business_v0001
// family: workbench_business
// role: workbench_business
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/workbench_business_v0001.mjs
// input:
//   - API, view container and navigation callbacks
// output:
//   - business dashboard and explicit load or unload commands
// depends_on: []
// used_by:
//   - workbench_workspace_v0001
// ============================================================

const DEFAULT_ENCODING='utf8';
const SCRIPT_FAMILY='workbench_business';
const SCRIPT_NAME='workbench_business_v0001';
const SCRIPT_VERSION='v0001';
// ============================================================
// 独立按需视图：只在用户进入业务页面时加载
// ============================================================
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function registryTable(registry){
 if(!registry)return '<p class="muted">尚未选择可识别的 Action 登记库。登记数量不等于可运行数量。</p>';
 return '<p class="source">'+esc(registry.source)+'</p><div class="metric-grid">'+registry.tables.map(t=>'<section class="metric"><span>'+esc(t.name)+'</span><b>'+t.count.toLocaleString()+'</b><small>已登记记录</small></section>').join('')+'</div>'+registry.tables.filter(t=>t.sample.length).map(t=>'<details><summary>'+esc(t.name)+' · 查看登记样例</summary><div class="table-scroll"><table>'+t.sample.map(row=>'<tr>'+Object.values(row).map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</table></div></details>').join('');
}
export async function renderBusiness({target,api,onChanged,onUnload,onOpen}){
 const controller=new AbortController();let catalog=null;
 target.innerHTML='<div class="eyebrow">CONTEXT / ON DEMAND</div><h1>业务仪表盘</h1><p class="muted">从本机位置与登记事实建立上下文。识别不会启动程序，加载不会授予业务权限。</p><section id="loaded-business"></section><section class="surface"><h2>识别本地业务来源</h2><label for="discovery-roots">扫描目录，每行一个；相对路径从项目根解析</label><textarea id="discovery-roots" rows="3">sql\nsoftware</textarea><div class="actions"><button id="scan-business" class="primary">识别候选</button><button id="load-business" disabled>加载所选</button></div><p id="business-progress" role="status"></p><div id="business-candidates"></div><div id="registry-preview"></div></section>';
 const query=id=>target.querySelector('#'+id);
 const dashboard=async()=>{
  try{
   const value=await api.call('business/dashboard',undefined,controller.signal);if(controller.signal.aborted)return;
   query('loaded-business').innerHTML='<div class="section-heading"><h2>当前业务上下文</h2><button id="unload-business" class="secondary">卸载业务 · 回到空工作台</button></div><div class="cards">'+value.resources.map(x=>'<button class="card" data-business-resource="'+esc(x.resource_id)+'"><strong>'+esc(x.display_name)+'</strong><span class="badge">'+esc(x.resource_type)+'</span><small>'+esc(x.health.status)+' · '+esc(x.runtime.status)+'</small><p class="source">'+esc(x.entry.path || x.entry.endpoint)+'</p></button>').join('')+'</div><h3>Action 登记事实</h3>'+registryTable(value.registry)+(value.problem?'<p class="error">'+esc(value.problem)+'</p>':'');
   query('unload-business').onclick=async()=>{try{await api.call('business/unload',{});await onUnload();}catch(error){if(!controller.signal.aborted)query('business-progress').textContent='卸载失败：'+error.message;}};
   target.querySelectorAll('[data-business-resource]').forEach(button=>button.onclick=()=>onOpen(button.dataset.businessResource));
  }catch(error){if(!controller.signal.aborted){query('loaded-business').innerHTML=error.code==='BUSINESS_UNLOADED'?'<div class="empty-state"><span class="empty-symbol">◇</span><h2>尚未加载业务</h2><p>工作台正常运行。先识别，再选择你需要的来源。</p></div>':'<p class="error">仪表盘读取失败：'+esc(error.message)+'</p><button id="retry-dashboard">重试</button>';const retry=query('retry-dashboard');if(retry)retry.onclick=dashboard;}}
 };
 query('scan-business').onclick=async()=>{
  query('scan-business').disabled=true;query('business-progress').textContent='正在识别文件与登记信息…';
  try{
   catalog=await api.call('business/discover',{roots:query('discovery-roots').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)},controller.signal);if(controller.signal.aborted)return;
   query('business-progress').textContent='识别 '+catalog.candidates.length+' 个候选 · '+catalog.problems.length+' 个问题'+(catalog.truncated?' · 达到扫描预算，请缩小目录':'')+'。未启动或加载业务。';
   query('business-candidates').innerHTML=catalog.candidates.length?'<div class="table-scroll"><table><thead><tr><th>选择</th><th>来源</th><th>识别结果</th><th>位置</th></tr></thead><tbody>'+catalog.candidates.map(x=>'<tr><td><input type="checkbox" aria-label="选择 '+esc(x.name)+'" data-candidate="'+esc(x.id)+'"></td><td>'+esc(x.name)+'</td><td>'+esc(x.driver || 'CMD')+'<small class="block muted">文件存在 · 运行情况未验证</small></td><td class="source">'+esc(x.path)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="empty-state">该范围没有可识别来源，可修改目录后重试。</p>';
   target.querySelectorAll('[data-candidate]').forEach(box=>box.onchange=()=>{query('load-business').disabled=!target.querySelector('[data-candidate]:checked');});
   query('registry-preview').innerHTML='<h3>识别到的登记信息</h3>'+registryTable(catalog.registry)+(catalog.problems.length?'<details><summary>扫描问题</summary>'+catalog.problems.map(x=>'<p class="source">'+esc(x.path)+' · '+esc(x.code)+'</p>').join('')+'</details>':'');
  }catch(error){if(!controller.signal.aborted)query('business-progress').textContent='识别失败：'+error.message;}
  finally{if(!controller.signal.aborted)query('scan-business').disabled=false;}
 };
 query('load-business').onclick=async()=>{
  query('load-business').disabled=true;
  try{await api.call('business/load',{candidate_ids:[...target.querySelectorAll('[data-candidate]:checked')].map(x=>x.dataset.candidate)},controller.signal);await onChanged();if(!controller.signal.aborted){await dashboard();query('business-progress').textContent='已加载所选来源。业务程序仍由其自身入口控制。';}}
  catch(error){if(!controller.signal.aborted)query('business-progress').textContent='加载失败：'+error.message;}
  finally{if(!controller.signal.aborted)query('load-business').disabled=false;}
 };
 await dashboard();
 return {dispose(){controller.abort();}};
}
