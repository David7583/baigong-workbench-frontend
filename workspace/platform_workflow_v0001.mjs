// ============================================================
// 文件名: platform_workflow_v0001.mjs
// 中文名: 通用节点画布与真实执行日志
// 版本号: v0001
// 主层级: action
// 层级: workbench / platform
// 脚本定位: workflow_editor
// 职责说明:
// - 通用节点画布与真实执行日志
// 本脚本做什么:
// - 复用现有契约与受管理接口，记录真实状态
// 本脚本不做什么:
// - 不改写业务事实，不自动授权、批准或调用模型
// 制度边界声明:
// - 仅管理工作台配置与派生展示，可回退
// 可更新: True
// ============================================================
// ALIAS_META
// alias: platform_workflow_v0001
// family: platform_workflow
// role: workflow_editor
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/platform_workflow_v0001.mjs
// input:
//   - explicit versioned requests and existing metadata
// output:
//   - factual results and structured errors
// depends_on:
//   - existing workbench APIs and standard library
// used_by:
//   - workbench_platform
// ============================================================
const SCRIPT_NAME='platform_workflow_v0001',SCRIPT_VERSION='v0001',SCRIPT_FAMILY='platform_workflow',DEFAULT_ENCODING='utf8';

export async function open(ctx,id){
 const e=ctx.escape,[catalog,list]=await Promise.all([ctx.api('workflows/nodes'),ctx.api('workflows')]),view=document.createElement('section'),left=document.createElement('div'),right=document.createElement('div');view.className='platform-pane';left.className=right.className='platform-panel';left.dataset.panelTitle='节点库';right.dataset.panelTitle='节点属性';const installed=ctx.openTab('workflow-editor','能力编排',view,{left,right});if(installed!==view){if(id)installed.dispatchEvent(new CustomEvent('workbench-workflow-load',{detail:id}));return;}
 view.addEventListener('workbench-workflow-load',event=>ctx.action(async()=>{graph=(await ctx.api('workflows/get',{id:event.detail})).item;revision=graph.version;properties(null);draw();}));
 let graph=id?(await ctx.api('workflows/get',{id})).item:{schema_version:'workbench.workflow.v1',id:'flow-'+crypto.randomUUID(),name:'新工作流',nodes:[],edges:[]},selected=null,wire=null,runId=null,timer=null,zoom=1,revision=graph.version||0;
 view.innerHTML='<style>.workflow-area{min-height:180px;flex:1;overflow:auto;background:var(--surface);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:20px 20px}.workflow-world{position:relative;width:1800px;height:1100px;transform-origin:0 0}.workflow-svg{position:absolute;inset:0;width:1800px;height:1100px;pointer-events:none}.workflow-svg path{fill:none;stroke:var(--sage);stroke-width:2}.workflow-node{position:absolute;width:180px;padding:8px;border:1px solid var(--sage);border-radius:4px;background:var(--surface);box-shadow:0 2px 3px #0001;font-size:12px}.workflow-node[aria-selected=true]{outline:2px solid var(--sage)}.workflow-node header{font-weight:600;cursor:grab;margin-bottom:8px}.workflow-ports{display:flex;justify-content:space-between;font-size:11px}.workflow-port{border:1px solid var(--line);border-radius:3px;padding:3px!important;min-height:20px}.workflow-results{height:180px;min-height:80px;overflow:auto;border-top:1px solid var(--line);padding:8px}.workflow-results pre{font:11px/1.5 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.workflow-selected-status{color:var(--muted);font-size:11px}</style><div class="platform-toolbar"><input data-flow-name aria-label="工作流名称"><select data-flow-saved><option value="">已保存工作流</option>'+list.items.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+' · v'+x.version+'</option>').join('')+'</select><button data-flow-new>新建</button><button data-flow-chain>规范查询链</button><button data-flow-save>保存</button><button data-flow-validate>校验</button><button data-flow-run>运行</button><button data-flow-cancel disabled>取消后续节点</button><button data-flow-zoom-out>−</button><span data-flow-zoom>100%</span><button data-flow-zoom-in>＋</button></div><p class="platform-note" data-flow-state>从节点库添加节点；点击输出端口，再点击输入端口连线。</p><div class="workflow-area"><div class="workflow-world"></div></div><div class="workflow-results"><strong>执行日志与真实输出</strong><div data-flow-log>尚未运行</div></div>';
 const world=view.querySelector('.workflow-world'),name=view.querySelector('[data-flow-name]'),state=view.querySelector('[data-flow-state]');
 left.innerHTML='<input data-node-search aria-label="搜索能力节点" placeholder="搜索节点"><div data-node-library>'+catalog.items.map(x=>'<button data-node-type="'+e(x.id)+'">'+e(x.name)+'</button>').join('')+'</div><h3>未适配能力</h3><p>'+catalog.unsupported.map(e).join('<br>')+'</p><p>节点库只展示已注册输入输出契约；不自动执行任意脚本。</p>';
 left.querySelector('input').oninput=event=>left.querySelectorAll('[data-node-type]').forEach(b=>b.hidden=!b.textContent.includes(event.target.value));
 left.querySelectorAll('[data-node-type]').forEach(button=>button.onclick=()=>{const def=catalog.items.find(x=>x.id===button.dataset.nodeType);graph.nodes.push({id:'n'+crypto.randomUUID().replaceAll('-','').slice(0,8),type:def.id,x:30+(graph.nodes.length%4)*230,y:30+Math.floor(graph.nodes.length/4)*140,params:structuredClone(def.params)});draw();});
 function properties(node){selected=node?.id;draw(false);if(!node){right.innerHTML='<p>选择节点设置参数。</p>';return;}const def=catalog.items.find(x=>x.id===node.type);right.innerHTML='<h3>'+e(def.name)+'</h3><p>ID：'+e(node.id)+'</p><p>输入 '+e(def.input||'无')+' → 输出 '+e(def.output)+'</p>'+Object.entries(node.params).map(([key,value])=>'<label>'+e(key)+'<textarea data-flow-param="'+e(key)+'">'+e(value)+'</textarea></label>').join('')+'<button data-flow-delete>删除节点及关联连线</button><button data-flow-unwire>清除该节点连线</button>';right.querySelectorAll('[data-flow-param]').forEach(input=>input.oninput=()=>node.params[input.dataset.flowParam]=input.value);right.querySelector('[data-flow-delete]').onclick=()=>{graph.nodes=graph.nodes.filter(x=>x.id!==node.id);graph.edges=graph.edges.filter(x=>x.from!==node.id&&x.to!==node.id);properties(null);draw();};right.querySelector('[data-flow-unwire]').onclick=()=>{graph.edges=graph.edges.filter(x=>x.from!==node.id&&x.to!==node.id);draw();};}
 function draw(clear=true){view.dataset.featureId=revision?'workflow:'+graph.id:'workspace:flow';name.value=graph.name;const point=(id,out)=>{const n=graph.nodes.find(x=>x.id===id);return [n.x+(out?180:0),n.y+65];};world.innerHTML='<svg class="workflow-svg">'+graph.edges.map(edge=>{const [a,b]=point(edge.from,true),[c,d]=point(edge.to,false);return '<path d="M'+a+' '+b+' C'+(a+70)+' '+b+','+(c-70)+' '+d+','+c+' '+d+'"/>';}).join('')+'</svg>'+graph.nodes.map(n=>{const def=catalog.items.find(x=>x.id===n.type);return '<article class="workflow-node" data-flow-node="'+e(n.id)+'" aria-selected="'+(n.id===selected)+'" style="left:'+n.x+'px;top:'+n.y+'px"><header>'+e(def.name)+'</header><small>'+e(n.id)+'</small><div class="workflow-ports">'+(def.input?'<button class="workflow-port" data-port-in="'+e(n.id)+'">● '+e(def.input)+'</button>':'<span></span>')+'<button class="workflow-port" data-port-out="'+e(n.id)+'">'+e(def.output)+' ●</button></div></article>';}).join('');
 world.querySelectorAll('[data-flow-node]').forEach(element=>{const node=graph.nodes.find(x=>x.id===element.dataset.flowNode);element.onclick=event=>{if(!event.target.closest('[data-port-in],[data-port-out]'))properties(node);};element.querySelector('header').onpointerdown=event=>{event.preventDefault();const start={x:event.clientX,y:event.clientY,nx:node.x,ny:node.y};const move=next=>{node.x=Math.max(0,Math.min(1600,start.nx+(next.clientX-start.x)/zoom));node.y=Math.max(0,Math.min(950,start.ny+(next.clientY-start.y)/zoom));draw(false);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',()=>document.removeEventListener('pointermove',move),{once:true});};});
 world.querySelectorAll('[data-port-out]').forEach(b=>b.onclick=event=>{event.stopPropagation();wire=b.dataset.portOut;state.textContent='选择输入端口，来源 '+wire;});world.querySelectorAll('[data-port-in]').forEach(b=>b.onclick=event=>{event.stopPropagation();if(!wire)return;const to=b.dataset.portIn;if(wire===to){wire=null;return;}graph.edges=graph.edges.filter(x=>x.to!==to);graph.edges.push({from:wire,to});wire=null;draw();state.textContent='已连线；运行前由后端校验类型、输入数量及循环。';});if(clear)state.textContent=graph.nodes.length+' 节点 · '+graph.edges.length+' 连线 · v'+revision;
 }
 name.oninput=()=>graph.name=name.value;
 const execute=fn=>ctx.action(async()=>{state.textContent='正在处理…';try{return await fn();}catch(error){state.textContent=error.message;throw error;}});
 view.querySelector('[data-flow-save]').onclick=()=>execute(async()=>{const result=await ctx.api('workflows/save',{graph,expected_version:revision});graph=result.item;revision=graph.version;view.dataset.featureId='workflow:'+graph.id;const savedSelect=view.querySelector('[data-flow-saved]');let option=[...savedSelect.options].find(x=>x.value===graph.id);if(!option){option=document.createElement('option');option.value=graph.id;savedSelect.append(option);}option.textContent=graph.name+' · v'+revision;savedSelect.value=graph.id;state.textContent='已保存 v'+revision+'，已登记为可复用工作流资源';});
 view.querySelector('[data-flow-validate]').onclick=()=>execute(async()=>{await ctx.api('workflows/validate',{graph});state.textContent='图结构、端口类型和执行依赖校验通过';});
 view.querySelector('[data-flow-run]').onclick=()=>execute(async()=>{if(!revision)throw Error('先保存经过校验的工作流');const fresh=await ctx.api('workflows/get',{id:graph.id});if(JSON.stringify(fresh.item)!==JSON.stringify(graph))throw Error('当前画布有未保存修改，请先保存');const result=await ctx.api('workflows/run',{id:graph.id,version:revision});runId=result.run.id;view.querySelector('[data-flow-cancel]').disabled=false;await poll();});
 async function poll(){if(!view.isConnected||!runId)return;const {run}=await ctx.api('workflows/status',{id:runId});view.querySelector('[data-flow-log]').innerHTML='<p>'+e(run.status)+' · '+e(run.id)+'</p><table class="platform-table">'+run.steps.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.status)+(x.cached?' · 缓存':'')+'</td><td>'+e(x.error||x.output_hash?.slice(0,12)||'')+'</td></tr>').join('')+'</table><pre>'+e(JSON.stringify(run.outputs||run.error||{},null,2))+'</pre>';if(run.status==='running')timer=setTimeout(()=>ctx.action(poll),600);else{state.textContent='运行 '+run.status;view.querySelector('[data-flow-cancel]').disabled=true;}}
 view.querySelector('[data-flow-cancel]').onclick=()=>execute(async()=>{const result=await ctx.api('workflows/cancel',{id:runId});state.textContent=result.message;});
 view.querySelector('[data-flow-new]').onclick=()=>{graph={schema_version:'workbench.workflow.v1',id:'flow-'+crypto.randomUUID(),name:'新工作流',nodes:[],edges:[]};revision=0;properties(null);draw();};
 view.querySelector('[data-flow-chain]').onclick=()=>{graph={schema_version:'workbench.workflow.v1',id:'flow-'+crypto.randomUUID(),name:'真实规范查询与筛选',nodes:[{id:'norms',type:'standards',x:30,y:40,params:{scope:'global'}},{id:'filter',type:'filter',x:270,y:100,params:{field:'enforcement',contains:'mandatory'}},{id:'out',type:'output',x:510,y:40,params:{}}],edges:[{from:'norms',to:'filter'},{from:'filter',to:'out'}]};revision=0;properties(null);draw();state.textContent='查询当前真实规范，不写入演示规范或任务';};
 view.querySelector('[data-flow-saved]').onchange=event=>execute(async()=>{if(!event.target.value)return;graph=(await ctx.api('workflows/get',{id:event.target.value})).item;revision=graph.version;properties(null);draw();});
 const scale=delta=>{zoom=Math.max(.5,Math.min(1.5,zoom+delta));world.style.transform='scale('+zoom+')';view.querySelector('[data-flow-zoom]').textContent=Math.round(zoom*100)+'%';};view.querySelector('[data-flow-zoom-in]').onclick=()=>scale(.1);view.querySelector('[data-flow-zoom-out]').onclick=()=>scale(-.1);draw();properties(null);
 window.addEventListener('beforeunload',()=>clearTimeout(timer),{once:true});
}
