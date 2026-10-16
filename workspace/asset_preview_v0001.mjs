// ============================================================
// File: asset_preview_v0001.mjs
// 中文名: 复用共享 Three.js 引擎的只读资产预览
// Version: v0001
// Main Layer: action
// Layer: workbench / workspace
// Responsibilities: 将已登记单资产映射为临时只读 SceneSpec。
// Does not: 保存场景、调用 AI、解析不支持的 CAD 格式。
// Boundary: 实际模型文件由认证资产端点提供；尺寸为预览归一化。
// Updatable: True
// ALIAS_META
// alias: asset_preview_v0001
// family: asset_preview
// role: shared_renderer_adapter
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/asset_preview_v0001.mjs
// input: registered asset ID and version
// output: real rotatable model preview
// depends_on: scene_engine_v0002
// used_by: assets_v0001
// ============================================================
import {SceneEngine} from '/asset-renderer/scene_engine_v0002.mjs';
const SCRIPT_NAME='asset_preview_v0001',SCRIPT_FAMILY='asset_preview',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
let engine;const status=document.getElementById('status');
try{
 const params=new URLSearchParams(location.search),session=await fetch('/api/session').then(r=>r.json()),response=await fetch('/api/workbench/assets/get',{method:'POST',headers:{'Content-Type':'application/json','X-Workbench-Token':session.token},body:JSON.stringify({id:params.get('id'),version:Number(params.get('version'))})}),result=await response.json();if(!response.ok)throw new Error(result.error?.message||'资产不存在');const item=result.item;if(!item.preview_supported||!['gltf','glb'].includes(item.format))throw new Error('此格式没有内置三维预览');
 const entry=item.files.find(f=>f.role==='entry').relative,url='/api/workbench/assets/file/'+encodeURIComponent(item.id)+'/'+item.version+'/'+entry.split('/').map(encodeURIComponent).join('/');
 engine=new SceneEngine(document.getElementById('view'),{assetCatalog:{schema_version:'landscape.assets.v1',assets:[{id:item.id,path:url}],defaults:{}},onStatus:value=>status.textContent=value});
 await engine.assets.prepare([{properties:{asset_id:item.id}}]);
 // Preserve original proportions; preview units are declared rather than claimed real-world dimensions.
 const source=engine.assets.models.get(item.id);const size=engine.assets.bounds(source);const scale=3/Math.max(...size);
 const spec={schema_version:'landscape.scene.v1',id:'asset-preview',origin:[0,0,0],bounds:{min:[-2,-2,0],max:[2,2,4]},layers:[{id:'asset',name:'实际资产',visible:true}],objects:[{id:'model',name:item.name,type:'asset',layer:'asset',position:[0,0,0],rotation:0,size:[size[0]*scale,size[2]*scale,size[1]*scale],geometry:{kind:'point',coordinates:[0,0,0]},material:{color:'#8fa485',roughness:.8,metalness:0},properties:{asset_id:item.id},overrides:{}}]};
 engine.setScene(spec,{fit:true,assetsReady:true});status.textContent='真实模型 · 归一化预览尺寸 · 拖动旋转 / 滚轮缩放';document.getElementById('reset').onclick=()=>engine.fit();window.assetPreview={id:item.id,diagnostics:()=>engine.diagnostics()};
}catch(error){status.textContent='预览失败：'+error.message;console.error(error);}
window.addEventListener('beforeunload',()=>engine?.dispose());
