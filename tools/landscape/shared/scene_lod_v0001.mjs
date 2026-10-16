// ============================================================
// 文件名: scene_lod_v0001.mjs
// 中文名: 屏幕空间、注意力和任务驱动LOD调度
// 版本号: v0001
// 主层级: action
// 层级: landscape / renderer
// 脚本定位: 可复用、确定性的视觉细节策略
// 职责说明: 分配显示层级并记录原因与性能压力。
// 本脚本做什么: 根据投影、任务、关注范围和实测帧间隔选择LOD。
// 本脚本不做什么: 不修改SceneSpec，不调用AI，不生成工程尺寸。
// 制度边界声明: 视觉设置独立于业务数据；正交相机以屏幕投影为依据。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: scene_lod_v0001
// family: scene_lod
// role: adaptive_visual_scheduler
// version: v0001
// status: staging
// entry_point: frontend/local_ai_workbench/tools/landscape/shared/scene_lod_v0001.mjs
// input: source bounds, projected pixels, focus, view task, frame observations
// output: stable per-object LOD and diagnostics
// depends_on: scene_data_geometry_v0001
// used_by: scene_engine_v0002
// ============================================================
import {objectBounds} from './scene_data_geometry_v0001.mjs';
const SCRIPT_NAME='scene_lod_v0001',SCRIPT_FAMILY='scene_lod',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export const VIEW_TASKS={layout:'整体布局',plants:'植物设计',materials:'材料设计',engineering:'工程数据'};
const MODES=['auto','overview','focus','manual'],TASK_TYPES={plants:new Set(['tree','shrub','planting','lawn']),materials:new Set(['road','platform','plaza','wall','steps','building','water']),engineering:new Set(['site','terrain','road','plaza','platform','wall','building','steps','water'])};
export class SceneLOD{
 constructor(){this.settings={mode:'auto',task:'layout',manual_level:0,focus_ids:[],focus_area:null,focus_radius:3.5};this.entries=new Map();this.previous=new Map();this.pressure=0;this.frames=[];this.lastBudgetChange=-Infinity;this.stableFastSince=null;this.force=true;}
 setScene(scene){this.scene=scene;this.entries=new Map(scene.objects.map(obj=>[obj.id,{object:obj,bounds:objectBounds(obj)}]));for(const id of this.previous.keys())if(!this.entries.has(id))this.previous.delete(id);this.force=true;}
 configure(value){const next={...this.settings,...value};if(!MODES.includes(next.mode)||!Object.hasOwn(VIEW_TASKS,next.task)||!Number.isInteger(next.manual_level)||next.manual_level<0||next.manual_level>3||!Array.isArray(next.focus_ids)||next.focus_ids.length>100||next.focus_ids.some(x=>typeof x!=='string')||!Number.isFinite(next.focus_radius)||next.focus_radius<.1||next.focus_radius>10000)throw new Error('LOD视图设置无效');if(next.focus_area&&(!Array.isArray(next.focus_area.center)||next.focus_area.center.length!==3||next.focus_area.center.some(x=>!Number.isFinite(x))||!Number.isFinite(next.focus_area.radius)||next.focus_area.radius<.1||next.focus_area.radius>10000))throw new Error('关注区域无效');this.settings=structuredClone(next);this.force=true;}
 observe({interval,cpu_ms,gpu_ms,now}){if(!Number.isFinite(interval)||interval<=0||interval>2000)return;this.frames.push(Math.max(interval,cpu_ms||0,gpu_ms||0));if(this.frames.length>60)this.frames.shift();this.slowFrames=cpu_ms>80?(this.slowFrames||0)+1:0;if(this.settings.mode==='manual')return;if(this.slowFrames>=2&&this.pressure<2&&now-this.lastBudgetChange>1800){this.pressure++;this.lastBudgetChange=now;this.force=true;this.slowFrames=0;}if(this.frames.length<12)return;const mean=this.frames.slice(-24).reduce((sum,x)=>sum+x,0)/Math.min(24,this.frames.length);if(mean>30&&this.pressure<2&&now-this.lastBudgetChange>1800){this.pressure++;this.lastBudgetChange=now;this.stableFastSince=null;this.force=true;}else if(mean<19){this.stableFastSince??=now;if(this.pressure&&now-this.stableFastSince>4500&&now-this.lastBudgetChange>4500){this.pressure--;this.lastBudgetChange=now;this.force=true;this.stableFastSince=now;}}else this.stableFastSince=null;}
 plan(project,{selected=null,now=performance.now()}={}){const prior=new Map(this.previous),focusIds=new Set(this.settings.focus_ids);if(selected)focusIds.add(selected);const focusCenters=[...focusIds].map(id=>this.entries.get(id)?.bounds.center).filter(Boolean),layers=new Set(this.scene?.layers.filter(x=>x.visible).map(x=>x.id)),results=new Map();for(const [id,{object:obj,bounds}] of this.entries){const projection=project(bounds),old=this.previous.get(id);const pixels=old&&!this.force?old.pixels*.65+projection.pixels*.35:projection.pixels;let level=pixels>=260?0:pixels>=95?1:pixels>=28?2:3,priority=4,reason='屏幕投影';const selectedObject=focusIds.has(id),distance=Math.min(...focusCenters.map(p=>Math.hypot(bounds.center[0]-p[0],bounds.center[1]-p[1]))),area=this.settings.focus_area,areaFocus=area&&Math.hypot(bounds.center[0]-area.center[0],bounds.center[1]-area.center[1])<=area.radius;const taskFocus=TASK_TYPES[this.settings.task]?.has(obj.type);if(this.settings.mode==='overview'){level=Math.max(2,level);reason='整体预览';}if(this.settings.mode==='manual'){level=this.settings.manual_level;reason='手动质量';}else{if(taskFocus){level=Math.min(level,this.settings.task==='engineering'||pixels<95?2:1);priority=2;reason=VIEW_TASKS[this.settings.task];}if(pixels>=28&&Math.hypot(projection.x,projection.y)<.45){level=Math.min(level,1);priority=Math.min(priority,3);reason+=' / 视图中心';}if(priority>=2&&this.pressure){level=Math.min(3,level+this.pressure);reason+=' / 性能预算';}}
   if(this.settings.mode!=='manual'&&this.settings.mode!=='overview'&&['building','road','platform'].includes(obj.type)){level=Math.min(level,1);priority=Math.min(priority,2);reason+=' / 主要空间轮廓';}
   if(selectedObject){level=0;priority=0;reason='选中/指定对象';}else if(areaFocus||this.settings.mode==='focus'&&distance<=this.settings.focus_radius){level=Math.min(level,1);priority=1;reason=areaFocus?'指定关注区域':'局部关注邻域';}else if(selected&&distance<=this.settings.focus_radius){level=Math.min(level,1);priority=1;reason+=' / 选中对象邻域';}
   const visible=layers.has(obj.layer)&&projection.visible;if(!visible&&!selectedObject)level=3;
   if(old&&level!==old.level&&!this.force&&priority>0){const threshold=level<old.level?[260,95,28][level]:[260,95,28][old.level],crossed=level<old.level?pixels>=threshold*1.18:pixels<threshold*.82;if(now-old.changed_at<550||!crossed)level=old.level;}
   const next={id,level,pixels,priority,reason,visible,changed_at:old?.level===level?old.changed_at:now};this.previous.set(id,next);results.set(id,next);
  }if(this.settings.mode!=='manual'){const detailed=[...results.values()].filter(x=>x.visible&&x.level<=1&&x.priority>1).sort((a,b)=>a.priority-b.priority||b.pixels-a.pixels||a.id.localeCompare(b.id));for(const x of detailed.slice(100)){x.level=2;x.changed_at=prior.get(x.id)?.level===2?prior.get(x.id).changed_at:now;x.reason+=' / 细节实例预算';this.previous.set(x.id,x);}}this.force=false;this.current=results;return results;}
 diagnostics(){const counts=[0,0,0,0];let culled=0,focused=0;for(const x of this.current?.values()||[]){if(x.visible)counts[x.level]++;else culled++;if(x.priority===0)focused++;}const mean=this.frames.length?this.frames.reduce((sum,x)=>sum+x,0)/this.frames.length:null;return {settings:structuredClone(this.settings),levels:counts,culled,focused,pressure:this.pressure,observed_fps:mean?1000/mean:null,observed_frame_ms:mean,sample_count:this.frames.length,hysteresis_percent:18,switch_cooldown_ms:550,threshold_pixels:[260,95,28]};}
}
