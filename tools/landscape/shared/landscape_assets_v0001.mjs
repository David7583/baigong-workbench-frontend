// ============================================================
// 文件名: landscape_assets_v0001.mjs
// 中文名: 本地精细景观资产加载与生命周期
// 版本号: v0001
// 主层级: action
// 层级: landscape / assets
// 脚本定位: 有来源许可的本地glTF资源池
// 职责说明: 校验资产目录、复用资源、逐对象变换与释放。
// 本脚本做什么: 加载明确列入目录的本地资产，不将模型图像当场景。
// 本脚本不做什么: 不联网下载、不调用AI、不修改来源事实。
// 制度边界声明: 导入路径仅当前服务assets；几何共享，手工材质逐对象隔离。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: landscape_assets_v0001
// family: landscape_assets
// role: local_asset_library
// version: v0001
// status: staging
// entry_point: frontend/local_ai_workbench/tools/landscape/shared/landscape_assets_v0001.mjs
// input: local asset catalog and SceneSpec objects
// output: owned model instances and resource lifecycle
// depends_on: GLTFLoader
// used_by: scene_engine_v0002
// ============================================================
import * as THREE from '/vendor/three.module.mjs';
import {GLTFLoader} from '/vendor/addons/loaders/GLTFLoader.mjs';
const SCRIPT_NAME='landscape_assets_v0001',SCRIPT_FAMILY='landscape_assets',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
export class AssetLibrary{
 constructor(catalog=null){this.models=new Map();this.pending=new Map();this.errors=new Map();this.disposed=false;this.catalogPromise=(catalog?Promise.resolve({ok:true,json:async()=>catalog}):fetch('/assets/asset_bindings_v0001.json')).then(async r=>{if(!r.ok)throw new Error('本地资产目录不可用');const catalog=await r.json();if(catalog.schema_version!=='landscape.assets.v1')throw new Error('资产目录版本无效');this.catalog=catalog;return catalog;});}
 id(obj){const id=obj.properties?.asset_id||this.catalog?.defaults?.[obj.type];return id&&obj.properties?.asset_version?id+'@'+obj.properties.asset_version:id;}
 async prepare(objects){await this.catalogPromise;if(this.disposed)return;const ids=[...new Set(objects.map(o=>this.id(o)).filter(Boolean))];await Promise.all(ids.map(id=>this.load(id)));}
 async load(id){if(this.models.has(id))return this.models.get(id);if(this.pending.has(id))return this.pending.get(id);const work=(async()=>{const entry=this.catalog.assets.find(x=>x.id===id);if(!entry||!/^\/(assets\/|api\/workbench\/assets\/file\/)/.test(entry.path)||!/[.]gl(tf|b)$/i.test(entry.path))throw new Error('资产引用不在本地目录：'+id);const response=await fetch(entry.path);if(!response.ok)throw new Error('本地资产文件不存在：'+id);const bytes=await response.arrayBuffer();if(entry.path.toLowerCase().endsWith('.gltf')){const data=JSON.parse(new TextDecoder().decode(bytes));for(const uri of [...(data.buffers||[]),...(data.images||[])].map(x=>x.uri).filter(Boolean)){if(uri.startsWith('data:'))continue;const resolved=new URL(uri,new URL(entry.path,location.origin));if(resolved.origin!==location.origin||!resolved.pathname.startsWith(entry.path.startsWith('/api/')?entry.path.split('/').slice(0,7).join('/')+'/':'/assets/'))throw new Error('资产包含外部或越界依赖');}}const model=await new GLTFLoader().parseAsync(bytes,entry.path.slice(0,entry.path.lastIndexOf('/')+1));if(this.disposed){this.release(model.scene);return;}this.models.set(id,model.scene);this.errors.delete(id);return model.scene;})().catch(error=>{this.errors.set(id,error.message);throw error;}).finally(()=>this.pending.delete(id));this.pending.set(id,work);return work;}
 bounds(root){const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());return size.toArray();}
 instance(engine,obj){const id=this.id(obj),source=this.models.get(id);if(!source)return null;const group=new THREE.Group(),content=source.clone(true),owned=[];group.add(content);const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());if(Math.max(size.x,size.y,size.z)<=0)throw new Error('资产包围盒无效：'+id);content.scale.set(obj.size[0]/(size.x||obj.size[0]),obj.size[2]/(size.y||obj.size[2]),obj.size[1]/(size.z||obj.size[1]));content.position.set(-center.x*content.scale.x,-bounds.min.y*content.scale.y,-center.z*content.scale.z);content.traverse(mesh=>{if(!mesh.isMesh)return;mesh.userData={...mesh.userData,id:obj.id};mesh.castShadow=true;mesh.receiveShadow=true;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];mesh.material=materials.map(m=>{const material=m.clone();if(obj.overrides?.material){material.color.set(obj.material.color);material.roughness=obj.material.roughness??material.roughness;material.metalness=obj.material.metalness??material.metalness;}owned.push(material);return material;});if(!Array.isArray(source.material)&&mesh.material.length===1)mesh.material=mesh.material[0];if(mesh.isInstancedMesh)owned.push(mesh);});group.position.copy(engine.position(obj.position));group.rotation.y=THREE.MathUtils.degToRad(obj.rotation);return {group,owned,fingerprint:engine.fingerprint(obj),asset:id};}
 release(root){const resources=new Set(),images=new Set();root.traverse(mesh=>{if(mesh.geometry)resources.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture){resources.add(value);if(value.image?.close)images.add(value.image);}}if(mesh.isInstancedMesh)resources.add(mesh);});for(const resource of resources)resource.dispose();for(const image of images)image.close();}
 dispose(){this.disposed=true;for(const model of this.models.values())this.release(model);this.models.clear();}
}
