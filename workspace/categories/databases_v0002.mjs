// ============================================================
// 文件名: databases_v0002.mjs
// 中文名: 数据库分组及种类管理视图
// 版本号: v0002
// 主层级: action
// 层级: workbench / loading
// 脚本定位: 数据库分组及种类管理视图
// 职责说明: 显式管理工作台接入，保留原资源和独立生命周期
// 本脚本做什么: 数据库分组及种类管理视图
// 本脚本不做什么: 不删除文件，不安装依赖，不自动授权或执行资源
// 制度边界声明: 扫描与加载分开；错误留证；只修改工作台接入
// 可更新: True
// ============================================================
// ALIAS_META
// alias: databases_v0002
// family: studio_category_databases
// role: workbench_loading
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/workspace/categories/databases_v0002.mjs
// input:
//   - explicit scoped selection and existing resource inventories
// output:
//   - truthful loading state and per-resource results
// depends_on:
//   - Browser DOM
//   - authenticated loading APIs
// used_by:
//   - studio_shell
// ============================================================

const SCRIPT_NAME='databases_v0002',SCRIPT_FAMILY='studio_category_databases',SCRIPT_VERSION='v0002';
export function render(ctx){
 const {target,escape:e}=ctx,cat=ctx.data.database_catalog,groups=cat.groups,types=cat.types,group=ctx.databaseGroup,type=ctx.databaseType;
 let query='';const matches=x=>(group==='all'||x.database_group===group)&&(type==='all'||x.database_type===type);
 target.innerHTML='<div class="db-catalog"><aside class="db-tree" aria-label="数据库分级目录"><button data-db-group="all">全部数据库 · '+cat.items.length+'</button>'+groups.map(g=>'<details open><summary><button data-db-group="'+e(g.id)+'">'+e(g.name)+' · '+cat.items.filter(x=>x.database_group===g.id).length+'</button></summary>'+types.filter(t=>cat.items.some(x=>x.database_group===g.id&&x.database_type===t.id)).map(t=>'<button class="db-type-node" data-db-group="'+e(g.id)+'" data-db-type="'+e(t.id)+'">'+e(t.name)+' · '+cat.items.filter(x=>x.database_group===g.id&&x.database_type===t.id).length+'</button>').join('')+'<small>'+e(g.description)+'</small></details>').join('')+'</aside><div class="db-main"><div class="db-heading"><h2>数据库</h2><button data-db-add>添加文件型数据库</button><button data-db-register>登记其他类型</button></div><p>按所属端 / 功能分组，再按数据库种类筛选。分类不移动文件；加载仅建立工作台只读连接。</p><input data-db-search aria-label="搜索数据库" placeholder="搜索数据库名称、路径、种类"><div data-db-list></div><p class="db-note">SQLite、DuckDB 可只读浏览；Chroma 仅浏览持久化元数据。其他关系型、图、文档、键值、向量及其他数据库可登记信息，连接能力按适配器实际支持情况显示。服务型数据库不会通过扫描磁盘自动连接。</p></div></div>';
 const draw=()=>{const rows=cat.items.filter(matches).filter(x=>[x.name,x.path,x.database_type].join(' ').toLowerCase().includes(query));target.querySelector('[data-db-list]').innerHTML='<table class="platform-table"><thead><tr><th>数据库 / 位置</th><th>所属分组</th><th>数据库种类</th><th>状态</th><th>操作</th></tr></thead><tbody>'+rows.map(x=>'<tr data-db-id="'+e(x.id)+'"><td><strong>'+e(x.name)+'</strong><small>'+e(x.path)+'</small></td><td><select data-db-reclass="'+e(x.key)+'" aria-label="'+e(x.name)+' 的所属分组">'+groups.map(g=>'<option value="'+e(g.id)+'" '+(g.id===x.database_group?'selected':'')+'>'+e(g.name)+'</option>').join('')+'</select><small>'+e(x.group_source)+'</small></td><td>'+e(types.find(t=>t.id===x.database_type)?.name||x.database_type)+'</td><td>'+e(x.loaded?(x.connection==='connected'?'已加载 · 连接正常':'已加载 · 连接异常'):(x.preview_supported?'未加载':'仅登记 · 未连接'))+'<small>'+e(x.reason||'')+'</small></td><td><button data-db-toggle="'+e(x.key)+'" '+(!x.loaded&&!x.available?'disabled':'')+'>'+e(x.loaded?'解除加载':'加载')+'</button><button data-db-open="'+e(x.key)+'" '+(!x.loaded||!x.preview_supported?'disabled':'')+'>浏览</button></td></tr>').join('')+'</tbody></table>'+(!rows.length?'<p class="empty-list">此分组 / 种类下暂无已发现数据库。使用上方扫描，或添加、登记现有数据库。</p>':'');
 target.querySelectorAll('[data-db-toggle]').forEach(b=>b.onclick=()=>ctx.action(()=>{const x=cat.items.find(x=>x.key===b.dataset.dbToggle);return ctx.loading(x.loaded?'unload':'load',[x.key]);}));
 target.querySelectorAll('[data-db-open]').forEach(b=>b.onclick=()=>{const x=cat.items.find(x=>x.key===b.dataset.dbOpen);ctx.open({id:x.id,resource_id:x.id,name:x.name,path:x.path});});
 target.querySelectorAll('[data-db-reclass]').forEach(select=>select.onchange=()=>ctx.action(async()=>{try{await ctx.api('loading/database-group',{key:select.dataset.dbReclass,group:select.value,revision:cat.revision});}finally{await ctx.reload();}},'数据库分组已保存'));
 };
 target.querySelectorAll('[data-db-group]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.dbGroup===group&&(b.dataset.dbType||'all')===type));b.onclick=()=>{ctx.setDatabaseType(b.dataset.dbType||'all');ctx.setDatabaseGroup(b.dataset.dbGroup);};});
 target.querySelector('[data-db-search]').oninput=ev=>{query=ev.target.value.toLowerCase();draw();};target.querySelector('[data-db-add]').onclick=ctx.add;
 target.querySelector('[data-db-register]').onclick=()=>ctx.dialog('登记数据库信息','<label class="form-field">名称<input name="name" required maxlength="160"></label><label class="form-field">所属分组<select name="group">'+groups.map(g=>'<option value="'+e(g.id)+'" '+(g.id===(group==='all'?'business':group)?'selected':'')+'>'+e(g.name)+'</option>').join('')+'</select></label><label class="form-field">数据库种类<select name="type">'+types.filter(t=>!t.preview_supported).map(t=>'<option value="'+e(t.id)+'">'+e(t.name)+' / '+e(t.family)+'</option>').join('')+'</select></label><label class="form-field">位置 / 无凭证连接地址<input name="location" required maxlength="1024"><small>只登记信息，不建立连接。请勿填写用户名、密码或令牌。</small></label>',async form=>ctx.api('loading/database-register',Object.fromEntries(form.entries())),'保存登记','数据库 / 信息登记');draw();
}
