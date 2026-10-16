// ============================================================
// File: assets_v0001.mjs
// 中文名: 工作台一级数字资产栏目
// Version: v0001
// Main Layer: action
// Layer: workbench / workspace
// Responsibilities: 独立格式树、内容筛选、资产详情与显式用户操作。
// Does not: 数据库写入、AI 调用、CAD 解析或重复实现三维引擎。
// Boundary: 后台结果为事实；许可未知明确标记；导入前确认来源。
// Updatable: True
// ALIAS_META
// alias: assets_v0001
// family: assets
// role: asset_workspace
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/assets_v0001.mjs
// input: asset.repository.v1 results
// output: user requested asset operations
// depends_on: workbench_assets_v0001
// used_by: studio_shell_v0010
// ============================================================
const SCRIPT_NAME='assets_v0001',SCRIPT_FAMILY='assets',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
const sizes=n=>n>=1048576?(n/1048576).toFixed(2)+' MiB':(n/1024).toFixed(1)+' KiB';
const field=(e,name,label,value='',required=false)=>`<label>${e(label)}<input name="${name}" value="${e(value)}" ${required?'required':''}></label>`;
export function add(ctx){const e=ctx.escape;return ctx.dialog('导入可复用资产',field(e,'path','资产文件路径（复制完整依赖包）','',true)+'<button type="button" id="asset-pick">选择文件</button>'+field(e,'bundle_root','包根目录（留空使用文件所在目录；父级纹理需填写共同根）')+field(e,'name','显示名称')+field(e,'categories','内容类别（逗号分隔，例如 植物,乔木）')+field(e,'tags','标签（逗号分隔）')+field(e,'source','来源 / 作者')+field(e,'url','原始来源地址')+field(e,'license','许可协议','未确认')+field(e,'license_file','许可说明（建议包内 LICENSE / PROVENANCE）')+'<p>未知许可会明确显示为“未确认”。glTF 缺失配套文件时会拒绝导入。</p>',async f=>{const result=await ctx.api('assets/import',formData(f));ctx.log(result.duplicate?'已识别重复内容，返回原资产 ID':'资产包已校验并导入');await ctx.reload();},'确认导入','ASSETS / 通用资源')&&undefined;}
const split=s=>String(s||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean);
function formData(f){return {...Object.fromEntries(f),categories:split(f.get('categories')),tags:split(f.get('tags')),bundle_root:f.get('bundle_root')||undefined};}
// Dialogs are installed synchronously by the shell; native picker is attached after it appears.
document.addEventListener('click',async event=>{if(event.target.id!=='asset-pick'||!window.desktop?.pickSource)return;try{const path=await window.desktop.pickSource(false);if(path)document.querySelector('input[name="path"]').value=path;}catch{}});
export function scan(ctx){return ctx.dialog('增量发现资产',field(ctx.escape,'path','扫描明确的内容目录','',true)+'<p>扫描只登记候选，不复制、不导入。跳过软件依赖目录；结果需要逐项确认。</p>',async f=>{const result=await ctx.api('assets/scan',{path:f.get('path')});showCandidates(ctx,result);},'扫描','ASSETS / 发现');}
function showCandidates(ctx,result){const e=ctx.escape;ctx.dialog('扫描结果',`<p>检查 ${result.checked} 项；${result.unchanged} 项复用指纹；异常 ${result.errors.length} 项。</p>`+result.candidates.map(c=>`<label><input type="checkbox" name="candidate" value="${e(c.id)}" ${c.status!=='pending'?'disabled':''}>${e(c.path)} <small>${e(c.status)}${c.missing?.length?'：'+e(c.missing.join(', ')):''}</small></label>`).join('')+result.errors.map(x=>`<p>${e(x.path)}：${e(x.error)}</p>`).join(''),async f=>{for(const id of f.getAll('candidate'))await ctx.api('assets/confirm_scan',{candidate_id:id,license:'未确认'});await ctx.reload();},'导入选中候选','ASSETS / 用户确认');}
export async function render(ctx){
 const {target,escape:e,api}=ctx;let state={sort:'imported'},selected=null,epoch=0;
 target.innerHTML=`<style>.asset-grid{display:grid;grid-template-columns:190px minmax(280px,1fr) minmax(300px,1fr);gap:16px;padding:20px}.asset-grid section{min-width:0}.asset-tree button{display:block;width:100%;text-align:left;margin:4px 0}.asset-list button{display:block;width:100%;text-align:left;padding:14px;margin-bottom:8px;background:var(--surface,#f8f8f5);border:1px solid #8885;border-radius:8px;color:inherit}.asset-list small{display:block;opacity:.7;margin-top:6px}.asset-details{padding:16px;border:1px solid #8885;border-radius:10px;overflow-wrap:anywhere}.asset-details dl{display:grid;grid-template-columns:80px 1fr;gap:8px}.asset-details dd{margin:0}.asset-actions{display:flex;flex-wrap:wrap;gap:6px}.asset-preview{width:100%;height:360px;border:0;border-radius:8px}.asset-filter{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px}.asset-filter input,.asset-filter select{padding:8px;background:transparent;color:inherit;border:1px solid #8886;border-radius:5px}@media(max-width:1100px){.asset-grid{grid-template-columns:150px 1fr}.asset-details{grid-column:1/-1}}</style><div style="padding:20px"><small>RESOURCES / 资产管理</small><h1>可复用资产</h1><p>格式、内容分类与项目归属独立保存。资产按 ID 引用，名称修改不移动文件。</p><div class="asset-actions"><button data-top="import">导入资产</button><button data-top="scan">扫描目录</button><button data-top="refresh">刷新</button><label><input type="checkbox" id="asset-archived">显示归档</label></div></div><div class="asset-filter"><input id="asset-search" placeholder="搜索名称、来源、标签"><select id="asset-category"><option value="">全部内容类别</option></select><select id="asset-tag"><option value="">全部标签</option></select><select id="asset-source"><option value="">全部来源</option></select><select id="asset-project"><option value="">全部项目</option></select><select id="asset-sort"><option value="imported">导入时间</option><option value="name">名称</option><option value="size">大小</option></select></div><div class="asset-grid"><section class="asset-tree"></section><section class="asset-list"></section><section class="asset-details">选择一项资产查看来源、许可、文件和引用。</section></div>`;
 const projects=(await api('capabilities')).projects.filter(x=>!x.archived);
 target.querySelector('#asset-project').innerHTML+projects.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('');
 const run=fn=>ctx.action(async()=>{await fn();});
 async function load(){const generation=++epoch,result=await api('assets/list',state);if(generation!==epoch||!target.isConnected)return;
  for(const [id,values,label] of [['asset-category',result.categories,'全部内容类别'],['asset-tag',result.tags,'全部标签'],['asset-source',result.facets.source,'全部来源']]){const node=target.querySelector('#'+id),old=node.value;node.innerHTML=`<option value="">${label}</option>`+values.filter(Boolean).map(x=>`<option value="${e(x)}">${e(x)}</option>`).join('');node.value=old;}
  document.getElementById('library-count').textContent=result.items.length;document.getElementById('library-list').innerHTML=result.items.map(x=>`<button class="library-row" data-asset-side="${e(x.id)}"><span class="row-text"><strong>${e(x.name)}</strong><small>${e(x.format)} · ${e(x.license)}</small></span></button>`).join('');document.querySelectorAll('[data-asset-side]').forEach(b=>b.onclick=()=>run(()=>detail(b.dataset.assetSide)));
  const groups={'三维模型':['gltf','glb','fbx','obj','stl','ply','usd','usdz','blend'],'CAD / 工程模型':['dwg','dxf','skp','ifc','step','iges'],'材质与纹理':['mtl','ktx2','basis'],'图片与参考素材':['png','jpg','jpeg','webp','tif','svg'],'HDRI / 环境资源':['hdr','exr'],'其他可复用资源':result.facets.format.filter(x=>!['gltf','glb','fbx','obj','stl','ply','usd','usdz','blend','dwg','dxf','skp','ifc','step','iges','mtl','ktx2','basis','png','jpg','jpeg','webp','tif','svg','hdr','exr'].includes(x))};
  target.querySelector('.asset-tree').innerHTML='<button data-format="">全部资产</button>'+Object.entries(groups).map(([name,formats])=>`<details open><summary>${e(name)}</summary><button data-kind="${e(name)}">全部${e(name)}</button>${formats.map(f=>`<button data-format="${e(f)}">${e(f.toUpperCase())}</button>`).join('')}</details>`).join('')+`<small>当前最多显示 ${result.limit} 项<br>存储：${e(result.storage)}</small>`;
  target.querySelector('.asset-list').innerHTML=`<p>${result.items.length} 项资产</p>`+result.items.map(x=>`<button data-asset="${e(x.id)}"><b>${e(x.name)}</b> · ${e(x.format.toUpperCase())}<small>${e(x.kind)} · ${sizes(x.size)} · ${e(x.categories.join(' / '))}</small><small>${e(x.source||'来源未确认')} · ${e(x.license)} · ${e(x.health)}</small><small>导入 ${e(x.imported_at)}</small></button>`).join('');
  if(selected)await detail(selected);
 }
 async function detail(id){const generation=epoch,result=await api('assets/get',{id}),x=result.item;if(generation!==epoch||!target.isConnected)return;selected=x.id;
  const relative=x.files.find(f=>f.role==='entry').relative,url='/api/workbench/assets/file/'+encodeURIComponent(x.id)+'/'+x.version+'/'+relative.split('/').map(encodeURIComponent).join('/');
  const preview=x.preview_supported&&['gltf','glb'].includes(x.format)?`<iframe class="asset-preview" title="可自由旋转的实际资产模型" src="/workspace/asset_preview_v0001.html?id=${encodeURIComponent(x.id)}&version=${x.version}"></iframe>`:x.preview_supported?`<img alt="资产预览" style="max-width:100%;max-height:300px" src="${e(url)}">`:`<p>此格式当前提供登记、元数据与外部打开；没有内置完整预览。</p>`;
  target.querySelector('.asset-details').innerHTML=`<h2>${e(x.name)}</h2>${preview}<dl>`+Object.entries({'资产 ID':x.id,'格式':x.format,'类型':x.kind,'内容类别':x.categories.join(' / '),'标签':x.tags.join(', '),'大小':sizes(x.size),'来源':x.source||'未确认','下载地址':x.url||'未提供','许可':x.license,'许可证明':x.license_file||'参见包内文件 / 未提供','位置':x.path,'导入时间':x.imported_at,'版本':x.version,'状态':x.health,'内容哈希':x.bundle_hash}).map(([k,v])=>`<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')+`</dl><p>${e(x.description)}</p><div class="asset-actions">${[['edit','编辑元数据'],['locate','定位文件'],['external','外部打开'],['reference','关联项目'],['verify','校验文件'],['version','导入新版本'],['lod','关联 LOD 变体'],['history','修改记录'],[x.archived?'restore':'archive',x.archived?'恢复资产':'安全归档']].map(([op,label])=>`<button data-op="${op}">${label}</button>`).join('')}</div><h3>使用引用（${x.references.length}）</h3>`+x.references.map(r=>`<p>${e(projects.find(p=>p.id===r.project_id)?.name||r.owner_type)} · ${e(r.owner_id)} · v${r.version} <button data-unref="${e(r.id)}">解除引用</button></p>`).join('')+`<h3>版本与依赖</h3>`+x.versions.map(v=>`<p>v${v.version} · ${sizes(v.size)} · ${e(v.created_at)}</p>`).join('')+x.files.map(f=>`<p><small>${e(f.relative)} · ${sizes(f.size)}</small></p>`).join('')+x.issues.map(issue=>`<p>${e(issue.status)}：${e(issue.file)}</p>`).join('');
  const panel=target.querySelector('.asset-details');panel.onclick=event=>{const button=event.target.closest('button');if(!button)return;run(async()=>{
   const op=button.dataset.op;
   if(button.dataset.unref){await api('assets/unreference',{id:x.id,reference_id:button.dataset.unref});return detail(x.id);}
   if(op==='locate'||op==='external'){if(!window.desktop?.openAsset)throw new Error('浏览器模式请复制上面的实际路径，在文件管理器打开');await window.desktop.openAsset({id:x.id,version:x.version,folder:op==='locate'});return;}
   if(op==='edit'){ctx.dialog('编辑资产信息',field(e,'name','名称',x.name,true)+field(e,'description','描述',x.description)+field(e,'kind','资源类型',x.kind)+field(e,'categories','内容类别（逗号）',x.categories.join(','))+field(e,'tags','标签（逗号）',x.tags.join(','))+field(e,'source','来源',x.source)+field(e,'url','下载地址',x.url)+field(e,'license','许可',x.license)+field(e,'license_file','许可证明',x.license_file),async f=>{await api('assets/edit',{...formData(f),id:x.id,revision:x.revision});await load();},'保存');return;}
   if(op==='reference'){ctx.dialog('关联已有项目','<label>项目<select name="project_id">'+projects.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('')+'</select></label><p>保存资产 ID 与版本引用，不复制文件。</p>',async f=>{await api('assets/reference',{id:x.id,project_id:f.get('project_id'),version:x.version});await detail(x.id);},'添加引用');return;}
   if(op==='version'){ctx.dialog('导入新版本',field(e,'path','新的模型文件','',true)+field(e,'bundle_root','包根目录（可选）')+'<p>既有项目引用继续指向原版本。当前版本更新不静默替换旧引用。</p>',async f=>{await api('assets/update_version',{id:x.id,revision:x.revision,path:f.get('path'),bundle_root:f.get('bundle_root')||undefined});await load();},'校验并导入');return;}
   if(op==='lod'){ctx.dialog('登记已有资产为 LOD 变体',field(e,'level','层级（0–3）','1',true)+field(e,'variant_id','已登记变体资产 ID（留空解除）'),async f=>{await api('assets/lod',{id:x.id,level:Number(f.get('level')),variant_id:f.get('variant_id')});await detail(x.id);},'保存关联');return;}
   if(op==='history'){const history=await api('assets/history',{id:x.id});ctx.dialog('修改记录',history.items.map(h=>`<p>${e(h.at)} · ${e(h.operation)}<small>${e(h.value)}</small></p>`).join(''),async()=>{},'关闭');return;}
   if(op==='archive'){ctx.dialog('安全归档资产','<p>有引用的资产会被拒绝归档。归档后文件及来源记录保留，可恢复。</p>',async()=>{await api('assets/archive',{id:x.id});selected=null;await load();},'确认归档');return;}
   if(op==='restore'){await api('assets/restore',{id:x.id});await load();return;}
   if(op==='verify'){const value=await api('assets/verify',{id:x.id});ctx.log(value.item.health+(value.item.issues.length?'：'+value.item.issues.map(i=>i.file).join(', '):'：包内文件哈希一致'));await detail(x.id);}
  });};
 }
 target.onclick=event=>{const b=event.target.closest('button');if(!b||b.closest('.asset-details'))return;run(async()=>{if(b.dataset.asset)return detail(b.dataset.asset);if('format'in b.dataset){state.format=b.dataset.format;delete state.kind;selected=null;return load();}if(b.dataset.kind){state.kind=b.dataset.kind;delete state.format;selected=null;return load();}if(b.dataset.top==='import')return add(ctx);if(b.dataset.top==='scan')return scan(ctx);if(b.dataset.top==='refresh')return load();});};
 let timer;target.querySelector('#asset-search').oninput=event=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=event.target.value;selected=null;run(load);},300);};
 for(const [id,key] of [['asset-category','categories'],['asset-tag','tags'],['asset-source','source'],['asset-project','project_id'],['asset-sort','sort']])target.querySelector('#'+id).onchange=event=>{state[key]=event.target.value;selected=null;run(load);};
 target.querySelector('#asset-archived').onchange=event=>{state.archived=event.target.checked;selected=null;run(load);};await load();
}
