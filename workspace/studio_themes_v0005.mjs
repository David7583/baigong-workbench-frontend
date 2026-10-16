// ============================================================
// 文件名: studio_themes_v0005.mjs
// 中文名: 工作台可切换主题展示
// 版本号: v0005
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: presentation_theme_controller
// 职责说明: 管理工作台主题选择与显示偏好
// 本脚本做什么: 展示主题栏目，保存本机主题，恢复基础外观
// 本脚本不做什么: 不启动工具、模型、任务，不修改后端或数据库
// 制度边界声明: 只更改文档展示属性与独立 localStorage 键
// 可更新: True
// ============================================================
// ALIAS_META
// alias: studio_themes_v0005
// family: studio_themes
// role: presentation_theme_controller
// version: v0005
// status: staging
// entry_point: frontend/local_ai_workbench/workspace/studio_themes_v0005.mjs
// input: explicit user theme selection and local display preferences
// output: scoped theme attributes and settings view
// depends_on: DOM and localStorage
// used_by: studio_shell_v0005
// ============================================================
const SCRIPT_NAME='studio_themes_v0005.mjs',SCRIPT_FAMILY='studio_themes',SCRIPT_VERSION='v0005',DEFAULT_ENCODING='utf8';
const STORAGE_KEY='studio.theme.v1';
const DEFAULTS={theme:'base',reducedMotion:false};
const normalize=value=>({theme:value?.theme==='star-ocean'?'star-ocean':'base',reducedMotion:value?.reducedMotion===true});

// ============================================================
// 主题展示：无后端请求或工具生命周期操作
// ============================================================
export function installThemes({openTab}){
 let state={...DEFAULTS},storageWarning='';
 const statusLabel=document.querySelector('.status-right'),baseStatus=statusLabel?.textContent;
 try{state=normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}
 catch{storageWarning='主题偏好读取失败，已使用基础主题。';}
 const apply=()=>{
  if(state.theme==='base')delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme=state.theme;
  document.documentElement.toggleAttribute('data-reduced-motion',state.reducedMotion);
  if(statusLabel)statusLabel.textContent=state.theme==='base'?baseStatus:'星辰大海 · 可切换主题 | Studio 0.7';
  window.dispatchEvent(new Event('workbench-theme-change'));
 };
 apply();
 const view=document.createElement('section');view.className='theme-view';view.dataset.themeSettings='';
 view.innerHTML='<div class="theme-heading"><div><span class="section-caption">APPEARANCE / 工作台外观</span><h1>主题</h1><p>选择适合当前工作的界面。工具、任务和数据保持原来的状态。</p></div><span class="theme-current" data-theme-current></span></div><div class="theme-grid"><article class="theme-card"><div class="theme-preview theme-preview-base" aria-hidden="true"><span class="preview-sidebar"></span><span class="preview-panel"></span><span class="preview-lines"></span></div><h2>基础主题</h2><p>原有浅色工作台，熟悉的布局与操作。</p><button type="button" data-theme-select="base">使用基础主题</button></article><article class="theme-card"><div class="theme-preview theme-preview-ocean" aria-hidden="true"><span class="preview-sidebar"></span><span class="preview-panel"></span><span class="preview-lines"></span><span class="preview-stars"></span></div><h2>星辰大海</h2><p>深海色背景、清晰面板与克制的冷色强调。</p><button type="button" data-theme-select="star-ocean">使用星辰大海</button></article></div><section class="theme-options"><h2>显示偏好</h2><label><input type="checkbox" data-theme-motion> 减少动效</label><p>系统的减少动效设置也会生效。当前主题没有持续运行的粒子动画。</p></section><p class="theme-note">本版统一工作台外壳、目录与运行面板。独立工具保持自己的界面；知识空间已支持三维浏览与数据指标深度；原消息时间分布与时段筛选已接入；聊天主题缺失时明确标注。上方缩略图仅为外观示意。</p><p data-theme-feedback role="status" aria-live="polite"></p>';
 const feedback=view.querySelector('[data-theme-feedback]');
 const update=()=>{
  view.querySelector('[data-theme-current]').textContent='当前：'+(state.theme==='base'?'基础主题':'星辰大海');
  view.querySelector('[data-theme-motion]').checked=state.reducedMotion;
  for(const button of view.querySelectorAll('[data-theme-select]')){
   const chosen=button.dataset.themeSelect===state.theme;
   button.setAttribute('aria-pressed',String(chosen));button.closest('article').classList.toggle('chosen',chosen);
   button.textContent=chosen?'正在使用':button.dataset.themeSelect==='base'?'使用基础主题':'使用星辰大海';
  }
 };
 const save=async()=>{
  apply();update();
  const controls=[...view.querySelectorAll('button,input')];controls.forEach(control=>control.disabled=true);
  try{if(window.desktop?.saveThemePreferences){await window.desktop.saveThemePreferences(state);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}else localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageWarning='';feedback.textContent=window.desktop?.saveThemePreferences?'已保存显示偏好，重新打开工作台后继续使用。':'已保存到当前浏览器地址；更换端口后请重新选择。';}
  catch{storageWarning='显示已切换，但偏好无法保存；重新打开后可能恢复基础主题。';feedback.textContent=storageWarning;}
  finally{controls.forEach(control=>control.disabled=false);}
 };
 for(const button of view.querySelectorAll('[data-theme-select]'))button.onclick=()=>{state=normalize({...state,theme:button.dataset.themeSelect});save();};
 view.querySelector('[data-theme-motion]').onchange=event=>{state.reducedMotion=event.target.checked;save();};
 update();feedback.textContent=storageWarning;
 const ready=(async()=>{if(window.desktop?.loadThemePreferences){try{state=normalize(await window.desktop.loadThemePreferences());apply();update();feedback.textContent='';}catch{state={...DEFAULTS};apply();update();feedback.textContent='桌面偏好读取失败，已使用基础主题；可以重新选择。';}}})();
 const open=()=>{openTab('workbench-themes','主题',view);document.getElementById('add-resource').hidden=true;document.getElementById('crumb-category').textContent='工作台';document.getElementById('crumb-icon').textContent='◐';};
 return {
  ready, open,
  decorateNavigation(active){
   const menu=document.getElementById('category-menu');
   const button=document.createElement('button');button.type='button';button.className='menu-item'+(active==='workbench-themes'?' active':'');button.dataset.themeNav='';button.textContent='◐　主题';button.onclick=open;
   menu.querySelector('[data-theme-nav]')?.remove();if(active==='workbench-themes')menu.querySelectorAll('[data-category]').forEach(item=>item.classList.remove('active'));menu.append(button);
  }
 };
}

