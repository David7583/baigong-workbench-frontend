// ============================================================
// 文件名: desktop_menu_v0001.mjs
// 中文名: 紧凑桌面多级菜单与命令注册
// 版本号: v0001
// 主层级: action
// 层级: workbench / workspace / menus
// 脚本定位: 应用外壳的可注册菜单展示组件
// 职责说明:
// - 管理层级菜单、键盘焦点、鼠标路径和窗口边缘定位
// 本脚本做什么:
// - 展示真实注册命令并向现有调用方分派显式用户操作
// 本脚本不做什么:
// - 不执行模型、不授予资源权限、不保存业务数据
// 制度边界声明:
// - 菜单是展示契约；命令权限和错误处理仍由已有服务负责
// 可更新: True
// ============================================================
// ALIAS_META
// alias: desktop_menu_v0001
// family: desktop_menu
// role: accessible_desktop_menu
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/desktop_menu_v0001.mjs
// input:
//   - command registry and dynamic menu descriptions
// output:
//   - explicit command dispatch and accessible menu DOM
// depends_on:
//   - Browser DOM
// used_by:
//   - studio_shell_v0013
// ============================================================
const SCRIPT_NAME='desktop_menu_v0001',SCRIPT_FAMILY='desktop_menu',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export class CommandRegistry {
 constructor(){this.commands=new Map();}
 register(id,command){if(!/^[\w.:-]{1,150}$/.test(id)||typeof command?.run!=='function')throw new Error('菜单命令格式无效');this.commands.set(id,command);return()=>this.commands.delete(id);}
 enabled(id){const value=this.commands.get(id);return !!value&&(typeof value.enabled!=='function'||value.enabled());}
 run(id){if(!this.enabled(id))return;return this.commands.get(id).run();}
}
export class DesktopMenu {
 constructor(bar,registry){this.bar=bar;this.registry=registry;this.stack=[];this.items=[];this.root=-1;this.timer=null;this.returnFocus=null;this.bar.setAttribute('role','menubar');
  this.outside=e=>{if(!this.bar.contains(e.target)&&!this.stack.some(x=>x.menu.contains(e.target)))this.close(false);};document.addEventListener('pointerdown',this.outside,true);
  this.keys=e=>{if(e.key==='F10'||(e.key==='Alt'&&!e.ctrlKey&&!e.shiftKey)){e.preventDefault();this.close(false);this.buttons[0]?.focus();}else if(e.key==='Escape'&&this.stack.length){e.preventDefault();this.close(true);} };document.addEventListener('keydown',this.keys);
  this.resize=()=>this.close(false);window.addEventListener('resize',this.resize);
 }
 update(items){this.close(false);this.items=items;this.bar.replaceChildren();this.buttons=items.map((item,index)=>{const button=document.createElement('button');button.type='button';button.className='desktop-menu-root';button.textContent=item.label;button.dataset.menuRoot=item.id;button.setAttribute('role','menuitem');button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.tabIndex=index===0?0:-1;button.onclick=()=>this.root===index?this.close(true):this.openRoot(index,false);button.onpointerenter=()=>{if(this.root>=0)this.openRoot(index,false);};button.onkeydown=e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%this.buttons.length;else if(e.key==='ArrowLeft')next=(index-1+this.buttons.length)%this.buttons.length;else if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();this.openRoot(index,true);if(e.key==='ArrowUp')this.focusAt(0,-1);return;}else if(e.key==='Escape'){this.close(true);return;}else return;e.preventDefault();this.buttons.forEach(b=>b.tabIndex=-1);this.buttons[next].tabIndex=0;this.buttons[next].focus();if(this.root>=0)this.openRoot(next,true);};this.bar.append(button);return button;});}
 close(restore=false){clearTimeout(this.timer);this.trim(0);this.root=-1;this.buttons?.forEach(x=>x.setAttribute('aria-expanded','false'));if(restore&&this.returnFocus?.isConnected)this.returnFocus.focus();}
 trim(depth){while(this.stack.length>depth){const row=this.stack.pop();row.trigger?.setAttribute('aria-expanded','false');row.menu.remove();}}
 openRoot(index,focus){if(this.root===index){if(focus)this.focusAt(0,0);return;}if(this.root<0)this.returnFocus=document.activeElement;this.close(false);this.root=index;const trigger=this.buttons[index];trigger.setAttribute('aria-expanded','true');this.popup(this.items[index].children,trigger,0,focus);}
 popup(items,trigger,depth,focus){clearTimeout(this.timer);this.trim(depth);const menu=document.createElement('div');menu.className='desktop-menu-popup';menu.setAttribute('role','menu');menu.setAttribute('aria-label',trigger.textContent);menu.onpointerenter=()=>clearTimeout(this.timer);const rows=[];
  for(const item of items){if(item.separator){const separator=document.createElement('div');separator.className='desktop-menu-separator';separator.setAttribute('role','separator');menu.append(separator);continue;}
   const row=document.createElement('button');row.type='button';row.className='desktop-menu-row';row.setAttribute('role','menuitem');row.setAttribute('aria-label',item.label);row.tabIndex=-1;const enabled=item.children?.length||this.registry.enabled(item.command);row.disabled=!enabled;if(item.children){row.setAttribute('aria-haspopup','menu');row.setAttribute('aria-expanded','false');}row.dataset.command=item.command||'';row.dataset.menuItem=item.id||item.command||item.label;
   for(const [className,text] of [['menu-row-icon',item.icon||''],['menu-row-label',item.label],['menu-row-key',item.shortcut||''],['menu-row-arrow',item.children?'›':'']]){const span=document.createElement('span');span.className=className;span.textContent=text;row.append(span);}
   const activate=()=>{if(row.disabled)return;if(item.children){row.setAttribute('aria-expanded','true');this.popup(item.children,row,depth+1,true);}else{this.close(true);this.registry.run(item.command);}};
   row.onclick=activate;row.onpointerenter=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>{if(!menu.isConnected)return;this.trim(depth+1);if(item.children&&!row.disabled){row.setAttribute('aria-expanded','true');this.popup(item.children,row,depth+1,false);}},220);};
   row.onkeydown=e=>{const enabledRows=rows.filter(x=>!x.disabled),index=enabledRows.indexOf(row);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?enabledRows.length-1:(index+(e.key==='ArrowDown'?1:-1)+enabledRows.length)%enabledRows.length;enabledRows[next]?.focus();}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}else if(e.key==='ArrowRight'){e.preventDefault();if(item.children)activate();else if(depth===0)this.openRoot((this.root+1)%this.buttons.length,true);}
    else if(e.key==='ArrowLeft'){e.preventDefault();if(depth>0){this.trim(depth);trigger.focus();}else this.openRoot((this.root-1+this.buttons.length)%this.buttons.length,true);}
    else if(e.key==='Tab')this.close(false);else if(e.key.length===1&&!e.ctrlKey&&!e.altKey){const found=enabledRows.slice(index+1).concat(enabledRows.slice(0,index+1)).find(x=>x.querySelector('.menu-row-label').textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(found){e.preventDefault();found.focus();}}
   };rows.push(row);menu.append(row);
  }
  document.body.append(menu);const rect=trigger.getBoundingClientRect(),size=menu.getBoundingClientRect(),margin=4;let left=depth===0?rect.left:rect.right-2,top=depth===0?rect.bottom:rect.top-4;if(left+size.width>innerWidth-margin)left=depth===0?innerWidth-size.width-margin:rect.left-size.width+2;left=Math.max(margin,left);top=Math.max(margin,Math.min(top,innerHeight-size.height-margin));menu.style.left=left+'px';menu.style.top=top+'px';this.stack.push({menu,trigger,rows});if(focus)this.focusAt(depth,0);
 }
 focusAt(depth,index){const rows=this.stack[depth]?.rows.filter(x=>!x.disabled)||[];(index<0?rows.at(-1):rows[index])?.focus();}
 destroy(){this.close(false);document.removeEventListener('pointerdown',this.outside,true);document.removeEventListener('keydown',this.keys);window.removeEventListener('resize',this.resize);}
}
