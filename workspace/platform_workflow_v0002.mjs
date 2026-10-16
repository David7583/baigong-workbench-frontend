// ============================================================
// 文件名: platform_workflow_v0002.mjs
// 中文名: 能力编排可视化编辑器
// 版本号: v0002
// 主层级: action
// 层级: workbench / workspace / workflow
// 脚本定位: 现有桌面工作区内的节点编辑界面
// 职责说明: 分离节点定义、画布实例、编辑历史和执行状态。
// 本脚本做什么: 分类检索、端口连线、组合编辑、Schema 属性、AI 建议预览和运行观察。
// 本脚本不做什么: 不直接执行业务，不读取密钥，不授予运行权限。
// 制度边界声明: 所有建议先预览确认；服务不可用不阻断本地编辑。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: platform_workflow_v0002
// family: platform_workflow
// role: workflow_editor
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/platform_workflow_v0002.mjs
// input:
//   - registered node catalog and workflow JSON
// output:
//   - explicit graph edits and authenticated API requests
// depends_on:
//   - workflow_graph_v0001
// used_by:
//   - studio_shell_v0022
// ============================================================
import {SCHEMA,clone,uid,normalize,definition,validate,connect,createNode,copySelection,pasteSelection,groupSelection,ungroup,semanticKey,applyProposal} from './workflow_graph_v0001.mjs';
const SCRIPT_NAME='platform_workflow_v0002',SCRIPT_VERSION='v0002',SCRIPT_FAMILY='platform_workflow',DEFAULT_ENCODING='utf8';
const WIDTH=224,PORT_TOP=66,ROW=27;
const empty=()=>({schema_version:SCHEMA,id:uid('flow'),name:'新工作流',goal:'',nodes:[],edges:[],interface:{inputs:[],outputs:[]},viewport:{x:35,y:35,zoom:1}});
let clipboard=null;

export async function open(ctx,id){
 const view=document.createElement('section'),left=document.createElement('div'),right=document.createElement('div'),e=ctx.escape;
 view.className='platform-pane workflow-editor';view.tabIndex=0;left.className=right.className='platform-panel';left.dataset.panelTitle='分类节点库';right.dataset.panelTitle='属性与 AI 分析';
 const installed=ctx.openTab('workflow-editor','能力编排',view,{left,right});if(installed!==view){if(id)installed.dispatchEvent(new CustomEvent('workbench-workflow-load',{detail:id}));return;}
 if(!document.querySelector('link[data-workflow-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./workflow_editor_v0002.css',import.meta.url).href;link.dataset.workflowStyle='true';document.head.append(link);}
 let root=empty(),catalog={items:[],unsupported:[],sources:[],ai:{items:[]}},list=[],revision=0,editRevision=0,savedKey='',path=[],selection=new Set(),selectedEdge=null,wire=null,undo=[],redo=[],run=null,runId=null,pollTimer=null,analysisTimer=null,refreshTimer=null,analysisSession=null,analysisPaused=true,analysis=null,analysisBusy=false,analysisAgain=false,analysisEpoch=0,analysisKey='',panel='properties',previewGraph=null,disposed=false,space=false;
 let analysisError='';
 const abort=new AbortController(),signal=abort.signal;
 const graph=()=>path.reduce((g,id)=>g.nodes.find(n=>n.id===id).subgraph,root);
 const replace=g=>{if(!path.length)root=g;else{const parents=path.slice(0,-1).reduce((v,id)=>v.nodes.find(n=>n.id===id).subgraph,root);parents.nodes.find(n=>n.id===path.at(-1)).subgraph=g;}};
 const def=n=>definition(n,catalog.items);
 const report=()=>validate(graph(),catalog.items);
 const analysisStateKey=()=>JSON.stringify({graph:semanticKey(root),catalog:catalog.revision,execution:run?.workflow_id===root.id?{id:run.id,status:run.status,finished_at:run.finished_at}:null});
 function clearRun(){run=null;runId=null;clearTimeout(pollTimer);view.querySelector('[data-flow-log]').textContent='尚未运行。';view.querySelector('[data-flow-cancel]').disabled=true;}
 const status=text=>view.querySelector('[data-flow-state]').textContent=text;
 const action=fn=>ctx.action(async()=>{try{return await fn();}catch(error){status(error.message);throw error;}});
 const desktop=async(op,input)=>{if(window.desktop?.workflowAction)return window.desktop.workflowAction(op,input);if(op==='run')return ctx.api('workflows/run',input);throw Error('此操作需从桌面工作台发起');};
 view.innerHTML='<div class="platform-toolbar workflow-toolbar"><input data-flow-name aria-label="工作流名称"><select data-flow-saved aria-label="已保存工作流"><option value="">已保存工作流</option></select><button data-flow-new>新建</button><button data-flow-save>保存</button><button data-flow-validate>校验</button><button data-flow-run>▶ 运行</button><button data-flow-cancel disabled>取消</button></div><div class="platform-toolbar workflow-tools"><button data-flow-undo title="Ctrl+Z">撤销</button><button data-flow-redo title="Ctrl+Shift+Z">重做</button><button data-flow-copy>复制</button><button data-flow-paste>粘贴</button><button data-flow-duplicate>重复</button><button data-flow-delete>删除</button><button data-flow-group>封装组合</button><button data-flow-ungroup>解散</button><button data-flow-reset>适应视图</button><button data-flow-zoom-out>−</button><span data-flow-zoom>100%</span><button data-flow-zoom-in>＋</button><button data-flow-chain>规范查询链</button></div><div class="workflow-breadcrumb" data-flow-breadcrumb></div><p class="platform-note" data-flow-state>正在读取能力目录…</p><div class="workflow-area" tabindex="0" aria-label="工作流画布"><div class="workflow-world"><svg class="workflow-svg"><g data-wires></g><path data-wire-preview class="workflow-wire-preview"/></svg><div data-flow-nodes></div></div><div class="workflow-marquee" hidden></div><div class="workflow-help">拖动端口连线 · 空白处框选 · Shift 多选 · 空格 / 中键平移 · 滚轮缩放</div></div><section class="workflow-results"><div class="workflow-logbar"><strong>运行状态与日志</strong><select data-flow-history aria-label="运行历史"><option value="">当前运行</option></select></div><div data-flow-log>尚未运行。保存的工作流可在 AI 不可用时独立执行。</div></section>';
 const area=view.querySelector('.workflow-area'),world=view.querySelector('.workflow-world'),nodesElement=view.querySelector('[data-flow-nodes]'),wires=view.querySelector('[data-wires]'),wirePreview=view.querySelector('[data-wire-preview]');
 right.innerHTML='<div class="workflow-tabs"><button data-flow-panel="properties" aria-pressed="true">节点属性</button><button data-flow-panel="analysis">AI 分析</button></div><div data-flow-properties></div><div data-flow-analysis hidden></div>';
 const properties=right.querySelector('[data-flow-properties]'),ai=right.querySelector('[data-flow-analysis]');
 function viewport(){return graph().viewport||(graph().viewport={x:35,y:35,zoom:1});}
 function position(event){const rect=area.getBoundingClientRect(),v=viewport();return {x:(event.clientX-rect.left-v.x)/v.zoom,y:(event.clientY-rect.top-v.y)/v.zoom};}
 function transform(){const v=viewport();world.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.zoom+')';view.querySelector('[data-flow-zoom]').textContent=Math.round(v.zoom*100)+'%';}
 function history(before){undo.push(before);if(undo.length>70)undo.shift();redo=[];editRevision++;}
 function changed(before,draw=true){if(JSON.stringify(before)===JSON.stringify(root))return;history(before);if(draw)render();scheduleAnalysis();}
 function commit(fn){const before=clone(root);try{const next=fn(graph());if(next)replace(next);changed(before);}catch(error){root=before;status(error.message);}}
 function restore(direction){const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;if(!from.length)return;to.push(clone(root));root=from.pop();path=[];selection.clear();selectedEdge=null;editRevision++;render();scheduleAnalysis();}
 function removeSelected(){commit(g=>{g.nodes=g.nodes.filter(n=>!selection.has(n.id));g.edges=g.edges.filter(ed=>!selection.has(ed.from)&&!selection.has(ed.to)&&ed.id!==selectedEdge);for(const direction of ['inputs','outputs'])g.interface[direction]=g.interface[direction].filter(p=>!selection.has(p.node));selection.clear();selectedEdge=null;});}
 function copy(){clipboard=copySelection(graph(),selection);status('已复制 '+clipboard.nodes.length+' 个节点及内部连线');}
 function paste(){if(!clipboard?.nodes.length)return;commit(g=>{const result=pasteSelection(g,clipboard);selection=new Set(result.ids);return result.graph;});}
 function add(type,x,y){const d=catalog.items.find(d=>d.id===type);if(!d)return;commit(g=>{const p=x===undefined?position({clientX:area.getBoundingClientRect().left+80,clientY:area.getBoundingClientRect().top+70}):{x,y};const n=createNode(d,p.x,p.y);g.nodes.push(n);selection=new Set([n.id]);selectedEdge=null;});}
 function library(){
  const query=left.querySelector('[data-node-search]')?.value||'',folded=new Set([...left.querySelectorAll('details[data-category]')].filter(d=>!d.open).map(d=>d.dataset.category));
  left.innerHTML='<div class="workflow-library-head"><input data-node-search aria-label="搜索能力节点" placeholder="搜索名称、用途或来源" value="'+e(query)+'"><button data-node-refresh title="刷新真实能力">刷新</button></div><div data-node-library></div><div class="workflow-library-details" data-node-details>双击或拖入画布。单击查看能力说明。</div><details><summary>接入状态</summary><div data-node-sources></div><p>'+catalog.unsupported.map(e).join('<br>')+'</p></details>';
  const container=left.querySelector('[data-node-library]');
  function renderTree(){container.replaceChildren();const tree={children:new Map(),items:[]};for(const d of catalog.items){if(![d.name,d.description,d.source,d.category?.join('/')].join(' ').toLowerCase().includes(left.querySelector('input').value.toLowerCase()))continue;let t=tree;for(const part of d.category||[d.source||'已注册能力']){if(!t.children.has(part))t.children.set(part,{children:new Map(),items:[]});t=t.children.get(part);}t.items.push(d);}
   function append(t,parent,prefix=''){for(const [name,branch] of t.children){const details=document.createElement('details'),key=prefix+'/'+name;details.dataset.category=key;details.open=!!left.querySelector('input').value||!folded.has(key);const summary=document.createElement('summary');summary.textContent=name;details.append(summary);append(branch,details,key);parent.append(details);}for(const d of t.items){const b=document.createElement('button');b.className='workflow-library-node';b.dataset.nodeType=d.id;b.draggable=true;b.innerHTML='<strong>'+e(d.name)+'</strong><small>'+e((d.inputs||[]).map(p=>p.type).join(', ')||'无输入')+' → '+e((d.outputs||[]).map(p=>p.type).join(', '))+'</small>';b.title=d.description||d.name;b.onclick=()=>{left.querySelector('[data-node-details]').innerHTML='<strong>'+e(d.name)+'</strong><p>'+e(d.description||'')+'</p><small>来源：'+e(d.source)+'<br>能力 ID：'+e(d.id)+'</small><details><summary>输入输出与参数契约</summary><pre>'+e(JSON.stringify({inputs:d.inputs,outputs:d.outputs,parameters:d.parameter_schema},null,2))+'</pre></details>';};b.ondblclick=()=>add(d.id);b.ondragstart=event=>{event.dataTransfer.setData('application/x-workbench-node',d.id);event.dataTransfer.effectAllowed='copy';};parent.append(b);}}
   append(tree,container);
  }
  left.querySelector('[data-node-search]').oninput=renderTree;left.querySelector('[data-node-refresh]').onclick=()=>action(()=>refresh(true));renderTree();
  for(const source of catalog.sources||[]){const b=document.createElement('button');b.textContent=(source.discovered?'重新发现：':'发现工具：')+source.name;b.onclick=()=>action(async()=>{const result=await desktop('discover',{id:source.id});if(!result.cancelled)await refresh(true);});left.querySelector('[data-node-sources]').append(b);}
 }
 async function refresh(force=false){if(disposed)return;const next=await ctx.api('workflows/nodes'+(force?'?refresh=1':''));const changedCatalog=next.revision!==catalog.revision;catalog=next;if(changedCatalog||force){library();render();renderAnalysis();if(changedCatalog)scheduleAnalysis();}}
 function portPoint(node,port,direction){const index=(def(node)?.[direction]||[]).findIndex(p=>p.id===port);return {x:node.x+(direction==='outputs'?WIDTH:0),y:node.y+PORT_TOP+Math.max(index,0)*ROW};}
 function curve(a,b){const span=Math.max(55,Math.abs(b.x-a.x)*.45);return 'M'+a.x+' '+a.y+' C'+(a.x+span)+' '+a.y+','+(b.x-span)+' '+b.y+','+b.x+' '+b.y;}
 function drawWires(){const g=graph(),map=new Map(g.nodes.map(n=>[n.id,n]));wires.innerHTML=g.edges.map(ed=>{const a=map.get(ed.from),b=map.get(ed.to);if(!a||!b)return '';const d=curve(portPoint(a,ed.fromPort,'outputs'),portPoint(b,ed.toPort,'inputs'));return '<g data-flow-edge="'+e(ed.id)+'" class="'+(selectedEdge===ed.id?'selected':'')+'"><path class="workflow-edge-hit" d="'+d+'"/><path class="workflow-edge-line" d="'+d+'"/></g>';}).join('');
  wires.querySelectorAll('[data-flow-edge]').forEach(el=>el.onpointerdown=event=>{event.stopPropagation();selectedEdge=el.dataset.flowEdge;selection.clear();wire=null;render();});
 }
 function updateGeometry(){for(const n of graph().nodes){const el=nodesElement.querySelector('[data-flow-node="'+CSS.escape(n.id)+'"]');if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';}}drawWires();}
 function drawNodes(){
  const validation=report(),errors=new Set(validation.errors.map(x=>x.node));
  nodesElement.innerHTML=graph().nodes.map(n=>{const d=def(n),inputs=d?.inputs||[],outputs=d?.outputs||[],rows=Math.max(inputs.length,outputs.length,1),step=run?.steps.find(s=>s.key===[...path,n.id].join('/'));
   return '<article class="workflow-node" data-flow-node="'+e(n.id)+'" data-status="'+e(step?.status||'idle')+'" aria-selected="'+selection.has(n.id)+'" style="left:'+n.x+'px;top:'+n.y+'px;width:'+WIDTH+'px"><header><span>'+e(n.label||d?.name||n.type)+'</span><small>'+e(step?.status|| (errors.has(n.id)?'需配置':n.type==='composite'?'组合':'●'))+'</small></header><div class="workflow-node-source">'+e(d?.source||'能力不可用')+'</div><div class="workflow-port-rows">'+Array.from({length:rows},(_,i)=>'<div class="workflow-port-row">'+(inputs[i]?'<button class="workflow-port input" data-port-in="'+e(n.id)+'" data-port="'+e(inputs[i].id)+'" title="'+e(inputs[i].name+' · '+inputs[i].type)+(inputs[i].required?' · 必填':'')+'"><i></i><span>'+e(inputs[i].name||inputs[i].id)+'</span></button>':'<span></span>')+(outputs[i]?'<button class="workflow-port output" data-port-out="'+e(n.id)+'" data-port="'+e(outputs[i].id)+'" title="'+e(outputs[i].name+' · '+outputs[i].type)+'"><span>'+e(outputs[i].name||outputs[i].id)+'</span><i></i></button>':'<span></span>')+'</div>').join('')+'</div>'+(n.note?'<p class="workflow-node-note">'+e(n.note)+'</p>':'')+'</article>';
  }).join('');
  nodesElement.querySelectorAll('[data-flow-node]').forEach(el=>{
   const id=el.dataset.flowNode;
   el.onpointerdown=event=>{if(event.target.closest('.workflow-port'))return;event.stopPropagation();if(event.button!==0)return;
    if(event.shiftKey){if(selection.has(id))selection.delete(id);else selection.add(id);}else if(!selection.has(id))selection=new Set([id]);selectedEdge=null;
    const before=clone(root),start=position(event),origins=new Map(graph().nodes.filter(n=>selection.has(n.id)).map(n=>[n.id,{x:n.x,y:n.y}]));let moved=false;
    nodesElement.querySelectorAll('[data-flow-node]').forEach(item=>item.setAttribute('aria-selected',String(selection.has(item.dataset.flowNode))));drawWires();renderProperties();
    pointerDrag(event,next=>{const p=position(next);if(Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>2)moved=true;for(const n of graph().nodes)if(origins.has(n.id)){n.x=Math.round(origins.get(n.id).x+p.x-start.x);n.y=Math.round(origins.get(n.id).y+p.y-start.y);}updateGeometry();},()=>{if(moved)changed(before);});
   };
   el.ondblclick=event=>{if(event.target.closest('.workflow-port'))return;const n=graph().nodes.find(n=>n.id===id);if(n.subgraph){path.push(id);selection.clear();selectedEdge=null;render();}else{selection=new Set([id]);renderProperties();properties.querySelector('[data-node-label]')?.focus();}};
  });
  nodesElement.querySelectorAll('[data-port-out]').forEach(b=>{
   b.onpointerdown=event=>{event.stopPropagation();event.preventDefault();wire={from:b.dataset.portOut,fromPort:b.dataset.port};const start=position(event);let moved=false;
    pointerDrag(event,next=>{const p=position(next);if(Math.abs(start.x-p.x)+Math.abs(start.y-p.y)>4)moved=true;showWire(p);},next=>{wirePreview.setAttribute('d','');if(!moved){status('选择输入端口完成连接');return;}const target=document.elementFromPoint(next.clientX,next.clientY)?.closest('[data-port-in]');if(target)finishWire(target);else{wire=null;status('连线已取消：请拖到输入端口');}});
   };
  });
  nodesElement.querySelectorAll('[data-port-in]').forEach(b=>b.onpointerdown=event=>{event.stopPropagation();if(wire)finishWire(b);});
 }
 function pointerDrag(event,move,up){const moveHandler=next=>move(next),upHandler=next=>{document.removeEventListener('pointermove',moveHandler);document.removeEventListener('pointerup',upHandler);document.removeEventListener('pointercancel',cancelHandler);up(next);},cancelHandler=()=>{document.removeEventListener('pointermove',moveHandler);document.removeEventListener('pointerup',upHandler);wirePreview.setAttribute('d','');wire=null;};document.addEventListener('pointermove',moveHandler,{signal});document.addEventListener('pointerup',upHandler,{once:true,signal});document.addEventListener('pointercancel',cancelHandler,{once:true,signal});}
 function showWire(p){if(!wire)return;const n=graph().nodes.find(n=>n.id===wire.from);if(n)wirePreview.setAttribute('d',curve(portPoint(n,wire.fromPort,'outputs'),p));}
 function finishWire(target){const pending=wire;wire=null;wirePreview.setAttribute('d','');if(!pending)return;commit(g=>connect(g,{from:pending.from,fromPort:pending.fromPort,to:target.dataset.portIn,toPort:target.dataset.port,id:pending.replaceId||uid('edge')},catalog.items,pending.replaceId));}
 function render(){
  if(disposed)return;view.dataset.featureId=revision?'workflow:'+root.id:'workspace:flow';view.querySelector('[data-flow-name]').value=root.name;
  view.querySelector('[data-flow-undo]').disabled=!undo.length;view.querySelector('[data-flow-redo]').disabled=!redo.length;
  view.querySelector('[data-flow-breadcrumb]').innerHTML='<button data-flow-root>'+e(root.name)+'</button>'+path.map((id,i)=>'<span> / </span><button data-flow-depth="'+i+'">'+e(path.slice(0,i).reduce((g,x)=>g.nodes.find(n=>n.id===x).subgraph,root).nodes.find(n=>n.id===id).label||'组合')+'</button>').join('')+(path.length?'<span>正在编辑当前实例</span>':'<span>v'+revision+' · 编辑 #'+editRevision+'</span>');
  view.querySelector('[data-flow-root]').onclick=()=>{path=[];selection.clear();render();};view.querySelectorAll('[data-flow-depth]').forEach(b=>b.onclick=()=>{path=path.slice(0,Number(b.dataset.flowDepth)+1);selection.clear();render();});
  transform();drawNodes();drawWires();renderProperties();renderAnalysis();
  const v=report(),dirty=JSON.stringify(root)!==savedKey;status(graph().nodes.length+' 节点 · '+graph().edges.length+' 连线 · '+v.errors.length+' 项校验问题'+(dirty?' · 未保存':''));
 }
 function setPanel(value){panel=value;properties.hidden=value!=='properties';ai.hidden=value!=='analysis';right.querySelectorAll('[data-flow-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flowPanel===value)));if(value==='analysis')renderAnalysis();}
 right.querySelectorAll('[data-flow-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.flowPanel));
 function field(label,value,onchange,{schema={},key='',readonly=false}={}){
  const wrapper=document.createElement('label');wrapper.className='workflow-field';const title=document.createElement('span');title.textContent=label;wrapper.append(title);let input;
  if(schema.enum){input=document.createElement('select');schema.enum.forEach(v=>{const o=document.createElement('option');o.value=JSON.stringify(v);o.textContent=String(v);input.append(o);});input.value=JSON.stringify(value);}
  else if(schema.type==='boolean'){input=document.createElement('input');input.type='checkbox';input.checked=value===true;}
  else if(['number','integer'].includes(schema.type)){input=document.createElement('input');input.type='number';input.step=schema.type==='integer'?'1':'any';if(schema.minimum!==undefined)input.min=schema.minimum;if(schema.maximum!==undefined)input.max=schema.maximum;input.value=value??'';}
  else{const json=schema.format==='json'||['object','array'].includes(schema.type)||typeof value==='object'||!schema.type;input=document.createElement(json||schema.format==='textarea'?'textarea':'input');if(input.tagName==='TEXTAREA')input.rows=json?5:3;input.value=value===undefined?'':json?JSON.stringify(value,null,2):String(value);input.dataset.json=String(json);}
  if(key)input.dataset.flowParam=key;input.disabled=readonly;
  input.onchange=()=>{try{const value=schema.enum?JSON.parse(input.value):schema.type==='boolean'?input.checked:['number','integer'].includes(schema.type)?(input.value===''?undefined:Number(input.value)):input.dataset.json==='true'?JSON.parse(input.value):input.value;input.setCustomValidity('');onchange(value);}catch(error){input.setCustomValidity('请输入有效的 JSON');input.reportValidity();status('参数未更新：'+error.message);}};wrapper.append(input);if(schema.description){const small=document.createElement('small');small.textContent=schema.description;wrapper.append(small);}return wrapper;
 }
 function renderProperties(){
  properties.replaceChildren();
  if(selectedEdge){const edge=graph().edges.find(e=>e.id===selectedEdge);if(edge){properties.innerHTML='<h3>连线属性</h3><p>'+e(edge.from)+' / '+e(edge.fromPort)+' → '+e(edge.to)+' / '+e(edge.toPort)+'</p><button data-edge-reconnect>更换连接目标</button><button data-edge-delete>删除连线</button>';properties.querySelector('[data-edge-delete]').onclick=removeSelected;properties.querySelector('[data-edge-reconnect]').onclick=()=>{wire={from:edge.from,fromPort:edge.fromPort,replaceId:edge.id};status('点击新的输入端口；Esc 取消');};return;}}
  const selected=graph().nodes.filter(n=>selection.has(n.id));
  if(selected.length!==1){
   properties.innerHTML='<h3>'+(selected.length?'已选择 '+selected.length+' 个节点':'工作流属性')+'</h3><p>双击节点进入组合。删除画布实例不会删除原始能力。</p>';
   properties.append(field('目标描述',root.goal,value=>commit(()=>{root.goal=value;}),{schema:{type:'string',format:'textarea'}}));
   if(path.length){const g=graph();properties.append(field('组合对外接口 JSON',g.interface,value=>commit(current=>{current.interface=value;}),{schema:{type:'object',format:'json'},key:'interface'}));const p=document.createElement('p');p.textContent='每个接口保留 id、type、node、port；修改后即时检查内部映射。';properties.append(p);}
   showDiagnostics();return;
  }
  const n=selected[0],d=def(n);properties.innerHTML='<h3>'+e(d?.name||n.type)+'</h3><p>'+e(d?.description||'能力尚不可用，保留实例以便恢复')+'</p><small>'+e(d?.source||'')+' · '+e(n.id)+'</small>';
  const label=field('节点名称',n.label||d?.name||n.type,value=>commit(g=>{g.nodes.find(x=>x.id===n.id).label=value;}),{schema:{type:'string'}});label.querySelector('input').dataset.nodeLabel='true';properties.append(label);
  properties.append(field('备注',n.note||'',value=>commit(g=>{g.nodes.find(x=>x.id===n.id).note=value;}),{schema:{type:'string',format:'textarea'}}));
  for(const [key,schema] of Object.entries(d?.parameter_schema?.properties||{})){
   const connected=graph().edges.some(ed=>ed.to===n.id&&ed.toPort===key);properties.append(field((schema.title||key)+((d.parameter_schema.required||[]).includes(key)?' *':'')+(connected?'（由连线提供）':''),n.params[key],value=>commit(g=>{const params=g.nodes.find(x=>x.id===n.id).params;if(value===undefined)delete params[key];else params[key]=value;}),{schema,key,readonly:connected}));
  }
  if(d?.parameter_schema&&!Object.keys(d.parameter_schema.properties||{}).length&&d.parameter_schema.additionalProperties!==false&&n.type!=='composite')properties.append(field('参数 JSON',n.params,value=>commit(g=>{g.nodes.find(x=>x.id===n.id).params=value;}),{schema:{type:'object',format:'json'}}));
  if(n.subgraph){
   const controls=document.createElement('div');controls.innerHTML='<p>来源：'+e(n.definition_ref?.id||'当前工作流')+' · v'+e(n.definition_ref?.version||'未发布')+'</p><button data-group-open>展开编辑当前实例</button><button data-group-save>另存为节点库组合</button>'+(n.definition_ref?.id?.startsWith('component:')?'<button data-group-update>更新原始定义…</button>':'');properties.append(controls);
   controls.querySelector('[data-group-open]').onclick=()=>{path.push(n.id);selection.clear();render();};controls.querySelector('[data-group-save]').onclick=()=>saveComponent(n,false);controls.querySelector('[data-group-update]')?.addEventListener('click',()=>saveComponent(n,true));
  }
  const contract=document.createElement('details');contract.innerHTML='<summary>输入 / 输出契约</summary><pre>'+e(JSON.stringify({inputs:d?.inputs,outputs:d?.outputs,parameters:d?.parameter_schema},null,2))+'</pre>';properties.append(contract);showDiagnostics(n.id);
  if(n.capability_ref&&d?.capability_ref&&JSON.stringify(n.capability_ref)!==JSON.stringify(d.capability_ref)){const button=document.createElement('button');button.textContent='更新此实例的能力版本引用';button.onclick=()=>commit(g=>{g.nodes.find(x=>x.id===n.id).capability_ref=clone(d.capability_ref);});properties.append(button);}
 }
 function showDiagnostics(node){const v=report(),items=[...v.errors,...v.warnings].filter(x=>!node||x.node===node);const block=document.createElement('div');block.className='workflow-diagnostics';block.innerHTML='<h4>本地确定性校验</h4>'+(items.length?items.map(x=>'<p class="'+e(x.severity)+'">'+e(x.message)+'</p>').join(''):'<p>当前结构校验通过</p>');properties.append(block);}
 function saveComponent(n,update){ctx.dialog(update?'更新原始组合定义':'保存可复用组合','<label class="form-field">名称<input name="name" value="'+e(n.label||'组合节点')+'" required></label><p>'+(update?'发布原始定义的新版本。已有画布实例继续使用各自快照。':'创建独立组合定义，其他工作流可从节点库添加。')+'</p>',async fields=>{const result=await ctx.api('workflows/component',{id:update?n.definition_ref.id:'component:'+uid('group'),name:fields.get('name'),graph:n.subgraph,expected_version:update?n.definition_ref.version:0});commit(g=>{g.nodes.find(x=>x.id===n.id).definition_ref={id:result.item.id,version:result.item.version};});await refresh(true);},update?'确认发布新版本':'保存组合');}
 function renderAnalysis(){
  const modelId=ai.querySelector('[data-ai-model]')?.value||catalog.ai.items?.[0]?.id||'';
  const report=validate(root,catalog.items),stale=analysis&&analysisKey!==analysisStateKey();
  ai.innerHTML='<h3>AI 编排分析</h3><label class="workflow-field">当前流程目标<textarea data-ai-goal rows="3">'+e(root.goal)+'</textarea></label><label class="workflow-field">分析模型<select data-ai-model>'+ (catalog.ai.items||[]).map(x=>'<option value="'+e(x.id)+'" '+(x.id===modelId?'selected':'')+'>'+e(x.name)+'</option>').join('')+'</select></label><div class="workflow-ai-actions"><button data-ai-toggle>'+(analysisPaused?'开启实时分析':'暂停 AI 分析')+'</button><button data-ai-refresh>手动分析</button></div><p class="workflow-note">'+(analysisBusy?'分析请求进行中…':analysisPaused?'实时分析已暂停':'结构和关键参数变化后防抖分析；移动节点不调用模型')+'</p><details><summary>编排 AI 应用设置</summary><p>独立身份：'+(catalog.ai.application?.registered?'已登记':'未登记')+' · 应用许可：'+(catalog.ai.application?.allowed?'允许':'未允许')+' · 总许可：'+(catalog.ai.global_enabled?'开启':'关闭')+'</p><button data-ai-provision>登记编排应用</button><button data-ai-allow>允许编排 AI</button><button data-ai-deny>关闭编排 AI</button></details><h4>本地确定性校验 · 编辑 #'+editRevision+'</h4><div class="workflow-diagnostics">'+report.errors.map(x=>'<p class="error">'+e(x.message)+'</p>').join('')+(report.valid?'<p>校验通过</p>':'')+'</div><h4>AI 建议（需人工判断）</h4><div data-ai-result>'+(analysis?'<p class="workflow-note">依据：保存 v'+analysis.workflow_version+' / 编辑 #'+analysis.edit_revision+' · '+e(analysis.basis.slice(0,12))+(stale?' · 已过期，请重新分析':'')+'</p><p>'+e(analysis.proposal.summary)+'</p>'+analysis.proposal.suggestions.map(x=>'<p>• '+e(x)+'</p>').join('')+(analysis.proposal.missing_capabilities.length?'<strong>缺少的能力</strong>'+analysis.proposal.missing_capabilities.map(x=>'<p>'+e(x)+'</p>').join(''):'')+(analysis.proposal_error?'<p class="error">建议不能应用：'+e(analysis.proposal_error)+'</p>':'')+'<button data-ai-preview '+(stale||analysis.proposal_error||!analysis.proposal.changes.length?'disabled':'')+'>预览 '+analysis.proposal.changes.length+' 项变更</button>':'尚未分析。AI 不可用时仍可编辑、校验、保存和运行。')+'</div><div data-ai-proposal></div>';
  if(analysisError){const error=document.createElement('p');error.className='error';error.textContent='AI 分析不可用：'+analysisError+'。基础编排继续可用。';ai.querySelector('[data-ai-result]').prepend(error);}
  ai.querySelector('[data-ai-goal]').onchange=event=>commit(()=>{root.goal=event.target.value;});
  ai.querySelector('[data-ai-toggle]').onclick=()=>action(async()=>{if(!analysisPaused){analysisPaused=true;analysisEpoch++;clearTimeout(analysisTimer);renderAnalysis();return;}await enableAnalysis();});
  ai.querySelector('[data-ai-refresh]').onclick=()=>action(async()=>{if(!analysisSession){await enableAnalysis(false);if(!analysisSession)return;}await analyze();});
  ai.querySelector('[data-ai-model]').onchange=()=>{analysisSession=null;analysisPaused=true;analysisEpoch++;clearTimeout(analysisTimer);status('分析模型已变更；重新开启后使用新模型');};
  for(const [selector,operation,allowed] of [['provision','provision'],['allow','permission',true],['deny','permission',false]])ai.querySelector('[data-ai-'+selector+']').onclick=()=>action(async()=>{const result=await desktop('aiAdmin',{operation,allowed});if(!result.cancelled){if(allowed===false){analysisPaused=true;analysisSession=null;clearTimeout(analysisTimer);}await refresh(true);}});
  ai.querySelector('[data-ai-preview]')?.addEventListener('click',()=>{try{previewGraph=applyProposal(root,analysis.proposal.changes,catalog.items);const area=ai.querySelector('[data-ai-proposal]');area.innerHTML='<h4>拟议变更</h4><pre>'+e(JSON.stringify(analysis.proposal.changes,null,2))+'</pre><p>'+validate(previewGraph,catalog.items).errors.map(x=>e(x.message)).join('<br>')+'</p><button data-ai-apply>确认应用这些变更</button><button data-ai-discard>取消</button>';area.querySelector('[data-ai-discard]').onclick=()=>{previewGraph=null;area.replaceChildren();};area.querySelector('[data-ai-apply]').onclick=()=>{if(analysisKey!==analysisStateKey()){status('建议依据已过期，请重新分析');return;}const before=clone(root);root=applyProposal(root,analysis.proposal.changes,catalog.items);path=[];selection.clear();previewGraph=null;changed(before);};}catch(error){status(error.message);}});
 }
 async function enableAnalysis(automatic=true){const model_id=ai.querySelector('[data-ai-model]').value;const session=await desktop('analysisSession',{model_id});if(session.cancelled)return;analysisSession=session.session;analysisPaused=!automatic;analysisEpoch++;renderAnalysis();if(automatic)await analyze();}
 function scheduleAnalysis(){if(analysis&&analysisKey!==analysisStateKey())renderAnalysis();clearTimeout(analysisTimer);if(!analysisPaused&&analysisSession&&analysisKey!==analysisStateKey())analysisTimer=setTimeout(()=>action(analyze),1200);}
 async function analyze(){
  if(analysisBusy){analysisAgain=true;return;}if(!analysisSession)return;
  const key=analysisStateKey(),snapshot=clone(root),version=editRevision,epoch=analysisEpoch;analysisError='';analysisBusy=true;renderAnalysis();
  try{const result=await ctx.api('workflows/analyze',{session:analysisSession,graph:snapshot,edit_revision:version,run_id:runId});if(disposed||epoch!==analysisEpoch)return;analysis=result;analysisKey=key;if(!result.remaining){analysisPaused=true;analysisSession=null;}}
  catch(error){analysisPaused=true;analysisSession=null;analysisEpoch++;analysisError=error.message;status('AI 分析不可用：'+error.message+'。基础编排继续可用。');throw error;}
  finally{analysisBusy=false;if(!disposed){renderAnalysis();if(!analysisPaused&&(analysisAgain||key!==analysisStateKey())){analysisAgain=false;scheduleAnalysis();}}}
 }
 async function load(id){const result=await ctx.api('workflows/get',{id});root=normalize(result.item);revision=root.version||0;editRevision=0;savedKey=JSON.stringify(root);path=[];selection.clear();undo=[];redo=[];selectedEdge=null;analysis=null;analysisKey='';analysisEpoch++;analysisError='';clearRun();render();scheduleAnalysis();}
 function savedOptions(){const select=view.querySelector('[data-flow-saved]');select.innerHTML='<option value="">已保存工作流</option>'+list.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+' · v'+x.version+'</option>').join('');select.value=list.some(x=>x.id===root.id)?root.id:'';}
 function replaceWith(factory){if(JSON.stringify(root)===savedKey||!root.nodes.length){factory();return;}ctx.dialog('保留当前编辑','<p>当前流程有未保存的修改。可取消并先保存；确认后将打开新画布。</p>',async()=>factory(),'放弃未保存修改');}
 view.querySelector('[data-flow-name]').onchange=event=>commit(()=>{root.name=event.target.value;});
 view.querySelector('[data-flow-save]').onclick=()=>action(async()=>{const result=await ctx.api('workflows/save',{graph:root,expected_version:revision});root=normalize(result.item);revision=root.version;savedKey=JSON.stringify(root);list=(await ctx.api('workflows')).items;savedOptions();await refresh(true);status('已保存 v'+revision+(result.validation.valid?'':'（草稿，运行前请处理校验问题）'));});
 view.querySelector('[data-flow-validate]').onclick=()=>action(async()=>{const result=await ctx.api('workflows/validate',{graph:root});renderProperties();status(result.valid?'图结构、端口及参数校验通过':result.errors.map(x=>x.message).join('；'));});
 view.querySelector('[data-flow-run]').onclick=()=>action(async()=>{if(!revision||JSON.stringify(root)!==savedKey)throw Error('先保存当前工作流再运行');const result=await desktop('run',{id:root.id,version:revision});if(result.cancelled)return;runId=result.run.id;run=result.run;view.querySelector('[data-flow-cancel]').disabled=false;await poll();});
 view.querySelector('[data-flow-cancel]').onclick=()=>action(async()=>{const result=await ctx.api('workflows/cancel',{id:runId});status(result.message);});
 async function poll(){if(disposed||!runId)return;const id=runId,result=await ctx.api('workflows/status',{id});if(id!==runId||disposed)return;run=result.run;drawNodes();drawWires();renderLog();view.querySelector('[data-flow-cancel]').disabled=run.status!=='running';if(run.status==='running'){pollTimer=setTimeout(()=>action(poll),650);}else{status('运行 '+run.status);scheduleAnalysis();}}
 function renderLog(){const log=view.querySelector('[data-flow-log]');log.innerHTML='<p>'+e(run.status)+' · '+e(run.id)+' · v'+run.workflow_version+(run.error?' · '+e(run.error):'')+'</p><div class="workflow-run-steps">'+run.steps.map((step,i)=>'<button data-step="'+i+'" data-status="'+e(step.status)+'">'+e(step.name)+' · '+e(step.status)+'</button>').join('')+'</div><div data-step-detail></div><pre>'+e(JSON.stringify(run.outputs||{},null,2))+'</pre>';log.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>action(async()=>{const step=run.steps[Number(b.dataset.step)],trace=step.trace?await ctx.api('workflows/trace',{id:run.id,trace:step.trace}):step;log.querySelector('[data-step-detail]').innerHTML='<strong>'+e(step.name)+'</strong><pre>'+e(JSON.stringify(trace,null,2))+'</pre>';}));}
 view.querySelector('[data-flow-history]').onchange=event=>action(async()=>{if(!event.target.value)return;runId=event.target.value;clearTimeout(pollTimer);await poll();});
 view.querySelector('[data-flow-new]').onclick=()=>replaceWith(()=>{root=empty();revision=0;savedKey='';path=[];undo=[];redo=[];selection.clear();analysis=null;analysisKey='';analysisEpoch++;analysisError='';editRevision=0;selectedEdge=null;wire=null;clearRun();render();scheduleAnalysis();});
 view.querySelector('[data-flow-saved]').onchange=event=>{const id=event.target.value;if(id)replaceWith(()=>action(()=>load(id)));};
 view.querySelector('[data-flow-chain]').onclick=()=>replaceWith(()=>{root=normalize({schema_version:'workbench.workflow.v1',id:uid('flow'),name:'真实规范查询与筛选',nodes:[{id:'norms',type:'standards',x:20,y:30,params:{scope:'global'}},{id:'filter',type:'filter',x:320,y:90,params:{field:'enforcement',contains:'mandatory'}},{id:'out',type:'output',x:620,y:30,params:{}}],edges:[{from:'norms',to:'filter'},{from:'filter',to:'out'}]});revision=0;savedKey='';path=[];selection.clear();undo=[];redo=[];editRevision=0;selectedEdge=null;wire=null;analysis=null;analysisKey='';analysisEpoch++;analysisError='';clearRun();render();scheduleAnalysis();});
 view.querySelector('[data-flow-undo]').onclick=()=>restore('undo');view.querySelector('[data-flow-redo]').onclick=()=>restore('redo');view.querySelector('[data-flow-copy]').onclick=copy;view.querySelector('[data-flow-paste]').onclick=paste;view.querySelector('[data-flow-duplicate]').onclick=()=>{copy();paste();};view.querySelector('[data-flow-delete]').onclick=removeSelected;
 view.querySelector('[data-flow-group]').onclick=()=>commit(g=>{const result=groupSelection(g,selection,catalog.items);selection=new Set([result.id]);return result.graph;});view.querySelector('[data-flow-ungroup]').onclick=()=>commit(g=>{if(selection.size!==1)throw Error('请选择一个组合节点');const result=ungroup(g,[...selection][0]);selection=new Set(result.ids);return result.graph;});
 function zoom(delta,client){const v=viewport(),point=client||{clientX:area.getBoundingClientRect().left+area.clientWidth/2,clientY:area.getBoundingClientRect().top+area.clientHeight/2},p=position(point),rect=area.getBoundingClientRect();v.zoom=Math.max(.15,Math.min(2.5,v.zoom*delta));v.x=point.clientX-rect.left-p.x*v.zoom;v.y=point.clientY-rect.top-p.y*v.zoom;transform();}
 view.querySelector('[data-flow-zoom-in]').onclick=()=>zoom(1.15);view.querySelector('[data-flow-zoom-out]').onclick=()=>zoom(1/1.15);
 view.querySelector('[data-flow-reset]').onclick=()=>{const nodes=graph().nodes,v=viewport();if(!nodes.length){Object.assign(v,{x:35,y:35,zoom:1});}else{const minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y)),width=Math.max(...nodes.map(n=>n.x+WIDTH))-minX,height=Math.max(...nodes.map(n=>n.y+140))-minY;v.zoom=Math.max(.15,Math.min(1.2,(area.clientWidth-80)/width,(area.clientHeight-70)/height));v.x=(area.clientWidth-width*v.zoom)/2-minX*v.zoom;v.y=(area.clientHeight-height*v.zoom)/2-minY*v.zoom;}transform();};
 area.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.08:1/1.08,event);},{passive:false,signal});area.ondragover=event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';};area.ondrop=event=>{event.preventDefault();const type=event.dataTransfer.getData('application/x-workbench-node'),p=position(event);if(type)add(type,p.x,p.y);};
 area.onpointerdown=event=>{
  if(event.target.closest('.workflow-node,[data-flow-edge]'))return;area.focus();const v=viewport(),start={x:event.clientX,y:event.clientY};
  if(event.button===1||space){event.preventDefault();const initial={...v};pointerDrag(event,next=>{v.x=initial.x+next.clientX-start.x;v.y=initial.y+next.clientY-start.y;transform();},()=>{});return;}
  if(event.button!==0)return;if(wire){wire=null;wirePreview.setAttribute('d','');return;}
  const box=view.querySelector('.workflow-marquee'),rect=area.getBoundingClientRect(),base=event.shiftKey?new Set(selection):new Set();selectedEdge=null;selection=base;box.hidden=false;
  pointerDrag(event,next=>{const x=Math.min(start.x,next.clientX)-rect.left,y=Math.min(start.y,next.clientY)-rect.top,width=Math.abs(next.clientX-start.x),height=Math.abs(next.clientY-start.y);Object.assign(box.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});selection=new Set(base);for(const n of graph().nodes){const nx=n.x*v.zoom+v.x,ny=n.y*v.zoom+v.y;if(nx+WIDTH*v.zoom>=x&&nx<=x+width&&ny+110*v.zoom>=y&&ny<=y+height)selection.add(n.id);}nodesElement.querySelectorAll('[data-flow-node]').forEach(el=>el.setAttribute('aria-selected',String(selection.has(el.dataset.flowNode))));},()=>{box.hidden=true;render();});
 };
 document.addEventListener('keydown',event=>{if(disposed||!view.isConnected||view.getClientRects().length===0)return;if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;if(key===' '){space=true;event.preventDefault();}else if(key==='escape'){wire=null;wirePreview.setAttribute('d','');selectedEdge=null;render();}else if(ctrl&&key==='z'){event.preventDefault();restore(event.shiftKey?'redo':'undo');}else if(ctrl&&key==='y'){event.preventDefault();restore('redo');}else if(ctrl&&key==='a'){event.preventDefault();selection=new Set(graph().nodes.map(n=>n.id));render();}else if(ctrl&&key==='c'){event.preventDefault();copy();}else if(ctrl&&key==='v'){event.preventDefault();paste();}else if(ctrl&&key==='d'){event.preventDefault();copy();paste();}else if(['delete','backspace'].includes(key)){event.preventDefault();removeSelected();}},{signal});
 document.addEventListener('keyup',event=>{if(event.key===' ')space=false;},{signal});window.addEventListener('blur',()=>space=false,{signal});
 view.addEventListener('workbench-workflow-load',event=>replaceWith(()=>action(()=>load(event.detail))),{signal});
 const observer=new MutationObserver(()=>{if(view.isConnected)return;disposed=true;abort.abort();clearTimeout(pollTimer);clearTimeout(analysisTimer);clearInterval(refreshTimer);analysisEpoch++;observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
 const values=await Promise.all([ctx.api('workflows/nodes'),ctx.api('workflows')]);catalog=values[0];list=values[1].items;library();savedOptions();if(id)await load(id);else{savedKey=JSON.stringify(root);render();}
 const historySelect=view.querySelector('[data-flow-history]');for(const item of values[1].runs){const option=document.createElement('option');option.value=item.id;option.textContent=item.workflow_id+' · '+item.status+' · '+item.started_at;historySelect.append(option);}
 refreshTimer=setInterval(()=>{if(view.getClientRects().length&&!analysisBusy)void refresh().catch(error=>status('节点目录刷新失败：'+error.message));},10000);
}
