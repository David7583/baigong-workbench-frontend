// ============================================================
// 文件名: landscape_workspace_v0001.mjs
// 中文名: 独立场景工具桌面呈现适配
// 版本号: v0001
// 主层级: action
// 层级: workbench / platform
// 脚本定位: embedded_tool_presentation
// 职责说明:
// - 独立场景工具桌面呈现适配
// 本脚本做什么:
// - 复用现有契约与受管理接口，记录真实状态
// 本脚本不做什么:
// - 不改写业务事实，不自动授权、批准或调用模型
// 制度边界声明:
// - 仅管理工作台配置与派生展示，可回退
// 可更新: True
// ============================================================
// ALIAS_META
// alias: landscape_workspace_v0001
// family: landscape_workspace
// role: embedded_tool_presentation
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/tools/landscape/shared/landscape_workspace_v0001.mjs
// input:
//   - explicit versioned requests and existing metadata
// output:
//   - factual results and structured errors
// depends_on:
//   - existing workbench APIs and standard library
// used_by:
//   - workbench_platform
// ============================================================
const SCRIPT_NAME='landscape_workspace_v0001',SCRIPT_VERSION='v0001',SCRIPT_FAMILY='landscape_workspace',DEFAULT_ENCODING='utf8';

if(parent!==window){document.documentElement.dataset.workbench='true';const toolbar=document.querySelector('.document-toolbar'),state=document.getElementById('save-state');if(toolbar&&state){const status=document.createElement('span');status.className='embedded-save-state';toolbar.append(status);new MutationObserver(()=>status.textContent=state.textContent).observe(state,{childList:true,subtree:true});status.textContent=state.textContent;}const actions=document.querySelector('.top-actions');if(actions){const details=document.createElement('details');details.className='embedded-tool-actions';details.innerHTML='<summary>工具设置与实例</summary>';actions.parentNode.before(details);details.append(actions);}}
