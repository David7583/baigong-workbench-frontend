// ============================================================
// 文件名: workbench_layout_v0001.mjs
// 中文名: 可缩放折叠布局与视口安全恢复
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 可缩放折叠布局与视口安全恢复
//
// 职责说明:
// - 可缩放折叠布局与视口安全恢复
//
// 本脚本做什么:
// - 约束面板尺寸并处理拖拽、折叠、专注模式和布局恢复
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
// alias: workbench_layout_v0001
// family: workbench_layout
// role: workbench_component
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/workbench_layout_v0001.mjs
// input:
//   - validated layout preferences and viewport interactions
// output:
//   - clamped panel layout and change callback
// depends_on: []
// used_by:
//   - workbench_workspace_v0001
// ============================================================

const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_layout';
const SCRIPT_NAME = 'workbench_layout_v0001';
const SCRIPT_VERSION = 'v0001';

// ============================================================
// 布局投影：持久状态经后端校验，本地约束适配窗口
// ============================================================
export class Layout {
  constructor(element,onChange) {
    this.element=element;this.onChange=onChange;this.value={};this.listeners=[];
    for(const handle of document.querySelectorAll('[data-resize]')){
      const start=event=>{
        event.preventDefault();handle.setPointerCapture(event.pointerId);
        const move=e=>{
          const name=handle.dataset.resize,rect=this.element.getBoundingClientRect();
          if(name==='left')this.value.left_width=e.clientX-rect.left;
          if(name==='right')this.value.right_width=rect.right-e.clientX;
          if(name==='bottom')this.value.bottom_height=rect.bottom-e.clientY-28;
          this.apply(this.value);
        };
        const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);this.onChange();};
        handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);
      };
      handle.addEventListener('pointerdown',start);this.listeners.push(()=>handle.removeEventListener('pointerdown',start));
      handle.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const key=handle.dataset.resize+'_width';
        if(handle.dataset.resize==='bottom')this.value.bottom_height+=(event.key==='ArrowUp'?10:-10);
        else this.value[key]+=(event.key==='ArrowRight'?10:-10)*(handle.dataset.resize==='right'?-1:1);
        this.apply(this.value);this.onChange();
      });
    }
    this.resize=()=>this.apply(this.value);window.addEventListener('resize',this.resize);
  }
  apply(value){
    this.value={left_width:250,right_width:300,bottom_height:190,...value};
    const width=window.innerWidth;
    this.value.left_width=Math.max(180,Math.min(Number(this.value.left_width)||250,Math.max(180,width*.3)));
    this.value.right_width=Math.max(200,Math.min(Number(this.value.right_width)||300,Math.max(200,width*.3)));
    this.value.bottom_height=Math.max(100,Math.min(Number(this.value.bottom_height)||190,window.innerHeight*.45));
    for(const side of ['left','right'])this.element.style.setProperty('--'+side,this.value[side+'_collapsed']||this.value.focus_mode?'0px':this.value[side+'_width']+'px');
    this.element.style.setProperty('--bottom',this.value.bottom_collapsed||this.value.focus_mode?'0px':this.value.bottom_height+'px');
    for(const side of ['left','right','bottom'])this.element.classList.toggle(side+'-hidden',Boolean(this.value[side+'_collapsed']||this.value.focus_mode));
    document.body.dataset.theme=this.value.theme || 'dark';
    document.body.classList.toggle('reduced-motion',Boolean(this.value.reduced_motion));
    document.querySelector('#toolbar').hidden=Boolean(this.value.toolbar_collapsed);
  }
  toggle(name){this.value[name]=!this.value[name];this.apply(this.value);this.onChange();}
  dispose(){this.listeners.forEach(x=>x());window.removeEventListener('resize',this.resize);}
}
