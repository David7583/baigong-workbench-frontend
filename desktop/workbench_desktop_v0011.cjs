// ============================================================
// 文件名: workbench_desktop_v0011.cjs
// 中文名: Electron 窗口与后端生命周期协调
// 版本号: v0011
//
// 主层级: action
// 层级: workbench / desktop
// 脚本定位: Electron 窗口与后端生命周期协调
//
// 职责说明:
// - Electron 窗口与后端生命周期协调
//
// 本脚本做什么:
// - 启动或连接工作台后端，创建沙箱窗口并限制文件选择和打开结果桥
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
// alias: workbench_desktop_v0011
// family: workbench_desktop
// role: workbench_component
// version: v0011
// status: active
// entry_point: frontend/local_ai_workbench/desktop/workbench_desktop_v0011.cjs
// input:
//   - desktop application root and optional backend settings
// output:
//   - sandboxed desktop window and owned backend lifecycle
// depends_on:
//   - electron
//   - workbench_server_v0009
//   - workbench_preload_v0004
// used_by: []
// ============================================================

'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_desktop';
const SCRIPT_NAME = 'workbench_desktop_v0011';
const SCRIPT_VERSION = 'v0011';

// ============================================================
// 后端连接工具
// ============================================================
async function launchBackend() {
  if(process.env.WORKBENCH_BACKEND_URL) {
    const url=new URL(process.env.WORKBENCH_BACKEND_URL);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('Invalid backend URL');
    const health=await fetch(url.origin+'/api/session',{signal:AbortSignal.timeout(3000)}).then(x=>x.json());
    return {origin:url.origin,token:health.token,owned:false,governanceSecret:process.env.WORKBENCH_GOVERNANCE_DESKTOP_SECRET||null};
  }
  const entry=path.join(__dirname,'../runtime/workbench_server_v0009.cjs');
  const args=[entry];
  if(process.env.WORKBENCH_DATA_DIR)args.push('--data-dir',process.env.WORKBENCH_DATA_DIR);
  if(process.env.WORKBENCH_PROJECT_ROOT)args.push('--root',process.env.WORKBENCH_PROJECT_ROOT);
  const governanceSecret=crypto.randomBytes(32).toString('hex');
  const child=spawn(process.execPath,args,{env:{...process.env,WORKBENCH_GOVERNANCE_DESKTOP_SECRET:governanceSecret,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const output=await new Promise((resolve,reject)=>{
    let text='',errors='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Backend startup timeout'));},20000);
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-4000);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{if(!text.includes('\n')){clearTimeout(timer);reject(new Error('Backend exited '+code+': '+errors));}});
    child.stdout.on('data',chunk=>{text+=chunk;const line=text.split('\n')[0];if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(line));}catch(error){reject(error);}}});
  });
  const session=await fetch(output.url+'/api/session').then(x=>x.json());
  return {origin:output.url,token:session.token,child,owned:true,governanceSecret};
}
// ============================================================
// 桌面入口：没有业务执行逻辑
// ============================================================
async function main(){
  const profileRoot=process.env.WORKBENCH_DATA_DIR||path.join(process.env.WORKBENCH_PROJECT_ROOT||require('../runtime/workbench_server_v0009.cjs').findRoot(),'runtime/local_ai_workbench');
  app.setPath('userData',path.join(profileRoot,'desktop-profile'));
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  await app.whenReady();
  const backend=await launchBackend();
  let quitting=false;
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  // 为 Windows 显示缩放下的窗口边框取整预留少量空间。
  const width=Math.min(1440,Math.max(1,area.width-16)),height=Math.min(940,Math.max(1,area.height-16));
  const window=new BrowserWindow({width,height,x:area.x+Math.floor((area.width-width)/2),y:area.y+Math.floor((area.height-height)/2),minWidth:Math.min(480,width),minHeight:Math.min(400,height),show:false,title:'Local AI Workbench',
    webPreferences:{preload:path.join(__dirname,'workbench_preload_v0004.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==backend.origin)event.preventDefault();});
  window.webContents.on('render-process-gone',(_event,details)=>{if(!quitting&&!window.isDestroyed()&&details.reason!=='clean-exit')dialog.showMessageBox(window,{type:'error',message:'View failed. Reload the workspace from the menu.'});});
  const valid=event=>{if(event.sender!==window.webContents || new URL(event.senderFrame.url).origin!==backend.origin)throw new Error('IPC sender refused');};
  // 显示偏好仅允许主框架读写固定文件，不暴露任意路径。
  const themeFile=path.join(app.getPath('userData'),'theme_preferences_v0001.json');
  const themeSender=event=>{valid(event);if(event.senderFrame!==window.webContents.mainFrame)throw new Error('Theme preferences require main frame');};
  const themeValue=value=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['theme','reducedMotion'].includes(key))||!['base','star-ocean'].includes(value.theme)||typeof value.reducedMotion!=='boolean')throw new Error('Invalid theme preferences');
    return {theme:value.theme,reducedMotion:value.reducedMotion};
  };
  let governanceConfirmationOpen=false;
  ipcMain.handle('workbench:governance-confirm',async(event,id)=>{
    themeSender(event);if(!backend.governanceSecret)throw new Error('当前外部后端没有受限用户确认通道，请使用正常桌面启动入口。');if(governanceConfirmationOpen)throw new Error('已有规范变更等待用户确认');
    if(typeof id!=='string'||! /^[a-f0-9]{32}$/.test(id))throw new Error('无效变更申请');
    const call=async(route,input,trusted=false)=>{const response=await fetch(backend.origin+'/api/workbench/governance/'+route,{method:'POST',headers:{'X-Workbench-Token':backend.token,'Content-Type':'application/json',...(trusted?{'X-Governance-Desktop-Secret':backend.governanceSecret}:{})},body:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'规范确认失败');return value;};
    const proposal=(await call('proposal',{id})).proposal;if(proposal.status!=='pending_user_confirmation')throw new Error('此申请已经处理');
    governanceConfirmationOpen=true;try{
      const approval=await dialog.showMessageBox(window,{type:'warning',title:'规范变更：用户审批',message:'确认发布此次规范变更？',detail:'目标：'+proposal.target+'\n申请主体：'+proposal.actor+'\n原因：'+proposal.reason+'\n申请指纹：'+proposal.fingerprint+'\n\n'+proposal.diff.slice(0,14000)+'\n\n确认后执行后端校验；校验失败保留原规范。此次批准仅适用于本申请。',buttons:['取消并拒绝','确认发布'],defaultId:0,cancelId:0,noLink:true});
      return await call('decide',{id,fingerprint:proposal.fingerprint,approved:approval.response===1},true);
    }finally{governanceConfirmationOpen=false;}
  });
  ipcMain.handle('workbench:theme-load',event=>{themeSender(event);if(!fs.existsSync(themeFile))return {theme:'base',reducedMotion:false};return themeValue(JSON.parse(fs.readFileSync(themeFile,'utf8')));});
  ipcMain.handle('workbench:theme-save',(event,value)=>{themeSender(event);const preferences=themeValue(value);fs.mkdirSync(path.dirname(themeFile),{recursive:true});fs.writeFileSync(themeFile+'.tmp',JSON.stringify(preferences)+'\n',{encoding:'utf8',mode:0o600});fs.renameSync(themeFile+'.tmp',themeFile);return preferences;});
  ipcMain.handle('workbench:asset-open',async(event,input)=>{valid(event);const response=await fetch(backend.origin+'/api/workbench/assets/resolve',{method:'POST',headers:{'X-Workbench-Token':backend.token,'Content-Type':'application/json'},body:JSON.stringify({id:input.id,version:input.version})});const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'资产不存在');const item=value.item;if(item.archived||item.issues.length)throw new Error('资产归档或文件缺失');if(!fs.existsSync(item.path))throw new Error('文件不存在');if(input.folder!==false){shell.showItemInFolder(item.path);return {opened:true};}if(!['gltf','glb','fbx','obj','dwg','dxf','skp','ifc','png','jpg','jpeg','webp','hdr','exr','pdf'].includes(item.format))throw new Error('此格式仅支持定位');const error=await shell.openPath(item.path);if(error)throw new Error(error);return {opened:true};});
  ipcMain.handle('workbench:versions',event=>{valid(event);return {electron:process.versions.electron,node:process.versions.node};});
  ipcMain.handle('workbench:source-file',async(event,folder)=>{valid(event);const selected=await dialog.showOpenDialog(window,{title:folder?'选择资料文件夹':'选择数据库文件',properties:[folder===true?'openDirectory':'openFile']});return selected.canceled?null:selected.filePaths[0];});
  ipcMain.handle('workbench:project-open',async(event,ticket)=>{
    valid(event);
    const call=async(route,input)=>{const response=await fetch(backend.origin+'/api/workbench/user/'+route,{method:'POST',headers:{'X-Workbench-Token':backend.token,'Content-Type':'application/json'},body:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'打开失败');return value;};
    const result=await call('consume',{ticket});
    if(path.extname(result.path).toLowerCase()!=='.cmd')throw new Error('无效功能入口');
    const error=await shell.openPath(result.path);if(error)throw new Error(error);
    return call('opened',{project_id:result.project_id});
  });
  ipcMain.handle('workbench:database-file',async(event,driver)=>{
    valid(event);
    if(!['sqlite','duckdb','chroma'].includes(driver))throw new Error('Unknown database driver');
    const selected=await dialog.showOpenDialog(window,{properties:[driver==='chroma'?'openDirectory':'openFile']});
    return selected.canceled?null:selected.filePaths[0];
  });
  ipcMain.handle('workbench:import',async event=>{
    valid(event);
    const selected=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'Resource manifest',extensions:['json']}]});
    if(selected.canceled)return null;
    const file=selected.filePaths[0];if(fs.statSync(file).size>262144)throw new Error('Manifest too large');
    return JSON.parse(fs.readFileSync(file,'utf8'));
  });
  ipcMain.handle('workbench:open',async(event,runId)=>{
    valid(event);
    const runs=await fetch(backend.origin+'/api/workbench/runs',{headers:{'X-Workbench-Token':backend.token}}).then(x=>x.json());
    const run=runs.items.find(x=>x.run_id===runId&&x.state==='completed'&&['open','open_folder','open_output'].includes(x.action));
    if(!run)throw new Error('Open result not found');
    if(run.result.open_url){const url=new URL(run.result.open_url);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Unsafe URL');await shell.openExternal(url.href);}
    else if(run.result.open_path){const error=await shell.openPath(run.result.open_path);if(error)throw new Error(error);}
    return {opened:true};
  });
  Menu.setApplicationMenu(null);
  app.on('second-instance',()=>{window.show();window.focus();});
  await window.loadURL(backend.origin);
  window.show();
  app.on('before-quit',event=>{
    if(quitting || !backend.owned)return;
    event.preventDefault();quitting=true;
    fetch(backend.origin+'/api/workbench/shutdown',{method:'POST',headers:{'X-Workbench-Token':backend.token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)}).finally(()=>setTimeout(()=>app.quit(),200));
  });
  app.on('window-all-closed',()=>app.quit());
}
if(require.main===module || (process.type==='browser' && path.resolve(app.getAppPath(),'desktop/workbench_desktop_v0011.cjs')===__filename))main().catch(error=>{try{const logs=path.join(process.env.WORKBENCH_PROJECT_ROOT||path.resolve(__dirname,'../../..'),'logs');fs.mkdirSync(logs,{recursive:true});fs.appendFileSync(path.join(logs,'workbench_desktop_error.log'),new Date().toISOString()+' '+error.message+'\n');}catch{}console.error(JSON.stringify({status:'error',error_type:'DesktopStartup',detail:error.message}));app.exit(2);});
module.exports={launchBackend,main};

