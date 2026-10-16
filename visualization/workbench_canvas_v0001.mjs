// ============================================================
// 文件名: workbench_canvas_v0001.mjs
// 中文名: 语义缩放数据视图与渲染生命周期
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / visualization
// 脚本定位: 语义缩放数据视图与渲染生命周期
//
// 职责说明:
// - 语义缩放数据视图与渲染生命周期
//
// 本脚本做什么:
// - 绘制后端投影，处理相机和选择，并暂停或释放渲染资源
//
// 本脚本不做什么:
// - 不替代独立业务资源，不自动授权或调用模型
//
// 制度边界声明:
// - 仅工作台配置和索引可写；测试写入独立临时目录，原始业务数据只读
// - 失败保留分类诊断，不返回伪成功；依赖由项目局部安装
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: workbench_canvas_v0001
// family: workbench_canvas
// role: workbench_component
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/visualization/workbench_canvas_v0001.mjs
// input:
//   - bounded projection, camera and pointer or keyboard events
// output:
//   - Canvas view, selection callback and renderer diagnostics
// depends_on: []
// used_by:
//   - workbench_workspace_v0001
// ============================================================

const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_canvas';
const SCRIPT_NAME = 'workbench_canvas_v0001';
const SCRIPT_VERSION = 'v0001';

// ============================================================
// Canvas 投影渲染器：数据聚类与事实在后端完成
// ============================================================
export class CanvasView {
  constructor(container,api,resource,onSelect,camera={},onCamera=()=>{}) {
    this.container=container;this.api=api;this.resource=resource;this.onSelect=onSelect;this.onCamera=onCamera;
    this.camera={x:0,y:0,zoom:0.25,...camera};this.phase='mounted';this.controller=null;this.frame=null;this.timer=null;this.drawCount=0;
    this.nodes=[];this.edges=[];this.filter=camera?.filter || '';this.disposed=false;this.fitted=Boolean(camera?.zoom);this.loading=false;
    container.innerHTML='<div class="graph-tools"><button data-camera="out">−</button><button data-camera="in">＋</button><button data-camera="global">全局</button><button data-camera="focus">聚焦选择</button><input aria-label="搜索图对象" placeholder="搜索对象…" class="graph-search"><span class="graph-meta">等待投影</span></div><canvas tabindex="0" aria-label="数据投影视图：方向键平移，加减缩放"></canvas><p class="graph-help">滚轮缩放 · 拖动平移 · 点击查看来源 · 聚类双击展开</p>';
    this.canvas=container.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.selected=null;this.handlers=[];
    const on=(target,event,handler)=>{target.addEventListener(event,handler);this.handlers.push(()=>target.removeEventListener(event,handler));};
    on(this.canvas,'wheel',event=>{event.preventDefault();this.camera.zoom*=event.deltaY<0?1.25:0.8;this.changed();});
    let drag=null,moved=false;
    on(this.canvas,'pointerdown',event=>{drag={x:event.clientX,y:event.clientY};moved=false;this.canvas.setPointerCapture(event.pointerId);});
    on(this.canvas,'pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;this.camera.x-=dx/this.camera.zoom;this.camera.y-=dy/this.camera.zoom;drag={x:event.clientX,y:event.clientY};moved=true;this.draw();});
    on(this.canvas,'pointerup',()=>{drag=null;if(moved)this.changed();});
    on(this.canvas,'click',event=>{if(moved)return;const node=this.hit(event);if(node){this.select(node);}});
    on(this.canvas,'dblclick',event=>{const node=this.hit(event);if(node?.kind==='cluster'){this.camera.x=node.x;this.camera.y=node.y;this.camera.zoom*=2;this.changed();}});
    on(this.canvas,'keydown',event=>{
      if(event.key==='Enter'&&this.nodes.length){event.preventDefault();this.select(this.nodes[(this.nodes.findIndex(n=>n.id===this.selected?.id)+1)%this.nodes.length]);return;}
      const amount=100/this.camera.zoom;
      if(event.key==='ArrowLeft')this.camera.x-=amount;else if(event.key==='ArrowRight')this.camera.x+=amount;
      else if(event.key==='ArrowUp')this.camera.y-=amount;else if(event.key==='ArrowDown')this.camera.y+=amount;
      else if(event.key==='+')this.camera.zoom*=1.5;else if(event.key==='-')this.camera.zoom/=1.5;else return;
      event.preventDefault();this.changed();
    });
    for(const button of container.querySelectorAll('[data-camera]'))on(button,'click',()=>{
      if(button.dataset.camera==='global'){this.filter='';container.querySelector('input').value='';this.fit(this.result?.extent);}
      if(button.dataset.camera==='focus'&&this.selected)this.camera={x:this.selected.x,y:this.selected.y,zoom:Math.max(2,this.camera.zoom)};
      if(button.dataset.camera==='in')this.camera.zoom*=2;
      if(button.dataset.camera==='out')this.camera.zoom/=2;
      this.changed();
    });
    container.querySelector('input').value=this.filter;
    on(container.querySelector('input'),'input',event=>{this.filter=event.target.value;this.searchGlobal=true;this.refresh();});
    this.tooltip=document.createElement('div');this.tooltip.className='graph-tooltip';this.tooltip.hidden=true;container.appendChild(this.tooltip);
    on(this.canvas,'pointermove',event=>{if(drag)return;const hit=this.hit(event);this.tooltip.hidden=!hit;if(hit){this.tooltip.textContent=hit.label;this.tooltip.style.left=(event.offsetX+14)+'px';this.tooltip.style.top=(event.offsetY+60)+'px';}});
    on(this.canvas,'pointerleave',()=>{this.tooltip.hidden=true;});
    this.observer=new ResizeObserver(()=>{this.draw();this.refresh();});this.observer.observe(this.canvas);
    on(this.canvas,'contextlost',()=>this.fail('Renderer unavailable'));
    this.activate();
  }
  hit(event){
    const rect=this.canvas.getBoundingClientRect(),x=(event.clientX-rect.left-rect.width/2)/this.camera.zoom+this.camera.x,y=(event.clientY-rect.top-rect.height/2)/this.camera.zoom+this.camera.y;
    return this.nodes.find(n=>Math.hypot(n.x-x,n.y-y)<18/this.camera.zoom);
  }
  fit(bounds){if(!bounds||bounds.x0===null)return;const rect=this.canvas.getBoundingClientRect();this.camera={x:(bounds.x0+bounds.x1)/2,y:(bounds.y0+bounds.y1)/2,zoom:Math.min(2,Math.max(.01,Math.min((rect.width-60)/Math.max(50,bounds.x1-bounds.x0),(rect.height-60)/Math.max(50,bounds.y1-bounds.y0))))};}
  select(node){this.selected=node;this.onSelect(node);this.onCamera({...this.camera,filter:this.filter,selected_id:node.id});this.draw();this.refresh();}
  changed(){this.camera.zoom=Math.min(20,Math.max(.01,this.camera.zoom));this.onCamera({...this.camera,filter:this.filter,selected_id:this.selected?.id});this.draw();this.refresh();}
  refresh(){
    clearTimeout(this.timer);
    if(this.phase!=='active')return;
    this.timer=setTimeout(()=>this.load(),80);
  }
  async load(){
    this.controller?.abort();this.controller=new AbortController();
    const rect=this.canvas.getBoundingClientRect(),z=this.camera.zoom;
    const bounds={x0:this.camera.x-rect.width/2/z,y0:this.camera.y-rect.height/2/z,x1:this.camera.x+rect.width/2/z,y1:this.camera.y+rect.height/2/z};
    try{
      this.loading=true;this.container.querySelector('.graph-meta').textContent='正在读取投影与建立派生索引…';
      const result=await this.api.call('views/'+encodeURIComponent(this.resource.views.find(v=>v.view_type==='graph')?.view_id || this.resource.views[0].view_id)+'/projection',
        {zoom:this.searchGlobal ? 0.12 : z,...((!this.fitted||this.searchGlobal)?{}:{bounds}),filter:this.filter,selection:this.selected?.id},this.controller.signal);
      if(this.disposed||this.phase!=='active')return;
      this.nodes=result.nodes;this.edges=result.edges;this.result=result;
      if(!this.fitted){this.fit(result.extent);this.fitted=true;this.changed();}
      if(this.searchGlobal&&result.nodes.length){const xs=result.nodes.map(n=>n.x),ys=result.nodes.map(n=>n.y);this.fit({x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)});this.searchGlobal=false;this.changed();}
      this.container.querySelector('.graph-help').textContent=(result.layout==='ordered-record-grid'?'记录按原始键排序 · 空间聚合不表示语义主题 · 无推断关系':'源坐标投影')+' · 拖动平移 · 点击查原记录 · 双击展开聚合';
      this.container.querySelector('.graph-meta').textContent='LOD '+result.lod+' · '+result.source_count.toLocaleString()+' 源对象 · '+result.nodes.length+' 显示 · '+result.edges.length+' 边';
      this.draw();
    }catch(error){if(error.name!=='AbortError')this.fail(error.message);}finally{this.loading=false;}
  }
  draw(){
    if(this.phase!=='active'||this.disposed||this.frame)return;
    this.frame=requestAnimationFrame(()=>{
      this.frame=null;if(this.disposed||this.phase!=='active')return;
      try{
      const rect=this.canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
      this.canvas.width=Math.max(1,rect.width*dpr);this.canvas.height=Math.max(1,rect.height*dpr);
      const c=this.ctx;if(!c)return this.fail('Canvas unavailable');
      const style=getComputedStyle(document.body);c.scale(dpr,dpr);c.fillStyle=style.getPropertyValue('--canvas-bg').trim() || '#0d1521';c.fillRect(0,0,rect.width,rect.height);
      const point=n=>({x:(n.x-this.camera.x)*this.camera.zoom+rect.width/2,y:(n.y-this.camera.y)*this.camera.zoom+rect.height/2});
      const map=new Map(this.nodes.map(n=>[n.id,n]));
      c.strokeStyle=style.getPropertyValue('--line').trim();
      for(const edge of this.edges){const a=map.get(edge.source),b=map.get(edge.target);if(!a||!b)continue;const p=point(a),q=point(b);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}
      for(const n of this.nodes){
        const p=point(n),cluster=n.kind==='cluster';c.beginPath();c.fillStyle=style.getPropertyValue(this.selected?.id===n.id?'--selected':cluster?'--cluster':'--node').trim() || '#83bedf';c.arc(p.x,p.y,cluster?Math.min(16,6+Math.log2(n.count||1)):4,0,Math.PI*2);c.fill();
        if(cluster){c.fillStyle='#071619';c.font='10px sans-serif';c.textAlign='center';c.fillText(String(n.count),p.x,p.y+3);c.textAlign='left';}
        else if(this.selected?.id===n.id||this.nodes.length<40){c.fillStyle=style.getPropertyValue('--text').trim();c.font='11px sans-serif';c.fillText(n.label.slice(0,35),p.x+9,p.y+4);}
      }
      this.drawCount++;
      this.canvas.dataset.drawCount=String(this.drawCount);this.canvas.dataset.lifecycle=this.phase;
      }catch(error){this.fail('Renderer: '+error.message);}
    });
  }
  fail(message){if(!this.disposed){this.container.querySelector('.graph-meta').textContent='投影错误：'+message+'（可缩放重试）';if(this.lastError!==message){this.lastError=message;this.api.call('diagnostics',{code:'PROJECTION_ERROR',message}).catch(()=>{});}}}
  activate(){this.phase='active';this.refresh();this.draw();}
  suspend(){this.phase='suspended';clearTimeout(this.timer);this.controller?.abort();if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.canvas.dataset.lifecycle=this.phase;}
  dispose(){this.suspend();this.phase='disposed';this.disposed=true;this.observer.disconnect();this.handlers.forEach(x=>x());this.nodes=[];this.edges=[];this.canvas.width=1;this.canvas.height=1;this.canvas.dataset.lifecycle='disposed';}
}
