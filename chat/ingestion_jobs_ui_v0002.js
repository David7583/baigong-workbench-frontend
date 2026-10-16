// ============================================================
// 文件名: ingestion_jobs_ui_v0002.js
// 中文名: 总编排扫描与队列界面
// 版本号: v0002
// 主层级: action
// 层级: ui / ingestion_jobs
// 脚本定位: 展示服务返回的来源和任务状态
// 职责说明: 目录扫描、显式加入队列、启动及暂停
// 本脚本做什么: 调用队列 API，不在浏览器执行业务
// 本脚本不做什么: 不直接写库、不推断成功或伪造进度
// 制度边界声明: 文本安全渲染，真实写库由明确按钮授权
// 可更新: True
// ALIAS_META
// alias: ingestion_jobs_ui_v0002
// family: ingestion_jobs_ui
// role: queue_controls
// version: v0002
// status: active
// entry_point: scripts/action/development/scripts/independent_action_chat/web/ingestion_jobs_ui_v0002.js
// input: user folder and selected sources
// output: queue API calls and live status
// depends_on: browser DOM and action_chat_server_v0009
// used_by: index_v0009.html
// ============================================================
(() => {
  const selected = new Set();
  const card = document.createElement('details');
  card.className = 'control-card';
  card.id = 'ingestionCard';
  card.innerHTML = `<summary>数据处理与扫描 <span>v0021</span></summary>
    <div class="card-body">
      <label for="ingestionFolder">扫描指定文件夹</label>
      <input id="ingestionFolder" type="text" placeholder="例如 F:\\资料\\聊天导出">
      <button id="scanSources" type="button">扫描新数据源</button>
      <p class="hint">扫描 JSON 来源，按内容哈希识别已处理数据；扫描不会入库。不支持的格式会在编排预检时明确报错。</p>
      <p id="scanStatus" class="hint" role="status"></p>
      <div id="ingestionSources" style="max-height:260px;overflow:auto"></div>
      <button id="enqueueSources" type="button">将勾选来源加入队列</button>
      <label for="ingestionVector">摄取与写入</label>
      <select id="ingestionVector"><option value="none">SQLite + DuckDB（不计算向量）</option></select>
      <p class="hint">启动会写入现有业务库；保留中间产物。按来源依次处理，完成项不重复运行。向量后台独立追赶已提交数据；不等待向量完成即可继续摄取和聊天。</p>
      <button id="startIngestion" type="button">确认写入并启动 / 恢复队列</button>
      <button id="pauseIngestion" type="button" class="secondary">当前来源完成后暂停</button>
      <button id="startStores" type="button">启动检索底座后台</button>
      <button id="startVectors" type="button">启动 / 继续本地向量计算</button>
      <button id="pauseVectors" type="button" class="secondary">当前向量批次完成后暂停</button>
      <pre id="storeStatus" style="white-space:pre-wrap" aria-live="polite"></pre>
      <button id="refreshIngestion" type="button" class="secondary">刷新运行状态</button>
      <pre id="ingestionStatus" style="white-space:pre-wrap;word-break:break-word" aria-live="polite"></pre>
      <p id="ingestionNotice" class="hint" role="status"></p>
    </div>`;
  const panel = document.getElementById('settingsPanel');
  panel.insertBefore(card, panel.querySelector('.diagnostics'));
  const el = id => document.getElementById(id);
  const labels = {discovered:'新来源',queued:'已排队',running:'处理中',completed:'已完成',failed:'失败',interrupted:'待恢复',idle:'空闲',paused:'已暂停',offline:'未启动',starting:'正在启动',initializing:'加载共享模型中',computing:'计算中',caught_up:'已追平当前数据',permission_paused:'总控许可已暂停'};
  async function request(path,body) {
    const response = await fetch('/api/jobs/'+path, body === undefined ? {} : {
      method:'POST',headers:{'Content-Type':'application/json','X-Action-Jobs':'1'},body:JSON.stringify(body)
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error?.detail || JSON.stringify(value.error || value));
    return value;
  }
  let refreshing = false;
  async function refresh() {
    if(refreshing)return;
    refreshing=true;
    try {
      const value = await request('status');
      el('scanStatus').textContent = `扫描：${labels[value.scan.status] || value.scan.status} · ${value.scan.files || 0} 个文件${value.scan.error ? ' · '+value.scan.error : ''}`;
      el('ingestionSources').replaceChildren();
      for (const source of value.sources) {
        const label=document.createElement('label');label.style.display='block';label.style.overflowWrap='anywhere';
        const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(source.id);
        check.disabled=['completed','running'].includes(source.status);
        check.addEventListener('change',()=>check.checked ? selected.add(source.id) : selected.delete(source.id));
        const text=document.createElement('span');text.textContent=` ${labels[source.status] || source.status} · ${source.path} (${(source.size/1048576).toFixed(1)} MB)`;
        label.append(check,text);
        if(source.error){const error=document.createElement('p');error.textContent=source.error;error.className='hint';label.append(error);}
        el('ingestionSources').append(label);
      }
      el('storeStatus').textContent=`向量：${labels[value.stores?.vector?.status] || value.stores?.vector?.status || '未启动'} · 已索引 ${value.stores?.indexed_vectors || 0}\nDuckDB：${labels[value.stores?.duckdb?.status] || value.stores?.duckdb?.status || '未启动'}\n派生索引按已提交批次追赶；权威记录以 SQLite 为准。\n${value.stores?.vector?.error || value.stores?.duckdb?.error || ''}`;
      const counts=Object.entries(value.counts).map(([key,count])=>`${labels[key] || key}：${count}`).join(' · ');
      el('ingestionStatus').textContent=`运行：${labels[value.worker.status] || value.worker.status}\n${counts}\n${value.pause_requested ? '已请求在当前来源完成后暂停\n' : ''}${value.progress ? `run_id：${value.progress.run_id}\n阶段：${value.progress.phase || "处理中"}\n已提交批次：${value.progress.publication?.batches || 0}\n事务：${value.progress.transaction?.state || '准备中'}` : ''}${value.worker.error || ''}`;
    } catch(error) {el('ingestionNotice').textContent=error.message;}
    finally {refreshing=false;}
  }
  function bind(id,action) {
    el(id).addEventListener('click',async()=>{
      el(id).disabled=true;
      try {await action();el('ingestionNotice').textContent='请求已接受；以下运行状态以后台实际结果为准。';await refresh();}
      catch(error){el('ingestionNotice').textContent=error.message;}
      finally{el(id).disabled=false;}
    });
  }
  bind('scanSources',()=>request('scan',{folder:el('ingestionFolder').value}));
  bind('enqueueSources',async()=>{await request('enqueue',{ids:[...selected]});selected.clear();});
  bind('startIngestion',()=>request('start',{confirm_write:true,vector_target:el('ingestionVector').value}));
  bind('pauseIngestion',()=>request('pause',{}));
  bind('startStores',()=>request('stores/start',{}));
  bind('startVectors',()=>request('vectors/start',{confirm_model:true}));
  bind('pauseVectors',()=>request('vectors/pause',{}));
  bind('refreshIngestion',refresh);
  card.addEventListener('toggle',()=>{if(card.open)refresh();});
  setInterval(()=>{if(card.open && !document.hidden)refresh();},3000);
})();
