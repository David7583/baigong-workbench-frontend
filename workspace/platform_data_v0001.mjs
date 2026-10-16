// ============================================================
// 文件名: platform_data_v0001.mjs
// 中文名: 通用只读数据工作区
// 版本号: v0001
// 主层级: action
// 层级: workbench / platform
// 脚本定位: readonly_data_workspace
// 职责说明:
// - 通用只读数据工作区
// 本脚本做什么:
// - 复用现有契约与受管理接口，记录真实状态
// 本脚本不做什么:
// - 不改写业务事实，不自动授权、批准或调用模型
// 制度边界声明:
// - 仅管理工作台配置与派生展示，可回退
// 可更新: True
// ============================================================
// ALIAS_META
// alias: platform_data_v0001
// family: platform_data
// role: readonly_data_workspace
// version: v0001
// status: active
// entry_point: frontend/local_ai_workbench/workspace/platform_data_v0001.mjs
// input:
//   - explicit versioned requests and existing metadata
// output:
//   - factual results and structured errors
// depends_on:
//   - existing workbench APIs and standard library
// used_by:
//   - workbench_platform
// ============================================================
const SCRIPT_NAME='platform_data_v0001',SCRIPT_VERSION='v0001',SCRIPT_FAMILY='platform_data',DEFAULT_ENCODING='utf8';

export async function open(ctx,item){
 const e=ctx.escape,id=item.resource_id||item.id,catalog=await ctx.api('databases/'+encodeURIComponent(id)+'/read',{}),view=document.createElement('section'),left=document.createElement('div'),right=document.createElement('div');view.className='platform-pane';left.className=right.className='platform-panel';left.dataset.panelTitle='数据表';right.dataset.panelTitle='字段属性';
 const installed=ctx.openTab('db:'+id,item.name,view,{left,right});if(installed!==view)return;
 left.innerHTML='<h3>数据表</h3>'+catalog.tables.map((t,i)=>'<button data-data-table="'+i+'">'+e(t.name)+'</button>').join('')+'<p>只读接口；原库不修改。</p>';
 view.innerHTML='<div class="platform-toolbar"><h2>'+e(item.name)+'</h2><input data-data-filter placeholder="筛选当前页"><button data-data-prev>上一页</button><button data-data-next>下一页</button><button data-data-export>导出当前页 CSV</button></div><p class="platform-note" data-data-state>选择左侧数据表</p><div class="platform-scroll" data-data-tableview></div>';
 let table=catalog.tables[0],offset=0,rows=[],columns=[];const limit=50;
 const draw=()=>{const term=view.querySelector('[data-data-filter]').value.toLocaleLowerCase(),visible=rows.filter(x=>JSON.stringify(x).toLocaleLowerCase().includes(term));view.querySelector('[data-data-tableview]').innerHTML='<table class="platform-table"><thead><tr>'+columns.map((c,i)=>'<th><button data-data-column="'+i+'">'+e(c.name||c)+'</button></th>').join('')+'</tr></thead><tbody>'+visible.map(row=>'<tr>'+columns.map((c,i)=>'<td>'+e(Array.isArray(row)?row[i]:row[c.name||c])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';view.querySelectorAll('[data-data-column]').forEach(button=>button.onclick=()=>{const c=columns[Number(button.dataset.dataColumn)];right.innerHTML='<h3>'+e(c.name||c)+'</h3><pre>'+e(JSON.stringify(c,null,2))+'</pre><p>字段事实来自数据库响应；不编造全库统计或 AI 洞察。</p>';});};
 const load=async()=>{if(!table)return;const result=await ctx.api('databases/'+encodeURIComponent(id)+'/read',{operation:'preview',table:table.name,schema:table.schema||'main',limit,offset});if(!view.isConnected)return;rows=result.rows||[];columns=result.columns||Object.keys(rows[0]||{});view.querySelector('[data-data-state]').textContent=table.name+' · 偏移 '+offset+' · 返回 '+rows.length+' 行 · 当前页过滤，不代表全库查询';view.querySelector('[data-data-prev]').disabled=offset===0;view.querySelector('[data-data-next]').disabled=rows.length<limit;draw();};
 left.querySelectorAll('[data-data-table]').forEach(button=>button.onclick=()=>ctx.action(async()=>{table=catalog.tables[Number(button.dataset.dataTable)];offset=0;await load();}));view.querySelector('[data-data-filter]').oninput=draw;view.querySelector('[data-data-prev]').onclick=()=>ctx.action(async()=>{offset=Math.max(0,offset-limit);await load();});view.querySelector('[data-data-next]').onclick=()=>ctx.action(async()=>{offset+=limit;await load();});view.querySelector('[data-data-export]').onclick=()=>{const cell=x=>{let value=String(x??'');if(/^[=+@-]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};const csv=[columns.map(x=>cell(x.name||x)).join(','),...rows.map(row=>columns.map((c,i)=>cell(Array.isArray(row)?row[i]:row[c.name||c])).join(','))].join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.href=url;a.download=(table?.name||'data')+'-page.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};await load();
}
