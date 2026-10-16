// Product footage capture. Uses an isolated clean release, synthetic family data,
// real backend APIs and real Electron UI. Never opens personal data or calls AI.
// Inputs: VIDEO_NODE_MODULES, WORKBENCH_PYTHON. Outputs: assets/capture, evidence.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),backendRoot=path.join(ROOT,'.build/backend'),front=path.join(ROOT,'.build/frontend');
const dependencies=process.env.VIDEO_NODE_MODULES;
assert(dependencies,'Set VIDEO_NODE_MODULES to installed Electron and Playwright dependencies');
const {_electron}=require(path.join(dependencies,'playwright'));
process.env.WORKBENCH_FRONTEND_ROOT=front;
const {createServer}=require(path.join(backendRoot,'frontend/local_ai_workbench/runtime/workbench_server_v0017.cjs'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const secret=crypto.randomBytes(32).toString('hex');
 const backend=await createServer({root:backendRoot,dataDir:path.join(backendRoot,'runtime/video-demo'),governanceDesktopSecret:secret});
 await backend.ready; let app,page,recording=false,loop;
 const events=[],frames=[];let epoch=0;
 const out=path.join(ROOT,'assets/capture');fs.mkdirSync(out,{recursive:true});
 const call=async(route,input)=>{const res=await fetch(backend.origin+'/api/workbench/'+route,{method:input===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Workbench-Token':backend.token},body:input===undefined?undefined:JSON.stringify(input)});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;};
 const mark=name=>{events.push({name,time:(Date.now()-epoch)/1000});console.log(name);};
 const shot=async(name)=>{await delay(350);await page.screenshot({path:path.join(ROOT,'assets',name+'.png')});};
 try{
  const env={...process.env,WORKBENCH_BACKEND_ROOT:backendRoot,WORKBENCH_BACKEND_URL:backend.origin,WORKBENCH_GOVERNANCE_DESKTOP_SECRET:secret,WORKBENCH_DATA_DIR:path.join(backendRoot,'runtime/video-desktop')};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:require(path.join(dependencies,'electron')),args:[front],env,timeout:30000});
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.setViewportSize({width:1600,height:900});
  await page.waitForFunction(()=>document.querySelector('#connection-state')?.textContent.includes('已连接'));
  if(process.argv.includes('--permissions')){
   await page.locator('[data-platform-nav="flow"]').click();await page.locator('[data-flow-saved]').waitFor();
   const saved=(await call('workflows')).items[0];await page.locator('[data-flow-saved]').selectOption(saved.id);
   await page.locator('[data-flow-panel="analysis"]').click();
   await page.getByText('编排 AI 应用设置',{exact:true}).click();
   await page.getByText(/应用许可：未允许/).waitFor();await shot('permissions');
   console.log('Real disabled permissions captured; no permission changes');return;
  }
  await shot('home');
  await page.locator('[data-platform-nav="flow"]').click();await page.locator('[data-node-type="json"]').waitFor();
  await page.locator('[data-flow-name]').fill('家庭记忆 · 年份条目整理（虚构样本）');await page.locator('[data-flow-name]').blur();
  const ids=[];
  async function add(type,label,x,y,params){
   await page.locator('[data-node-type="'+type+'"]').dblclick();
   const id=await page.locator('[data-flow-node][aria-selected="true"]').getAttribute('data-flow-node');ids.push(id);
   await page.locator('[data-node-label]').fill(label);await page.locator('[data-node-label]').blur();
   for(const [key,value] of Object.entries(params)){await page.locator('[data-flow-param="'+key+'"]').fill(typeof value==='string'?value:JSON.stringify(value));await page.locator('[data-flow-param="'+key+'"]').blur();}
   const b=await page.locator('[data-flow-node="'+id+'"] header').boundingBox(),area=await page.locator('.workflow-area').boundingBox();
   await page.mouse.move(b.x+60,b.y+15);await page.mouse.down();await page.mouse.move(area.x+x+60,area.y+y+15,{steps:18});await page.mouse.up();
   return id;
  }
  const data=[{year:1988,event:'第一张全家福',source:'虚构相册条目 A'},{year:2003,event:'搬入新家',source:'虚构家庭笔记 B'},{year:2020,event:'三代人的团聚',source:'虚构纪念记录 C'}];
  fs.writeFileSync(path.join(ROOT,'assets/family_sample.json'),JSON.stringify({synthetic:true,items:data},null,2));
  await add('json','家庭资料 · 虚构样本',35,45,{data});
  await add('filter','按年份筛选 · 1988',320,45,{field:'year',contains:'1988'});
  await add('select','提取事件字段',605,45,{path:'items.0.event'});
  await add('template','生成时间线条目',320,245,{template:'1988 年｜{{value}}\n资料来源：虚构家庭样本，仅演示数据处理。'});
  await add('output','保存任务结果',605,245,{});
  await page.locator('[data-flow-reset]').click();
  await shot('nodes');
  epoch=Date.now();recording=true;
  loop=(async()=>{while(recording){const time=(Date.now()-epoch)/1000;const file=`frame_${String(frames.length).padStart(5,'0')}.jpg`;await page.screenshot({path:path.join(out,file),type:'jpeg',quality:91});frames.push({time,file});await delay(75);}})();
  mark('connect');
  for(let i=0;i<ids.length-1;i++){
   const a=await page.locator('[data-port-out="'+ids[i]+'"][data-port="value"] i').boundingBox();
   const b=await page.locator('[data-port-in="'+ids[i+1]+'"][data-port="value"] i').boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:35});await page.mouse.up();await delay(650);
  }
  assert.equal(await page.locator('[data-flow-edge]').count(),4);mark('connected');
  await page.locator('[data-flow-save]').click();await page.locator('[data-flow-state]').filter({hasText:'已保存 v1'}).waitFor();
  await page.locator('[data-flow-validate]').click();await delay(800);mark('validated');
  await shot('connected');
  await page.locator('[data-flow-run]').click();mark('run');
  await page.locator('[data-flow-state]').filter({hasText:'运行 completed'}).waitFor();mark('completed');
  await page.locator('[data-step="4"]').click();await delay(1500);await shot('result');
  const workflows=await call('workflows'),run=workflows.runs[0];
  assert.equal(run.status,'completed');assert(JSON.stringify(run.outputs).includes('1988 年｜第一张全家福'));
  fs.writeFileSync(path.join(ROOT,'evidence/actual_run.json'),JSON.stringify(run,null,2));
  const saved=(await call('workflows/get',{id:run.workflow_id})).item;
  fs.writeFileSync(path.join(ROOT,'assets/demo_workflow.json'),JSON.stringify(saved,null,2));
  mark('result');await delay(1000);
  recording=false;await loop;
  await page.locator('[data-flow-panel="analysis"]').click();await shot('analysis');
  await page.locator('[data-platform-nav="standards"]').click();await page.locator('[data-std-body]').waitFor();await delay(1500);await shot('standards');
  await page.locator('[data-platform-nav="tools"]').click();await delay(1000);await shot('tools');
  await page.locator('[data-platform-nav="home"]').click();await shot('home_final');
  fs.writeFileSync(path.join(ROOT,'evidence/capture.json'),JSON.stringify({synthetic:true,model_calls:0,source:'Published Workbench 0.7.0-chat.1, isolated data',frames,events,viewport:{width:1600,height:900},completed:true},null,2));
  console.log(JSON.stringify({status:'passed',frames:frames.length,steps:run.steps.length}));
 }finally{recording=false;if(loop)await loop.catch(()=>{});if(app){const timer=setTimeout(()=>app.process().kill(),5000);await app.close().finally(()=>clearTimeout(timer));}await backend.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
