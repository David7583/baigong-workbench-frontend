// ============================================================
// 文件名: workbench_preload_v0002.cjs
// 中文名: 受限桌面 IPC 桥
// 版本号: v0002
//
// 主层级: action
// 层级: workbench / desktop
// 脚本定位: 受限桌面 IPC 桥
//
// 职责说明:
// - 受限桌面 IPC 桥
//
// 本脚本做什么:
// - 仅向渲染页暴露经过桌面主进程校验的文件选择与结果打开接口
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
// alias: workbench_preload_v0002
// family: workbench_preload
// role: workbench_component
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/desktop/workbench_preload_v0002.cjs
// input:
//   - renderer requests for manifest, database path or completed run
// output:
//   - restricted contextBridge promises without Node access
// depends_on:
//   - electron
// used_by:
//   - workbench_desktop_v0001
// ============================================================

'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const DEFAULT_ENCODING = 'utf8';
const SCRIPT_FAMILY = 'workbench_preload';
const SCRIPT_NAME = 'workbench_preload_v0002';
const SCRIPT_VERSION = 'v0002';

// ============================================================
// 显式安装安全桥：此文件为 Electron preload 入口
// ============================================================
contextBridge.exposeInMainWorld('desktop',{
  loadThemePreferences:()=>ipcRenderer.invoke('workbench:theme-load'),
  saveThemePreferences:value=>ipcRenderer.invoke('workbench:theme-save',value),
  importManifest:()=>ipcRenderer.invoke('workbench:import'),
  openResult:runId=>ipcRenderer.invoke('workbench:open',runId),
  versions:()=>ipcRenderer.invoke('workbench:versions'),
  pickDatabase:driver=>ipcRenderer.invoke('workbench:database-file',driver),
  pickSource:folder=>ipcRenderer.invoke('workbench:source-file',folder),
  openProject:ticket=>ipcRenderer.invoke('workbench:project-open',ticket),
});

