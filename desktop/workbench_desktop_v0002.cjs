// ============================================================
// 文件名: workbench_desktop_v0002.cjs
// 中文名: Electron 窗口与后端生命周期协调
// 版本号: v0002
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
// alias: workbench_desktop_v0002
// family: workbench_desktop
// role: workbench_component
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/desktop/workbench_desktop_v0002.cjs
// input:
//   - desktop application root and optional backend settings
// output:
//   - sandboxed desktop window and owned backend lifecycle
// depends_on:
//   - electron
//   - workbench_server_v0002
//   - workbench_preload_v0001
// used_by: []
// ============================================================

'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_desktop';
const SCRIPT_NAME = 'workbench_desktop_v0002';
const SCRIPT_VERSION = 'v0002';

// ============================================================
// 后端连接工具
// ============================================================
async function launchBackend() {
  if(process.env.WORKBENCH_BACKEND_URL) {
    const url=new URL(process.env.WORKBENCH_BACKEND_URL);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('Invalid backend URL');
    const health=await fetch(url.origin+'/api/session',{signal:AbortSignal.timeout(3000)}).then(x=>x.json());
    return {origin:url.origin,token:health.token,owned:false};
  }
  const entry=path.join(__dirname,'../runtime/workbench_server_v0002.cjs');
  const args=[entry];
  if(process.env.WORKBENCH_DATA_DIR)args.push('--data-dir',process.env.WORKBENCH_DATA_DIR);
  if(process.env.WORKBENCH_PROJECT_ROOT)args.push('--root',process.env.WORKBENCH_PROJECT_ROOT);
  const child=spawn(process.execPath,args,{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const output=await new Promise((resolve,reject)=>{
    let text='',errors='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Backend startup timeout'));},20000);
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-4000);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{if(!text.includes('\n')){clearTimeout(timer);reject(new Error('Backend exited '+code+': '+errors));}});
    child.stdout.on('data',chunk=>{text+=chunk;const line=text.split('\n')[0];if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(line));}catch(error){reject(error);}}});
  });
  const session=await fetch(output.url+'/api/session').then(x=>x.json());
  return {origin:output.url,token:session.token,child,owned:true};
}
// ============================================================
// 桌面入口：没有业务执行逻辑
// ============================================================
async function main(){
  const profileRoot=process.env.WORKBENCH_DATA_DIR||path.join(process.env.WORKBENCH_PROJECT_ROOT||require('../runtime/workbench_server_v0002.cjs').findRoot(),'runtime/local_ai_workbench');
  app.setPath('userData',path.join(profileRoot,'desktop-profile'));
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  await app.whenReady();
  const backend=await launchBackend();
  let quitting=false;
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  // 为 Windows 显示缩放下的窗口边框取整预留少量空间。
  const width=Math.min(1440,Math.max(1,area.width-16)),height=Math.min(940,Math.max(1,area.height-16));
  const window=new BrowserWindow({width,height,x:area.x+Math.floor((area.width-width)/2),y:area.y+Math.floor((area.height-height)/2),minWidth:Math.min(480,width),minHeight:Math.min(400,height),show:false,title:'Local AI Workbench',
    webPreferences:{preload:path.join(__dirname,'workbench_preload_v0001.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==backend.origin)event.preventDefault();});
  window.webContents.on('render-process-gone',(_event,details)=>{if(!quitting&&!window.isDestroyed()&&details.reason!=='clean-exit')dialog.showMessageBox(window,{type:'error',message:'View failed. Reload the workspace from the menu.'});});
  const valid=event=>{if(event.sender!==window.webContents || new URL(event.senderFrame.url).origin!==backend.origin)throw new Error('IPC sender refused');};
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
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Workbench',submenu:[{label:'Reload view',click:()=>window.reload()},{role:'togglefullscreen'},{type:'separator'},{role:'quit'}]},
    {label:'View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'toggleDevTools'}]},
  ]));
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
if(require.main===module || (process.type==='browser' && path.resolve(app.getAppPath(),'desktop/workbench_desktop_v0002.cjs')===__filename))main().catch(error=>{try{const logs=path.join(process.env.WORKBENCH_PROJECT_ROOT||path.resolve(__dirname,'../../..'),'logs');fs.mkdirSync(logs,{recursive:true});fs.appendFileSync(path.join(logs,'workbench_desktop_error.log'),new Date().toISOString()+' '+error.message+'\n');}catch{}console.error(JSON.stringify({status:'error',error_type:'DesktopStartup',detail:error.message}));app.exit(2);});
module.exports={launchBackend,main};
