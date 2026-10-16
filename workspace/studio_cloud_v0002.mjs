// ============================================================
// 文件名: studio_cloud_v0002.mjs
// 中文名: 有界真实来源知识空间
// 版本号: v0002
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: bounded_source_projection_view
// 职责说明: 展示现有投影、来源与原对象证据
// 本脚本做什么: 读取已接入来源，空间浏览、聚合展开、二维和列表回退
// 本脚本不做什么: 不生成语义关系、历史，不启动 AI 或任务
// 制度边界声明: 只消费现有投影接口；三维深度明确编码真实有界指标
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_cloud_v0002
// family: studio_cloud
// role: bounded_source_projection_view
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/studio_cloud_v0002.mjs
// input: authenticated existing projection and object detail APIs
// output: bounded interactive source space and provenance
// depends_on: local Three.js 0.186.1, existing projection contracts
// used_by: studio_shell_v0007
// ============================================================
const SCRIPT_NAME='studio_cloud_v0002.mjs',SCRIPT_FAMILY='studio_cloud',SCRIPT_VERSION='v0002',DEFAULT_ENCODING='utf8';
const PALETTE=['#8bb8ff','#87dccb','#c4aaff','#f2c57c','#eca8c6','#a8c99a'];
const sourceColor=id=>PALETTE[[...id].reduce((hash,c)=>(hash*31+c.charCodeAt(0))>>>0,0)%PALETTE.length];

// ============================================================
// 来源视图：有界数据与展示坐标明确分离
// ============================================================
export async function openCloud({api,escape,openTab,action,preferredView}){
 const existing=document.querySelector('[data-knowledge-cloud]');
 if(existing){openTab('knowledge-cloud','知识空间',existing);if(preferredView)await existing.selectCloudSource?.(preferredView);return;}
 const view=document.createElement('section');view.className='cloud-view';view.dataset.knowledgeCloud='';
 view.innerHTML='<div class="cloud-heading"><div><span class="section-caption">KNOWLEDGE / 真实来源</span><h1>知识空间</h1></div><button data-cloud-refresh>刷新来源</button></div><div class="cloud-toolbar"><label>来源<select data-cloud-source aria-label="知识空间来源"></select></label><label>显示<select data-cloud-mode aria-label="知识空间显示方式"><option value="3d">三维浏览</option><option value="2d">二维投影</option><option value="list">对象列表</option></select></label><label>细节层级<select data-cloud-lod><option value="4">原对象 · 有界</option><option value="0.1">聚合概览</option></select></label><label>深度指标<select data-cloud-depth aria-label="三维深度指标"><option value="auto">自动：连接度／记录序号</option><option value="order">来源记录序号</option><option value="degree">当前投影连接度</option></select></label><button data-cloud-reset>重置范围与视角</button><button data-cloud-retry>重新初始化三维</button></div><p class="cloud-semantics">X/Y 沿用来源投影，Z 按所选指标在每个来源内归一化，序号与聚合数使用对数刻度；颜色区分来源。连接度仅计当前返回的边，聚合深度表示记录数。空间距离不代表语义相似，记录序号不是时间。最多同时读取 3 个来源，跨来源对象未自动合并。</p><p class="cloud-semantics" data-cloud-depth-info></p><div class="cloud-legend" data-cloud-legend></div><p data-cloud-status role="status" aria-live="polite">正在读取来源…</p><div class="cloud-layout"><div class="cloud-stage" data-cloud-stage tabindex="0" aria-label="知识空间画布：拖动旋转，滚轮缩放；也可使用二维或列表"><div data-cloud-empty>尚无投影</div></div><aside class="cloud-inspector"><h2>对象与证据</h2><div data-cloud-detail>选择星点或列表对象查看来源；聚合可展开到原对象。</div></aside></div><div class="cloud-list" data-cloud-list></div><section class="cloud-time"><label>时间范围 <input data-cloud-time type="range" disabled aria-label="时间筛选尚不可用"></label><p>已确认 data.db 时间旁表提供统一 UTC 原消息创建时间；当前投影接口尚未关联该旁表，时间筛选暂不可用。刷新时间不代表知识的产生时间。</p></section>';
 const layoutSection=view.querySelector('.cloud-layout');for(const info of [...view.querySelectorAll('.cloud-semantics'),view.querySelector('[data-cloud-legend]')].reverse())layoutSection.after(info);
 openTab('knowledge-cloud','知识空间',view);
 const q=selector=>view.querySelector(selector),host=q('[data-cloud-stage]');
 let sources=[],data=[],nodes=[],bounds,request=0,selection=0,disposed=false,initializing=false,gl,THREE,controls,scene,camera,cloud,edges,resizeObserver,mutations;
 const status=message=>q('[data-cloud-status]').textContent=message;
 const disposeGeometry=()=>{if(cloud){scene.remove(cloud);cloud.geometry.dispose();cloud.material.dispose();cloud=null;}if(edges){scene.remove(edges);edges.geometry.dispose();edges.material.dispose();edges=null;}};
 const releaseRenderer=()=>{resizeObserver?.disconnect();controls?.dispose();disposeGeometry();const previous=gl;gl=null;if(previous){previous.domElement.dataset.retired='true';previous.dispose();previous.domElement.remove();previous.forceContextLoss();}};
 const dispose=()=>{disposed=true;request++;selection++;mutations?.disconnect();releaseRenderer();window.removeEventListener('workbench-theme-change',renderFrame);document.removeEventListener('visibilitychange',renderFrame);};
 const renderFrame=()=>{if(disposed||!gl||view.hidden||document.hidden)return;const width=host.clientWidth,height=host.clientHeight;if(width<1||height<1)return;gl.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();scene.background=new THREE.Color(document.documentElement.dataset.theme==='star-ocean'?'#0b1220':'#f7f6f2');gl.render(scene,camera);};
 const resetCamera=()=>{if(camera){camera.position.set(460,320,620);controls.target.set(0,0,0);controls.update();renderFrame();}};
 const pointData=()=>{
  const all=data.flatMap(group=>group.nodes.map(node=>({...node,group})));let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(const node of all){xmin=Math.min(xmin,node.x);xmax=Math.max(xmax,node.x);ymin=Math.min(ymin,node.y);ymax=Math.max(ymax,node.y);}
  const scale=all.length?400/Math.max(1,xmax-xmin,ymax-ymin):1,cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const selected=q('[data-cloud-depth]').value;
  for(const group of data){
   const degree=new Map();for(const edge of group.edges){degree.set(edge.source,(degree.get(edge.source)||0)+1);if(edge.target!==edge.source)degree.set(edge.target,(degree.get(edge.target)||0)+1);}
   const cluster=group.nodes.some(node=>node.kind==='cluster');
   group.depthMetric=cluster?'聚合记录数':selected==='degree'||(selected==='auto'&&group.edges.length)?'当前投影连接度':'来源记录序号';
   const values=group.nodes.map(node=>cluster?Number(node.count)||0:group.depthMetric==='当前投影连接度'?degree.get(node.id)||0:Number(node.source_line)||0);
   group.depthRange=[Math.min(...values),Math.max(...values)];group.depthValue=new Map(group.nodes.map((node,i)=>[node.id,values[i]]));
  }
  return all.map(node=>{const value=node.group.depthValue.get(node.id),[lo,hi]=node.group.depthRange;return {...node,px:(node.x-cx)*scale,py:-(node.y-cy)*scale,pz:hi>lo?((node.group.depthMetric==='当前投影连接度'?(value-lo)/(hi-lo):(Math.log1p(value)-Math.log1p(lo))/(Math.log1p(hi)-Math.log1p(lo)))-.5)*320:0,depthValue:value,depthMetric:node.group.depthMetric};});
 };
 const inspect=async node=>{
  const step=++selection;
  q('[data-cloud-detail]').textContent='正在读取对象证据…';
  try{
   if(node.kind==='cluster'){
    q('[data-cloud-detail]').innerHTML='<p><strong>'+escape(node.group.name)+'</strong></p><p>空间聚合：'+escape(node.count)+' 条记录。该聚合不是语义主题，也不是永久对象身份。</p><pre>'+escape(JSON.stringify(node.bounds,null,2))+'</pre><button data-cloud-expand>展开此范围</button>';
    q('[data-cloud-expand]').onclick=()=>{q('[data-cloud-source]').value=node.group.viewId;bounds=node.bounds;q('[data-cloud-lod]').value='4';void action(load);};return;
   }
   const result=await api('resources/'+encodeURIComponent(node.group.resourceId)+'/objects/'+encodeURIComponent(node.id));
   if(disposed||selection!==step)return;
   q('[data-cloud-detail]').innerHTML='<h3>'+escape(node.label||node.id)+'</h3><p>来源：'+escape(node.group.name)+'</p><p><code>'+escape(node.id)+'</code></p><p>深度指标：'+escape(node.depthMetric)+' = '+escape(node.depthValue)+'。连接度仅计当前返回的边；序号不是事件时间。</p><pre>'+escape(JSON.stringify(result,null,2))+'</pre>';
  }catch(error){if(!disposed&&selection===step)q('[data-cloud-detail]').textContent='证据读取失败：'+error.message;}
 };
 const show2D=()=>{
  host.querySelector('[data-cloud-svg]')?.remove();
  if(q('[data-cloud-mode]').value!=='2d')return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.dataset.cloudSvg='';svg.setAttribute('viewBox','-250 -250 500 500');svg.setAttribute('aria-label','二维真实来源投影');
  for(const node of nodes){const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',node.px);dot.setAttribute('cy',node.py);dot.setAttribute('r',node.kind==='cluster'?6:3);dot.setAttribute('fill',sourceColor(node.group.resourceId));const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=node.label||node.id;dot.append(title);dot.onclick=()=>void inspect(node);svg.append(dot);}
  host.append(svg);
 };
 const rebuild=()=>{
  nodes=pointData();view.dataset.cloudDepthRange=nodes.length?String(Math.max(...nodes.map(n=>n.pz))-Math.min(...nodes.map(n=>n.pz))):'0';q('[data-cloud-depth-info]').textContent=data.map(group=>group.name+'：Z = '+group.depthMetric+'（'+group.depthRange.join('–')+'）').join('；')+(nodes.length&&Number(view.dataset.cloudDepthRange)===0?'。当前指标值相同，保留平面而不人为制造深度。':'');q('[data-cloud-empty]').hidden=nodes.length>0;
  q('[data-cloud-empty]').textContent=data.length?'该范围没有记录。':'尚无可用记录投影。请在数据库中选择数据表并打开“记录云团”，或接入带坐标的数据集。';
  q('[data-cloud-list]').innerHTML=nodes.length?'<h2>当前绘制对象 · '+nodes.length+'</h2><div class="cloud-object-grid">'+nodes.map((node,index)=>'<button data-cloud-object="'+index+'"><span>'+escape(node.group.name)+'</span><strong>'+escape(node.label||node.id)+'</strong><small>'+escape(node.kind==='cluster'?'空间聚合 · '+node.count+' 条':'原对象')+'</small></button>').join('')+'</div>':'';
  for(const button of q('[data-cloud-list]').querySelectorAll('[data-cloud-object]'))button.onclick=()=>void inspect(nodes[Number(button.dataset.cloudObject)]);
  if(gl){disposeGeometry();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(nodes.flatMap(node=>[node.px,node.py,node.pz]),3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(nodes.flatMap(node=>{const c=new THREE.Color(sourceColor(node.group.resourceId));return [c.r,c.g,c.b];}),3));cloud=new THREE.Points(geometry,new THREE.PointsMaterial({size:7,sizeAttenuation:false,vertexColors:true}));scene.add(cloud);
   const keyed=new Map(nodes.filter(node=>node.kind!=='cluster').map(node=>[node.group.resourceId+':'+node.id,node]));const segments=[];
   for(const group of data)for(const edge of group.edges){const a=keyed.get(group.resourceId+':'+edge.source),b=keyed.get(group.resourceId+':'+edge.target);if(a&&b)segments.push(a.px,a.py,a.pz,b.px,b.py,b.pz);}
   const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));edges=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:'#64748b',transparent:true,opacity:.45}));scene.add(edges);renderFrame();
  }show2D();
 };
 const mode=async()=>{
  let selected=q('[data-cloud-mode]').value;
  if(selected==='3d'&&!gl){if(initializing)return;initializing=true;try{
   THREE=await import('./vendor/three/three.module.mjs');const {OrbitControls}=await import('./vendor/three/OrbitControls.mjs');if(disposed)return;
   gl=new THREE.WebGLRenderer({antialias:true,alpha:false});gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.domElement.dataset.cloudCanvas='';host.append(gl.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,5000);controls=new OrbitControls(camera,gl.domElement);controls.enableDamping=false;controls.addEventListener('change',renderFrame);resetCamera();
   let down;gl.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});gl.domElement.addEventListener('pointerup',event=>{if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const box=gl.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.params.Points.threshold=6;ray.setFromCamera(new THREE.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),camera);const hit=cloud&&ray.intersectObject(cloud)[0];if(hit)void inspect(nodes[hit.index]);});
   gl.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(disposed||event.target.dataset.retired==='true')return;q('[data-cloud-mode]').value='2d';releaseRenderer();view.dataset.cloudRenderer='fallback';show2D();status('图形上下文已丢失，已切换二维；可点击重新初始化三维。原对象和证据仍可访问。');});
   resizeObserver=new ResizeObserver(renderFrame);resizeObserver.observe(host);rebuild();view.dataset.cloudRenderer='webgl';delete view.dataset.cloudError;
  }catch(error){releaseRenderer();view.dataset.cloudError=error.message;console.warn('Knowledge space WebGL initialization:',error);selected='2d';q('[data-cloud-mode]').value=selected;view.dataset.cloudRenderer='fallback';status('三维图形不可用：'+error.message+'。已使用二维投影，可重新初始化或切换对象列表。');}finally{initializing=false;}}
  if(disposed)return;selected=q('[data-cloud-mode]').value;
  if(gl)gl.domElement.hidden=selected!=='3d';q('[data-cloud-stage]').hidden=selected==='list';q('[data-cloud-list]').hidden=selected!=='list';show2D();renderFrame();
 };
 async function load(){
  const step=++request;selection++;status('正在读取所选来源；画面仍为上次结果…');q('[data-cloud-detail]').textContent='选择对象查看证据。';
  const chosen=sources.filter(source=>q('[data-cloud-source]').value==='all'||source.viewId===q('[data-cloud-source]').value).slice(0,3);
  const results=await Promise.allSettled(chosen.map(async source=>({...source,...await api('views/'+encodeURIComponent(source.viewId)+'/projection',{zoom:Number(q('[data-cloud-lod]').value),...(bounds?{bounds}:{})})})));
  if(disposed||request!==step)return;data=results.filter(result=>result.status==='fulfilled').map(result=>result.value);const failures=results.filter(result=>result.status==='rejected');
  q('[data-cloud-legend]').innerHTML=data.map(group=>'<span><i style="background:'+sourceColor(group.resourceId)+'"></i>'+escape(group.name)+' · 来源记录 '+escape(group.source_count)+' · 范围内 '+escape(group.visible_count)+' · 绘制 '+group.nodes.length+' · '+escape(group.layout==='ordered-record-grid'?'记录顺序布局':'来源二维坐标')+'</span>').join('');rebuild();await mode();
  if(disposed||request!==step)return;status((data.length?'已读取 '+data.length+' 个来源 · '+new Date().toLocaleTimeString('zh-CN',{hour12:false}):'没有可用投影')+(failures.length?' · '+failures.length+' 个来源读取失败：'+failures.map(result=>result.reason.message).join('；'):'')+(view.dataset.cloudRenderer==='fallback'?' · 三维不可用，使用回退视图':'')+(sources.length>3&&q('[data-cloud-source]').value==='all'?' · 其余来源请单独选择':''));
 }
 const refresh=async()=>{
  const [resources,views]=await Promise.all([api('resources'),api('views')]);if(disposed)return;
  sources=views.items.filter(item=>item.view_type==='graph'&&item.resource_id!=='workbench.system').map(item=>{const resource=resources.items.find(candidate=>candidate.resource_id===item.resource_id);return {viewId:item.view_id,resourceId:item.resource_id,name:resource?.display_name||item.resource_id};});
  const old=q('[data-cloud-source]').value;q('[data-cloud-source]').innerHTML='<option value="all">全部可用来源 · 最多 3 个</option>'+sources.map(source=>'<option value="'+escape(source.viewId)+'">'+escape(source.name)+'</option>').join('');q('[data-cloud-source]').value=sources.some(source=>source.viewId===(preferredView||old))?(preferredView||old):'all';preferredView=null;bounds=undefined;await load();
 };
 view.selectCloudSource=async id=>{preferredView=id;await refresh();};
 q('[data-cloud-depth]').onchange=rebuild;q('[data-cloud-retry]').onclick=()=>void action(async()=>{releaseRenderer();q('[data-cloud-mode]').value='3d';await mode();status(view.dataset.cloudRenderer==='webgl'?'三维渲染器已重新初始化。':'三维初始化失败：'+(view.dataset.cloudError||'图形上下文不可用'));});
 q('[data-cloud-refresh]').onclick=()=>void action(refresh);q('[data-cloud-source]').onchange=()=>{bounds=undefined;void action(load);};q('[data-cloud-lod]').onchange=()=>void action(load);q('[data-cloud-mode]').onchange=()=>void action(mode);q('[data-cloud-reset]').onclick=()=>{bounds=undefined;resetCamera();void action(load);};
 window.addEventListener('workbench-theme-change',renderFrame);document.addEventListener('visibilitychange',renderFrame);
 mutations=new MutationObserver(()=>{if(!view.isConnected)dispose();else renderFrame();});mutations.observe(document.getElementById('studio-content'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 await action(refresh);
}
