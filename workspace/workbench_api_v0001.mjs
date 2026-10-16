// ============================================================
// 文件名: workbench_api_v0001.mjs
// 中文名: 前端查询命令与可恢复事件连接
// 版本号: v0001
//
// 主层级: action
// 层级: workbench / workspace
// 脚本定位: 前端查询命令与可恢复事件连接
//
// 职责说明:
// - 前端查询命令与可恢复事件连接
//
// 本脚本做什么:
// - 处理会话认证、JSON 请求、事件回放与断线重连
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
// alias: workbench_api_v0001
// family: workbench_api
// role: workbench_component
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/workbench_api_v0001.mjs
// input:
//   - loopback API route, request input and event cursor
// output:
//   - parsed backend facts and ordered event callbacks
// depends_on: []
// used_by:
//   - workbench_workspace_v0001
// ============================================================

const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_api';
const SCRIPT_NAME = 'workbench_api_v0001';
const SCRIPT_VERSION = 'v0001';

// ============================================================
// 客户端连接契约
// ============================================================
export class Api {
  constructor(){this.token=null;this.events=null;this.last=0;this.onState=()=>{};this.recoveryTimer=null;this.closed=false;}
  async connect(){const response=await fetch('/api/session');if(!response.ok)throw new Error('Session unavailable');this.token=(await response.json()).token;}
  async call(route,input,signal){
    const response=await fetch('/api/workbench/'+route,{method:input===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Workbench-Token':this.token},body:input===undefined?undefined:JSON.stringify(input),signal:signal || AbortSignal.timeout(20000)});
    const payload=await response.json();
    if(!response.ok){const error=new Error(payload.error?.message || 'Request failed');error.code=payload.error?.code;error.status=response.status;throw error;}
    return payload;
  }
  subscribe(cursor,onEvent,onReset){
    this.events?.close();clearTimeout(this.recoveryTimer);this.last=cursor;this.closed=false;
    this.events=new EventSource('/events/stream?after='+cursor);
    this.events.onopen=()=>{clearTimeout(this.recoveryTimer);this.onState('connected');};
    const recover=()=>{if(this.closed)return;clearTimeout(this.recoveryTimer);this.recoveryTimer=setTimeout(async()=>{try{await this.connect();this.events?.close();await onReset();}catch{recover();}},2000);};
    this.events.onerror=()=>{this.onState('disconnected');recover();};
    this.events.addEventListener('change',event=>{
      const value=JSON.parse(event.data);if(value.seq<=this.last)return;this.last=value.seq;onEvent(value);
    });
    this.events.addEventListener('reset',()=>{this.events.close();onReset();});
  }
  close(){this.closed=true;clearTimeout(this.recoveryTimer);this.events?.close();}
}
