// ============================================================
// 文件名: desktop_chat_v0001.mjs
// 中文名: 桌面聊天面板与安全文本呈现
// 版本号: v0001
// 主层级: action
// 层级: development / independent_action_chat / web
// 脚本定位: 原有聊天控件的显示层增强
// 职责说明:
// - 历史搜索、配置标签、宽度调整和工作台主题协调
// 本脚本做什么:
// - 将消息中的常见 Markdown 与代码安全渲染为 DOM
// 本脚本不做什么:
// - 不改变消息请求、会话存储、模型选择或权限逻辑
// 制度边界声明:
// - 不执行消息 HTML；主题消息只能来自同一嵌入父窗口
// 可更新: True
// ============================================================
// ALIAS_META
// alias: desktop_chat_v0001
// family: desktop_chat
// role: chat_presentation_adapter
// version: v0001
// status: active
// entry_point: scripts/action/development/scripts/independent_action_chat/web/desktop_chat_v0001.mjs
// input:
//   - existing chat DOM and verified parent appearance messages
// output:
//   - contextual panel display and sanitized message presentation
// depends_on:
//   - app_v0006 and Browser DOM
// used_by:
//   - index_v0010.html
// ============================================================
const SCRIPT_NAME='desktop_chat_v0001',SCRIPT_FAMILY='desktop_chat',SCRIPT_VERSION='v0001',DEFAULT_ENCODING='utf8';
const byId=id=>document.getElementById(id),processed=new WeakSet();
function inline(text,node){const re=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;let at=0;for(const match of text.matchAll(re)){node.append(document.createTextNode(text.slice(at,match.index)));const token=match[0];let child;if(token.startsWith('`')){child=document.createElement('code');child.textContent=token.slice(1,-1);}else if(token.startsWith('**')){child=document.createElement('strong');child.textContent=token.slice(2,-2);}else{const link=token.match(/^\[([^\]]+)\]\((.+)\)$/),url=new URL(link[2]);child=document.createElement('a');child.textContent=link[1];child.href=url.href;child.target='_blank';child.rel='noopener noreferrer';}node.append(child);at=match.index+token.length;}node.append(document.createTextNode(text.slice(at)));}
function renderMessages(){for(const body of document.querySelectorAll('.message-body')){if(processed.has(body))continue;processed.add(body);const text=body.textContent;body.replaceChildren();const parts=text.split(/```([^\n`]*)\n([\s\S]*?)```/);for(let i=0;i<parts.length;i+=3){for(const line of parts[i].split('\n')){if(/^#{1,6}\s/.test(line)){const heading=document.createElement('h3');inline(line.replace(/^#{1,6}\s/,''),heading);body.append(heading);}else{const span=document.createElement('span');inline(line,span);body.append(span,document.createTextNode('\n'));}}if(i+2<parts.length){const pre=document.createElement('pre'),code=document.createElement('code'),copy=document.createElement('button');code.textContent=parts[i+2];code.dataset.language=parts[i+1].trim();copy.type='button';copy.className='copy-code secondary';copy.textContent='复制代码';copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.textContent);copy.textContent='已复制';}catch{copy.textContent='复制未获许可，请选择代码复制';}};pre.append(copy,code);body.append(pre);}}}}
function main(){
 const tabs=[...document.querySelectorAll('[data-chat-tab]')];const select=id=>{tabs.forEach(x=>x.setAttribute('aria-selected',String(x.dataset.chatTab===id)));document.querySelectorAll('[data-chat-panel]').forEach(x=>x.hidden=x.dataset.chatPanel!==id);};
 tabs.forEach(button=>{button.onclick=()=>select(button.dataset.chatTab);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=tabs[(tabs.indexOf(button)+1)%tabs.length];next.focus();next.click();}};});
 byId('activeModel').onclick=()=>{if(document.querySelector('.workspace').classList.contains('settings-hidden'))byId('toggleSettings').click();select('config');byId('aiSettingsCard').open=true;byId('aiStage').value='answer';byId('aiStage').dispatchEvent(new Event('change'));};
 byId('historySearch').oninput=e=>{const text=e.target.value.toLocaleLowerCase();document.querySelectorAll('.history-item').forEach(x=>x.hidden=!(x.dataset.sessionSearch||x.textContent.toLocaleLowerCase()).includes(text));};
 let width=252;try{const stored=Number(localStorage.getItem('action-chat.desktop.width'));if(Number.isFinite(stored)&&stored>=180&&stored<=460)width=stored;}catch{}
 const apply=()=>document.documentElement.style.setProperty('--chat-sidebar-width',width+'px'),save=()=>{try{localStorage.setItem('action-chat.desktop.width',String(width));}catch{}};apply();const splitter=byId('chatSidebarSplitter');splitter.onpointerdown=e=>{const start=e.clientX,original=width;splitter.setPointerCapture(e.pointerId);splitter.onpointermove=move=>{width=Math.max(180,Math.min(Math.min(460,innerWidth*.6),original+move.clientX-start));apply();};splitter.onpointerup=()=>{splitter.onpointermove=null;save();};};splitter.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();width=Math.max(180,Math.min(460,width+(e.key==='ArrowRight'?15:-15)));apply();save();}};
 const observer=new MutationObserver(renderMessages);observer.observe(byId('messages'),{childList:true,subtree:true});renderMessages();
 let parentOrigin=null;try{const url=new URL(document.referrer);if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port)parentOrigin=url.origin;}catch{}
 const receive=event=>{if(event.source!==window.parent||!parentOrigin||event.origin!==parentOrigin||event.data?.schema_version!=='workbench.theme.v1')return;const ocean=event.data.theme==='star-ocean';document.documentElement.dataset.theme=ocean?'dark':'light';document.documentElement.dataset.workbenchTheme=ocean?'star-ocean':'base';};window.addEventListener('message',receive);document.addEventListener('keydown',event=>{if(!parentOrigin||window.parent===window)return;const command=event.key==='F10'?'menu':event.ctrlKey&&event.key==='Tab'?(event.shiftKey?'previous':'next'):event.ctrlKey&&event.key.toLowerCase()==='w'?'close':null;if(command){event.preventDefault();window.parent.postMessage({schema_version:'workbench.ui-shortcut.v1',command},parentOrigin);}});if(parentOrigin&&window.parent!==window)window.parent.postMessage({schema_version:'workbench.theme.request.v1'},parentOrigin);
 window.addEventListener('beforeunload',()=>{observer.disconnect();window.removeEventListener('message',receive);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',main,{once:true});else main();
