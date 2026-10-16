// ============================================================
// 文件名: desktop_workspace_v0001.mjs
// 中文名: 工具感知的桌面面板布局
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace / panels
// 脚本定位: 保存各工作区的展示偏好并控制面板组
// 职责说明:
// - 提供折叠、标签组、左右停靠和工作区切换
// 本脚本做什么:
// - 复用既有宽度调整与布局服务，保存纯显示偏好
// 本脚本不做什么:
// - 不停止后台任务，不修改工具和会话业务数据
// 制度边界声明:
// - 偏好损坏时恢复默认布局，不执行资源
// 可更新: True
// ============================================================
// ALIAS_META
// alias: desktop_workspace_v0001
// family: desktop_workspace
// role: contextual_dock_layout
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/desktop_workspace_v0001.mjs
// input:
//   - active workspace ID and existing layout callbacks
// output:
//   - presentation-only contextual panel state
// depends_on:
//   - Browser DOM and existing studio layout
// used_by:
//   - studio_shell_v0013
// ============================================================
const SCRIPT_NAME='desktop_workspace_v0001',SCRIPT_FAMILY='desktop_workspace',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
const KEY='workbench.desktop.profiles.v1';
const safe=value=>{const out={};for(const side of ['left','right','bottom']){if(typeof value?.[side]==='number'&&Number.isFinite(value[side]))out[side]=Math.max(side==='bottom'?80:160,Math.min(side==='bottom'?400:520,value[side]));for(const suffix of ['_hidden','_collapsed'])if(typeof value?.[side+suffix]==='boolean')out[side+suffix]=value[side+suffix];}out.swapped=value?.swapped===true;return out;};
export class DesktopWorkspace{
 constructor({getLayout,setLayout,apply}){this.getLayout=getLayout;this.setLayout=setLayout;this.apply=apply;this.current=null;this.changing=false;this.profiles={};try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');for(const [id,value] of Object.entries(raw))if(id.length<180)this.profiles[id]=safe(value);}catch{}this.installGroups();}
 save(){if(this.changing||!this.current)return;this.profiles[this.current]={...safe(this.getLayout()),swapped:document.getElementById('studio').dataset.swapped==='true',left_collapsed:document.getElementById('studio').dataset.leftCollapsed==='true',right_collapsed:document.getElementById('studio').dataset.rightCollapsed==='true'};try{localStorage.setItem(KEY,JSON.stringify(this.profiles));}catch{document.getElementById('connection-state').title='布局偏好无法保存；本次会话仍可使用。';}}
 enter(id){if(this.current===id){this.sync();return;}this.save();this.current=id;const own=id.startsWith('tool:'),overview=['backend-overview','knowledge-cloud'].includes(id);const value=this.profiles[id]||{left:220,right:240,bottom:120,left_hidden:own||overview,right_hidden:own||overview,bottom_hidden:true,swapped:false};this.changing=true;const {swapped,left_collapsed,right_collapsed,...layout}=value;this.setLayout({...this.getLayout(),...layout});const studio=document.getElementById('studio');studio.dataset.swapped=String(swapped);studio.dataset.leftCollapsed=String(!!left_collapsed);studio.dataset.rightCollapsed=String(!!right_collapsed);studio.dataset.workspace=id;this.apply();this.changing=false;this.sync();}
 sync(){const layout=this.getLayout(),studio=document.getElementById('studio');for(const slot of ['left','right']){const side=studio.dataset.swapped==='true'?(slot==='left'?'right':'left'):slot;studio.style.setProperty('--dock-'+slot,layout[side+'_hidden']?'0px':studio.dataset[side+'Collapsed']==='true'?'34px':(layout[side]||(side==='left'?220:240))+'px');}document.querySelector('.split-left').dataset.split=studio.dataset.swapped==='true'?'right':'left';document.querySelector('.split-right').dataset.split=studio.dataset.swapped==='true'?'left':'right';this.save();}
 toggle(side){const studio=document.getElementById('studio'),layout=this.getLayout();if(layout[side+'_hidden']){this.setLayout({...layout,[side+'_hidden']:false});studio.dataset[side+'Collapsed']='false';}else studio.dataset[side+'Collapsed']=String(studio.dataset[side+'Collapsed']!=='true');this.apply();this.sync();}
 swap(){const studio=document.getElementById('studio');studio.dataset.swapped=String(studio.dataset.swapped!=='true');this.sync();}
 reset(){delete this.profiles[this.current];const id=this.current;this.current=null;this.enter(id);}
 installGroups(){for(const side of ['left','right']){const panel=document.getElementById(side==='left'?'studio-library':'studio-inspector'),heading=panel.querySelector('.panel-heading');heading.draggable=true;heading.dataset.dockSide=side;heading.ondragstart=e=>{e.dataTransfer.setData('application/x-workbench-panel',side);e.dataTransfer.effectAllowed='move';};panel.ondragover=e=>{if([...e.dataTransfer.types].includes('application/x-workbench-panel'))e.preventDefault();};panel.ondrop=e=>{const from=e.dataTransfer.getData('application/x-workbench-panel');if(['left','right'].includes(from)&&from!==side){e.preventDefault();this.swap();}};
   const collapse=document.createElement('button');collapse.className='dock-collapse';collapse.type='button';collapse.textContent=side==='left'?'◧':'◨';collapse.title='折叠为图标 / 展开面板';collapse.dataset.dockCollapse=side;collapse.onclick=()=>this.toggle(side);heading.append(collapse);
  }
  const right=document.getElementById('studio-inspector'),tabs=document.createElement('div');tabs.className='dock-group-tabs';tabs.setAttribute('role','tablist');tabs.innerHTML='<button role="tab" aria-selected="true" data-panel-group="inspect">属性</button><button role="tab" aria-selected="false" data-panel-group="appearance">外观</button>';right.querySelector('.panel-heading').after(tabs);right.querySelector('.appearance').hidden=true;tabs.querySelectorAll('button').forEach(button=>button.onclick=()=>{right.querySelector('#inspect-content').hidden=button.dataset.panelGroup!=='inspect';right.querySelector('.appearance').hidden=button.dataset.panelGroup!=='appearance';tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',String(x===button)));});
 }
}
