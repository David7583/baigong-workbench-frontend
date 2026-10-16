// ============================================================
// 文件名: platform_icons_v0001.mjs
// 中文名: 通用平台线性图标
// 版本号: v0001
// 主层级: action
// 层级: workbench / platform
// 脚本定位: presentation_icons
// 职责说明:
// - 通用平台线性图标
// 本脚本做什么:
// - 复用现有契约与受管理接口，记录真实状态
// 本脚本不做什么:
// - 不改写业务事实，不自动授权、批准或调用模型
// 制度边界声明:
// - 仅管理工作台配置与派生展示，可回退
// 可更新: True
// ============================================================
// ALIAS_META
// alias: platform_icons_v0001
// family: platform_icons
// role: presentation_icons
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/platform_icons_v0001.mjs
// input:
//   - explicit versioned requests and existing metadata
// output:
//   - factual results and structured errors
// depends_on:
//   - existing workbench APIs and standard library
// used_by:
//   - workbench_platform
// ============================================================
const SCRIPT_NAME='platform_icons_v0001',SCRIPT_VERSION='v0001',SCRIPT_FAMILY='platform_icons',DEFAULT_ENCODING='utf8';

const paths={home:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',chat:'M4 4h16v12H9l-5 5V4',data:'M4 6c0-4 16-4 16 0s-16 4-16 0M4 6v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',tools:'m14 3 1 5 5 1-4 4-3-1-8 8-3-3 8-8-1-3 5-3',resources:'M3 6h7l2 2h9v12H3V6',standards:'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3V4M12 6v16',projects:'M3 6h18v14H3V6M8 6V3h8v3',mcp:'m12 2 9 5v10l-9 5-9-5V7l9-5M3 7l9 5 9-5M12 12v10',flow:'M2 3h7v6H2V3M15 15h7v6h-7v-6M9 6h9v9M5 9v9h10',assets:'M3 3h6v6H3V3M15 3h6v6h-6V3M3 15h6v6H3v-6M15 15h6v6h-6v-6',settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
export function icon(id){return '<svg aria-hidden="true" class="platform-icon" viewBox="0 0 24 24"><path d="'+(paths[id]||paths.resources)+'"/></svg>';}
