// ============================================================
// 文件名: studio_timeline_v0001.mjs
// 中文名: 原消息数量分布时间轴
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: source_timeline_histogram
// 职责说明: 柱状分布、时段会话检查与拖动选择
// 本脚本做什么: 展示真实计数和缺失主题，驱动有界消息投影
// 本脚本不做什么: 不编造主题、不执行数据库 SQL、不启动模型
// 制度边界声明: 半开时间窗口；旧结果不冒充新选区数据
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_timeline_v0001
// family: studio_timeline
// role: source_timeline_histogram
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_timeline_v0001.mjs
// input: authenticated timeline API and explicit cloud callback
// output: accessible histogram, source conversation list and selected window
// depends_on: workbench.timeline.v1
// used_by: studio_cloud_v0003
// ============================================================
const SCRIPT_NAME='studio_timeline_v0001',SCRIPT_FAMILY='studio_timeline',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';

export function installTimeline({host,api,escape,onWindow,onReset,onEvidence}){
 host.className='cloud-time timeline-panel';
 host.innerHTML='<div class="timeline-heading"><h2>原消息时间分布</h2><button data-timeline-read>读取真实时间分布</button><label>粒度<select data-timeline-grain aria-label="时间分布粒度"><option value="auto">自动</option><option value="day">日</option><option value="week">周</option><option value="month">月</option><option value="year">年</option></select></label><label>柱高<select data-timeline-metric aria-label="时间轴数量指标"><option value="messages">去重消息数</option><option value="conversations">有消息的来源会话数</option><option value="units">文本单元数</option></select></label></div><p data-timeline-status role="status">检查时间来源…</p><p class="timeline-help">时区：UTC+08:00。柱高表示真实数量，空时段保留零值。悬停或键盘聚焦查看该时段会话；点击锁定检查。主题只显示已持久化证据，目前主题未入库。消息、会话和文本单元分别计数，跨来源会话不自动合并。</p><div class="timeline-chart" data-timeline-chart></div><div class="timeline-brush"><label>窗口开始<input data-timeline-start type="range" min="0" max="0" value="0" disabled aria-label="时间窗口开始"></label><label>窗口结束<input data-timeline-end type="range" min="0" max="0" value="0" disabled aria-label="时间窗口结束"></label><label><input data-timeline-enabled type="checkbox" disabled>将所选时段的原消息显示到云团</label><button data-timeline-reset disabled>返回资源投影</button></div><p data-timeline-selection></p><div class="timeline-inspection"><h3 data-timeline-bucket-heading>时段会话</h3><p data-timeline-bucket-summary>悬停柱子查看来源会话及数量。</p><div data-timeline-conversations></div><button data-timeline-next hidden>下一页会话</button></div>';
 const q=s=>host.querySelector(s),status=s=>q('[data-timeline-status]').textContent=s;
 let summary,bins=[],disposed=false,loading=false,hoverTimer,windowTimer,windowRequest=0,bucketRequest=0,pinned=false,activeBucket,page=0;
 const date=seconds=>new Date(seconds*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
 const rangeText=(start,end)=>date(start)+' 至 '+date(end)+'（结束时刻不含）';
 const request=input=>api('timeline',input);
 const evidence=async item=>{try{const detail=await request({operation:'detail',asset_id:item.asset,message_id:item.sample_message});if(!disposed)onEvidence(detail);}catch(error){if(!disposed)status('证据读取失败：'+error.message);}};
 async function inspect(index,nextPage=0){
  const bucket=bins[index];if(!bucket)return;const step=++bucketRequest;activeBucket=index;page=nextPage;q('[data-timeline-bucket-heading]').textContent=rangeText(bucket.start,bucket.end);q('[data-timeline-bucket-summary]').textContent='正在读取该时段来源会话…';q('[data-timeline-conversations]').replaceChildren();q('[data-timeline-next]').hidden=true;
  try{const result=await request({operation:'bucket',start:bucket.start,end:bucket.end,page:nextPage});if(disposed||step!==bucketRequest)return;
   q('[data-timeline-bucket-summary]').textContent='去重消息 '+result.message_count+'；本页 '+result.items.length+' 个来源会话分组。主题未入库，以下原文入口不代表主题。';
   q('[data-timeline-conversations]').innerHTML=result.items.length?result.items.map((item,i)=>'<button data-timeline-conversation="'+i+'"><strong>'+escape(item.conversation_index===null?'会话身份未关联':'来源会话 #'+(item.conversation_index+1))+'</strong><span>主题未入库</span><small>'+escape(item.messages)+' 条消息 · '+escape(item.units)+' 个文本单元</small><small>资产 '+escape(item.asset)+' · 来源 '+escape(item.source_hash?.slice(0,12)||'未关联')+'</small><small>'+escape(date(item.first))+' — '+escape(date(item.last))+'</small><span>查看原文与身份依据</span></button>').join(''):'该时段无消息。';
   for(const button of q('[data-timeline-conversations]').querySelectorAll('button'))button.onclick=()=>void evidence(result.items[Number(button.dataset.timelineConversation)]);
   q('[data-timeline-next]').hidden=!result.has_more;
  }catch(error){if(!disposed&&step===bucketRequest)q('[data-timeline-bucket-summary]').textContent='时段读取失败：'+error.message;}
 }
 function scheduleInspect(index){if(pinned)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>void inspect(index),140);}
 function draw(){
  const metric=q('[data-timeline-metric]').value,max=Math.max(1,...bins.map(bin=>bin[metric]));const start=Number(q('[data-timeline-start]').value),end=Number(q('[data-timeline-end]').value);const width=960,height=132,bar=width/Math.max(1,bins.length);
  q('[data-timeline-chart]').innerHTML=bins.length?'<div class="timeline-axis"><span>'+escape(date(bins[0].start))+'</span><span>最大柱值 '+max+'</span><span>'+escape(date(bins.at(-1).end))+'</span></div><svg viewBox="0 0 '+width+' '+height+'" aria-label="真实数据量时间分布">'+bins.map((bin,i)=>{const h=bin[metric]/max*112;return '<rect data-timeline-bin="'+i+'" tabindex="0" role="button" aria-label="'+escape(rangeText(bin.start,bin.end)+'：'+bin.messages+' 条消息，'+bin.conversations+' 个来源会话')+'" x="'+i*bar+'" y="'+(height-Math.max(2,h))+'" width="'+Math.max(.5,bar-.4)+'" height="'+Math.max(2,h)+'" class="'+(bin[metric]===0?'empty ':'')+(i>=start&&i<=end?'selected':'')+'"><title>'+escape(rangeText(bin.start,bin.end)+' · '+bin.messages+' 条消息 · '+bin.conversations+' 个来源会话')+'</title></rect>';}).join('')+'</svg>':'没有有效事件时间。';
  for(const rect of q('[data-timeline-chart]').querySelectorAll('rect')){const index=Number(rect.dataset.timelineBin);rect.onpointerenter=()=>scheduleInspect(index);rect.onfocus=()=>scheduleInspect(index);const select=()=>{clearTimeout(hoverTimer);pinned=true;q('[data-timeline-start]').value=index;q('[data-timeline-end]').value=index;selection();void inspect(index);};rect.onclick=select;rect.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}if(event.key==='Escape'){pinned=false;status('已解除时段锁定，可继续悬停检查。');}};}
 }
 function selection(){if(!bins.length)return;let start=Number(q('[data-timeline-start]').value),end=Number(q('[data-timeline-end]').value);if(start>end){[start,end]=[end,start];}const selected=bins.slice(start,end+1);q('[data-timeline-selection]').textContent=rangeText(selected[0].start,selected.at(-1).end)+' · '+selected.reduce((sum,bin)=>sum+bin.messages,0)+' 条去重消息；会话可能跨时段，不能相加得到唯一会话数。';draw();clearTimeout(windowTimer);windowRequest++;if(q('[data-timeline-enabled]').checked){status('正在更新所选窗口；云团旧结果仍属于之前的时间窗口。');windowTimer=setTimeout(()=>void applyWindow(selected[0].start,selected.at(-1).end,windowRequest),180);}}
 async function applyWindow(start,end,step){try{const result=await request({operation:'window',start,end});if(disposed||step!==windowRequest||!q('[data-timeline-enabled]').checked)return;await onWindow(result);status('云团已更新：'+rangeText(start,end)+' · 时段内 '+result.visible_count+' 条消息，绘制 '+result.nodes.length+(result.truncated?'（有界截取）':'')+'。');}catch(error){if(!disposed&&step===windowRequest)status('时间窗口读取失败：'+error.message);}}
 async function load(){if(loading)return;loading=true;q('[data-timeline-read]').disabled=true;status('正在读取旁表并按原消息去重；首次构建私有索引可能需要数分钟，不修改业务库。');
  try{summary=await request({operation:'summary',grain:q('[data-timeline-grain]').value,offset_minutes:480});if(disposed)return;if(!summary.available){status(summary.reason);return;}bins=summary.bins;pinned=false;for(const name of ['start','end']){const slider=q('[data-timeline-'+name+']');slider.max=Math.max(0,bins.length-1);slider.value=name==='start'?0:Math.max(0,bins.length-1);slider.disabled=!bins.length;}q('[data-timeline-enabled]').disabled=!bins.length;q('[data-timeline-reset]').disabled=!bins.length;selection();status('来源去重消息 '+summary.total_messages+' · 来源会话 '+summary.total_conversations+' · '+bins.length+' 个'+({day:'日',week:'周',month:'月',year:'年'}[summary.grain])+'桶。无效时间文本单元 '+(summary.meta.statuses.invalid||0)+'；时间冲突消息 '+summary.meta.ambiguous_messages+'；未关联会话消息 '+summary.meta.messages_without_conversation+'。');
  }catch(error){if(!disposed)status('时间分布读取失败：'+error.message);}finally{loading=false;if(!disposed)q('[data-timeline-read]').disabled=false;}
 }
 q('[data-timeline-read]').onclick=()=>void load();q('[data-timeline-grain]').onchange=()=>void load();q('[data-timeline-metric]').onchange=draw;
 for(const name of ['start','end'])q('[data-timeline-'+name+']').oninput=selection;
 q('[data-timeline-enabled]').onchange=()=>{if(q('[data-timeline-enabled]').checked)selection();else{clearTimeout(windowTimer);windowRequest++;onReset();status('已返回原资源投影；时间分布仍可查看。');}};
 q('[data-timeline-reset]').onclick=()=>{q('[data-timeline-enabled]').checked=false;clearTimeout(windowTimer);windowRequest++;pinned=false;onReset();status('已解除时间筛选与时段锁定。');};q('[data-timeline-next]').onclick=()=>void inspect(activeBucket,page+1);
 void request({operation:'status'}).then(result=>{if(disposed)return;status(result.available?'已检测到原消息时间旁表。点击读取以构建真实数量分布；主题未入库。':result.reason);q('[data-timeline-read]').disabled=!result.available;}).catch(error=>{if(!disposed){status('时间适配不可用：'+error.message);q('[data-timeline-read]').disabled=true;}});
 return {reset(){q('[data-timeline-enabled]').checked=false;clearTimeout(windowTimer);windowRequest++;pinned=false;onReset();},dispose(){disposed=true;windowRequest++;bucketRequest++;clearTimeout(hoverTimer);clearTimeout(windowTimer);}};
}
