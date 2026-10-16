// ============================================================
// 文件名: release_contract_test_v0001.cjs
// 中文名: 发布版桌面与截图验收
// 版本号: v0001
// 主层级: action
// 层级: frontend / tests
// 脚本定位: 真实桌面集成验收
// 职责说明: 验证独立前端启动和聊天加载，生成真实 README 截图。
// 本脚本做什么: 操作隔离安装副本的 Electron 界面。
// 本脚本不做什么: 不连接收费模型、不读取个人会话。
// 制度边界声明: 显式指定独立后端目录；截图只来自空测试环境。
// 可更新: True
// ALIAS_META
// alias: release_contract_test_v0001
// family: release_contract_test
// role: desktop_acceptance
// version: v0001
// status: staging
// entry_point: tests/release_contract_test_v0001.cjs
// input: WORKBENCH_BACKEND_ROOT, RELEASE_SCREENSHOTS
// output: assertions and screenshots
// depends_on: electron, playwright
// used_by: release operator
// ============================================================
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {_electron}=require('playwright');
const SCRIPT_NAME='release_contract_test_v0001',SCRIPT_FAMILY='release_contract_test',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
test('separate frontend boots and opens real chat without credentials',{timeout:90000},async()=>{
 assert.ok(process.env.WORKBENCH_BACKEND_ROOT,'Set an isolated WORKBENCH_BACKEND_ROOT');
 const front=path.resolve(__dirname,'..'),shots=process.env.RELEASE_SCREENSHOTS;
 const app=await _electron.launch({args:[front],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},timeout:30000});
 let chat;
 try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message);});
  page.on('response',r=>{if(r.status()>=400||r.url().includes('studio/open'))console.log('RESPONSE',r.status(),new URL(r.url()).pathname);});
  await page.waitForFunction(()=>document.querySelector('#connection-state')?.textContent.includes('已连接'),{timeout:30000});
  assert.equal(await page.getByText('AI 获客经营中心',{exact:true}).count(),0);
  await page.setViewportSize({width:1440,height:960});
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'01-empty-workbench.png')});}
  const tools=await page.evaluate(async()=>{const {token}=await fetch('/api/session').then(r=>r.json());return fetch('/api/workbench/studio/tools',{headers:{'X-Workbench-Token':token}}).then(r=>r.json());});
  console.log('TOOLS',JSON.stringify(tools));
  // Use the existing menu command: real GUI action opens and embeds the backend chat.
  console.log('OPEN_CHAT');await page.getByRole('button',{name:'独立 AI 对话',exact:true}).click();console.log('CLICKED_CHAT');
  try{await page.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).some(f=>f.src.includes('127.0.0.1')),null,{timeout:15000});}
  catch(error){console.log('OPEN_FAILURE',await page.locator('body').innerText());throw error;}
  chat=await (await page.locator('iframe.tool-frame').elementHandle()).contentFrame();
  assert.ok(chat);await chat.waitForURL(/127\.0\.0\.1/,{timeout:15000});await chat.waitForLoadState('domcontentloaded',{timeout:15000});
  await chat.waitForFunction(()=>document.body.innerText.includes('发送'),{timeout:15000});
  await chat.waitForFunction(()=>!document.getElementById('sendMessage')?.disabled,null,{timeout:15000});
  console.log('CHAT_TEXT', (await chat.locator('body').innerText()).slice(0,1600));
  if(shots)await page.screenshot({path:path.join(shots,'02-chat.png')});
  await chat.getByRole('tab',{name:'模型与连接'}).click();
  if(shots)await page.screenshot({path:path.join(shots,'03-model-settings.png')});
  assert.deepEqual(errors,[]);
 }finally{
  if(chat){await chat.evaluate(async()=>{await fetch('/api/chat/save',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await fetch('/api/admin/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}).catch(()=>{});}
  const timer=setTimeout(()=>app.process().kill(),5000);await app.close().finally(()=>clearTimeout(timer));
 }
});
