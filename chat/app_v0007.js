// ============================================================
// 文件名: app_v0007.js
// 中文名: 独立 Action Chat 黑白双栏交互脚本
// 版本号: v0007
//
// 主层级: action
// 层级: development / independent_action_chat / web_ui
// 脚本定位: 浏览器展示与公开 Chat Service API 的交互适配器
//
// 职责说明:
// - 管理左右布局、黑白主题、消息展示与用户操作反馈
// - 复用已有保存和停止接口，明确保存失败时禁止停服
//
// 本脚本做什么:
// - 从公开 API 取得模型和运行状态，安全渲染文本并提交操作
// - 显式操作本机 AI 管理开关，读取真实许可，不自动授权
//
// 本脚本不做什么:
// - 不读取密钥，不复制模型、路由、检索或会话持久化业务逻辑
//
// 制度边界声明:
// - 原生页面以职责分区组织展示、交互和 API 适配，业务仍在后端
// - 不绑定页面卸载停服；刷新和普通关闭标签页不停止共享服务
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: independent_action_chat_web_app_v0007
// family: independent_action_chat_web_app
// role: browser_ui_controller
// version: v0007
// status: active
// entry_point: scripts/action/development/scripts/independent_action_chat/web/app_v0007.js
// input:
//   - user interface events and public JSON API
// output:
//   - safe DOM rendering and runtime control requests
// depends_on:
//   - Browser Fetch and DOM APIs
// used_by:
//   - web/index.html
// ============================================================

"use strict";

const DEFAULT_ENCODING = "utf-8";
const SCRIPT_FAMILY = "independent_action_chat_web_app";
const SCRIPT_NAME = "independent_action_chat_web_app_v0007";
const SCRIPT_VERSION = "v0007";
const THEME_STORAGE_KEY = "independent-action-chat-theme";

// ============================================================
// 异常类型
// ============================================================

class ApiError extends Error {}

// ============================================================
// 数据结构
// ============================================================

let pendingAttachments=[];
const state = { providers: [], status: null, busy: false, stopped: false, ready: false,
  permissions: null, displayedSessionId: null, historyEnabled: false, historyMessages: [], nextBefore: 0 };
const byId = (id) => document.getElementById(id);

// ============================================================
// 工具函数区 — 公开 API 输入输出适配，不包含业务编排
// ============================================================

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new ApiError("无法连接本地服务。请检查启动窗口；若已停服，请重新运行 CMD。");
  }
  const payload = await response.json();
  if (!response.ok || payload.status === "error") {
    throw new ApiError(payload.error?.detail || `HTTP ${response.status}`);
  }
  return payload;
}

const post = (path, payload = {}) => api(path, {
  method: "POST", headers:{"Content-Type":"application/json","X-Action-Session-Intent":"1"}, body: JSON.stringify({
    ...payload, ...(state.displayedSessionId ? { expected_session_id: state.displayedSessionId } : {}),
  }),
});
const providerById = (id) => state.providers.find((item) => item.provider_id === id);
const notice = (text) => { byId("actionNotice").textContent = text; };
const showStatus = (value) => { byId("statusBar").textContent = JSON.stringify(value, null, 2); };

function fillProviders(select, selected) {
  select.replaceChildren();
  state.providers.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider.provider_id;
    option.textContent = `${provider.display_name}${provider.available ? "" : ` · ${provider.message}`}`;
    option.disabled = !provider.available;
    option.selected = provider.provider_id === selected;
    select.append(option);
  });
}

function fillModels(providerSelect, modelSelect, selected) {
  modelSelect.replaceChildren();
  (providerById(providerSelect.value)?.models || []).forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.display_name || model.id;
    option.selected = model.id === selected;
    modelSelect.append(option);
  });
}

// ============================================================
// 默认映射
// ============================================================


const ROUTER_LABELS = { off: "关闭", machine_only: "本地规则", hybrid: "混合判断", ai_only: "AI 判断" };
const RETRIEVAL_LABELS = { off: "关闭", always: "每轮检索", router: "由路由判断" };

// ============================================================
// 展示函数区 — 仅管理 DOM 和界面偏好
// ============================================================

function setTheme(theme) {
  const selected = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selected;
  byId("darkTheme").setAttribute("aria-pressed", String(selected === "dark"));
  byId("lightTheme").setAttribute("aria-pressed", String(selected === "light"));
  try { localStorage.setItem(THEME_STORAGE_KEY, selected); } catch { /* 禁用存储时仍允许切换。 */ }
}

function syncTemperature(kind, restore = false) {
  const input = byId(kind + "Temperature");
  const model = providerById(byId(kind + "Provider").value)?.models.find(
    (item) => item.id === byId(kind + "Model").value,
  );
  const policy = model?.temperature_policy || { min: 0, max: 2, fixed: null };
  const current = state.status?.session[kind + "_temperature"] ?? (kind === "router" ? 0 : 0.2);
  const fixed = policy.fixed !== null && policy.fixed !== undefined;
  input.min = String(policy.min);
  input.max = String(policy.max);
  if (restore) {
    input.dataset.editableValue = String(current);
    input.value = String(current);
  }
  if (fixed) {
    if (input.dataset.fixed !== "true") input.dataset.editableValue = input.value || String(current);
    input.value = String(policy.fixed);
  } else if (input.dataset.fixed === "true") {
    input.value = input.dataset.editableValue || String(current);
  }
  input.dataset.fixed = String(fixed);
  input.disabled = fixed || state.busy || state.stopped || !state.ready;
  byId(kind + "TemperatureHint").textContent = fixed
    ? "K3 固定为 1.0，后台也会强制校验。"
    : "数值越低通常越稳定；请遵守服务商支持范围。点击应用后生效。";
}

function selectionPayload(kind) {
  const input = byId(kind + "Temperature");
  if (!input.value.trim() || !Number.isFinite(Number(input.value))
      || Number(input.value) < Number(input.min || 0) || Number(input.value) > Number(input.max || 2)
      || !input.reportValidity()) {
    throw new ApiError("请输入有效的 temperature 数字。");
  }
  return { provider: byId(kind + "Provider").value, model: byId(kind + "Model").value,
    temperature: Number(input.value) };
}

function updateControls() {
  renderAttachments();
  document.querySelectorAll("[data-service]").forEach((element) => {
    element.disabled = state.busy || state.stopped || !state.ready;
  });
  byId("retrievalOptions").disabled = byId("retrievalMode").value === "off";
  byId("retrievalHint").textContent = byId("retrievalMode").value === "off"
    ? "关闭时不会查询数据库；下方勾选暂不生效。"
    : "查询勾选的数据源；各库独立执行。AI 策略模式使用已保存的模型或 Agent 生成查询；固定统计能力不额外调用 AI。";
  byId("sendMessage").textContent = state.busy ? "处理中…" : "发送 ↑";
  byId("connectionStatus").textContent = state.stopped ? "已停止" : state.busy ? "处理中" : state.ready ? "已连接" : "未连接";
  byId("messages").setAttribute("aria-busy", String(state.busy));
  const mismatch = state.displayedSessionId && state.status?.session.session_id !== state.displayedSessionId;
  if (mismatch) {
    ["sendMessage", "messageInput", "saveSession", "exitService"].forEach((id) => { byId(id).disabled = true; });
  }
  if (!state.historyEnabled) byId("refreshHistory").disabled = true;
  document.querySelectorAll("[data-unreadable]").forEach((button) => { button.disabled = true; });
  byId("loadOlder").hidden = !state.historyEnabled || state.nextBefore <= 0;
  ["toggleGlobalAI", "toggleAppAI", "toggleAIRunning"].forEach((id) => {
    byId(id).disabled = state.busy || state.stopped || !state.ready || !state.permissions;
  });
  syncTemperature("answer");
  syncTemperature("router");
}

function addMessage(role, text, metadata = {}, scroll = true) {
  byId("emptyState").hidden = true;
  const node = document.createElement("article");
  node.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "你" : role === "assistant" ? (metadata.model ? `${metadata.provider || "AI"} / ${metadata.model}` : byId("activeModel").textContent) : "提示";
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = text;
  node.append(label, body);
  if (metadata.attachments?.length) {
    const files = document.createElement("div"); files.className = "message-attachments";
    for (const attachment of metadata.attachments) {
      const link = document.createElement("a");
      link.href = `/api/chat/attachments/${encodeURIComponent(attachment.id)}?session_id=${encodeURIComponent(metadata.session_id || state.displayedSessionId)}`;
      link.textContent = "📎 " + attachment.name; link.target = "_blank"; link.rel = "noopener"; files.append(link);
      if (attachment.kind === "image") { const image = document.createElement("img"); image.src = link.href; image.alt = attachment.name; image.loading = "lazy"; files.append(image); }
    }
    node.append(files);
  }
  if (metadata.answer_truncated) {
    const warning = document.createElement("p"); warning.className = "hint";
    warning.textContent = "回答达到模型输出上限，内容未完成。可发送“继续”接着回答。";
    node.append(warning);
  }
  const messages = byId("messages");
  messages.append(node);
  if (scroll) messages.scrollTop = messages.scrollHeight;
}

async function refreshAIPermissions() {
  try {
    const p = await api("/api/admin/ai-permissions");
    state.permissions = p;
    byId("toggleGlobalAI").textContent = `AI 总许可：${p.global_enabled ? "已开启 · 点击关闭" : "已关闭 · 点击开启"}`;
    byId("toggleAppAI").textContent = `聊天应用许可：${p.app_allowed ? "已开启 · 点击关闭" : "已关闭 · 点击开启"}`;
    byId("toggleGlobalAI").setAttribute("aria-checked", String(p.global_enabled));
    byId("toggleAppAI").setAttribute("aria-checked", String(p.app_allowed));
    byId("toggleAIRunning").textContent = p.app_running ? "暂停聊天 AI" : "启动聊天 AI";
    byId("aiPermissionSummary").textContent = p.global_enabled && p.app_allowed ? "许可已开启" : "许可未全部开启";
    byId("aiPermissionStatus").textContent = `应用：${p.app_id} · ${p.retired ? "已停用" : p.app_running ? "AI 已启动" : "AI 未启动"}。模型可用性在请求时检查。`;
    return p;
  } catch (error) {
    state.permissions = null;
    byId("aiPermissionSummary").textContent = "读取失败";
    byId("aiPermissionStatus").textContent = error.message;
    throw error;
  } finally { updateControls(); }
}

async function changeAIPermission(scope) {
  const p = await refreshAIPermissions();
  const enabled = !(scope === "global" ? p.global_enabled : p.app_allowed);
  try {
    await api("/api/admin/ai-permissions", { method: "POST",
      headers: { "Content-Type": "application/json", "X-Action-Admin": "1" },
      body: JSON.stringify({ scope, enabled }) });
  } finally { await refreshAIPermissions(); }
}

function aiStageModels(selected) {
  const agent = byId("aiKind").value === "agent";
  const choices = agent ? (state.aiSettings?.agents || []).map(x => ({id:x.id,display_name:x.display_name,available:x.available}))
    : (providerById(byId("aiProvider").value)?.models || []);
  byId("aiModel").replaceChildren();
  choices.forEach(model => {
    const option=document.createElement("option"); option.value=model.id;
    option.textContent=(model.display_name || model.id)+(model.available===false ? " · 未配置" : "");
    option.disabled=model.available===false; option.selected=model.id===selected;
    byId("aiModel").append(option);
  });
  aiStageHint();
}

function aiStageProviders(selectedProvider,selectedModel) {
  const agent=byId("aiKind").value === "agent";
  byId("aiProvider").replaceChildren();
  state.providers.filter(x => agent ? x.provider_id==="local_agents" : x.provider_id!=="local_agents").forEach(provider => {
    const option=document.createElement("option"); option.value=provider.provider_id; option.textContent=provider.display_name;
    option.selected=provider.provider_id===selectedProvider; byId("aiProvider").append(option);
  });
  aiStageModels(selectedModel);
}

function aiStageHint() {
  const agent=byId("aiKind").value === "agent";
  const descriptor=state.aiSettings?.agents?.find(x => x.id===byId("aiModel").value);
  byId("aiConnectionHint").textContent=agent
    ? `${descriptor?.message || "尚未配置"}。通过总控运行受控文本任务；不开放命令执行。temperature 和模型输出额度不适用于此 CLI，受总控超时与返回大小限制。`
    : "通过 AI 总控调用。保存设置不产生请求，测试和发送消息会调用所选对象。";
  byId("aiTemperature").readOnly=agent;
  byId("aiBudget").readOnly=agent;
}

function renderAIStage() {
  const item=state.aiSettings?.stages?.[byId("aiStage").value]; if(!item)return;
  byId("aiKind").value=item.kind;
  byId("aiPrompt").value=item.prompt;
  byId("aiTemperature").value=item.temperature;
  byId("aiBudget").value=item.max_output_tokens;
  aiStageProviders(item.provider,item.model);
  const planner=state.aiSettings.stages.planner;
  byId("retrievalAISelection").textContent=`已保存的检索策略接入：${planner.kind === "agent" ? "Agent" : "模型"} · ${planner.provider} / ${planner.model}。设置与正式回答独立。`;
  const embedding=state.aiSettings.embedding;
  byId("aiEmbeddingHint").textContent=`向量编码：${embedding.provider || "未配置"} / ${embedding.model || "未配置"}。${embedding.message}`;
}

async function refresh() {
  const [runtime, catalog] = await Promise.all([api("/api/status"), api("/api/providers")]);
  state.status = runtime;
  state.providers = catalog.providers;
  state.aiSettings = await api("/api/ai/settings");
  renderAIStage();
  state.ready = true;
  const session = runtime.session;
  byId("activeModel").textContent = `${providerById(session.answer_provider)?.display_name || session.answer_provider} / ${session.answer_model}`;
  byId("sessionLabel").textContent = `当前会话 · ${session.turn_count} 轮`;
  byId("sessionLabel").title = session.session_id;
  byId("emptyHint").textContent = session.turn_count > 0
    ? `当前会话已有 ${session.turn_count} 轮，可从左侧历史列表选取会话。`
    : "在下方输入消息，左侧可随时切换模型。";
  fillProviders(byId("answerProvider"), session.answer_provider);
  fillModels(byId("answerProvider"), byId("answerModel"), session.answer_model);
  fillProviders(byId("routerProvider"), session.router_provider);
  fillModels(byId("routerProvider"), byId("routerModel"), session.router_model);
  syncTemperature("answer", true);
  syncTemperature("router", true);
  byId("routerMode").value = session.router_mode;
  byId("routerSummary").textContent = ROUTER_LABELS[session.router_mode] || session.router_mode;
  byId("retrievalMode").value = runtime.retrieval.mode || "off";
  byId("retrievalSummary").textContent = RETRIEVAL_LABELS[byId("retrievalMode").value];
  byId("queryMode").value = runtime.retrieval.query_mode || "controlled";
  byId("topK").value = runtime.retrieval.top_k || 10;
  const container = byId("sourceChoices");
  container.replaceChildren();
  (runtime.retrieval.sources || []).forEach((source) => {
    const label = document.createElement("label"); label.className = "check";
    const input = document.createElement("input"); input.type = "checkbox";
    input.dataset.sourceId = source.source_id; input.dataset.service = "";
    input.checked = (runtime.retrieval.selected_sources || []).includes(source.source_id);
    label.append(input, document.createTextNode(source.label + " (" + source.backend + ")"));
    container.append(label);
  });
  state.historyEnabled = runtime.capabilities?.session_history === true;
  if (state.historyEnabled) {
    await refreshHistoryList();
  } else {
    byId("historyStatus").textContent = "旧后台尚未重启：请保存并退出，再运行 CMD 开启历史功能。";
  }
  showStatus(runtime);
  try { await refreshAIPermissions(); } catch { /* SQL and history remain usable. */ }
  updateControls();
}

async function guarded(action, successText) {
  if (state.busy || state.stopped) return null;
  state.busy = true;
  updateControls();
  notice("正在处理，请稍候…");
  try {
    const result = await action();
    showStatus(result);
    if (successText) notice(typeof successText === "function" ? successText(result) : successText);
    return result;
  } catch (error) {
    showStatus({ status: "error", detail: error.message });
    notice(`操作未完成：${error.message}`);
    return null;
  } finally {
    state.busy = false;
    updateControls();
  }
}

// ============================================================
// 历史展示与恢复 — 读取已有记录，不创建会话副本
// ============================================================

function sessionDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { hour12: false });
}

async function refreshHistoryList() {
  const result = await api("/api/sessions");
  const list = byId("historyList");
  list.replaceChildren();
  result.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item secondary";
    button.setAttribute("data-service", "");
    button.setAttribute("aria-current", String(session.session_id === state.displayedSessionId));
    button.setAttribute("aria-label", `继续会话：${session.title || "空会话"} · ${session.session_id.slice(-8)}`);
    button.title = session.session_id;
    button.dataset.sessionType=session.session_type||"normal_chat";
    button.dataset.sessionSearch = [session.title,session.session_id,session.updated_at,session.created_at].filter(Boolean).join(" ").toLocaleLowerCase();
    if (session.readable === false) button.setAttribute("data-unreadable", "");
    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = (session.session_type==="tool_development"?"[工具开发] ":"")+(session.title || "空会话");
    const detail = document.createElement("span");
    detail.className = "history-detail";
    detail.textContent = `${sessionDate(session.updated_at || session.created_at)} · ${session.turn_count || 0} 轮`;
    button.append(title, detail);
    button.addEventListener("click", () => restoreConversation(session.session_id));
    list.append(button);
  });
  byId("historyStatus").textContent = result.sessions.length
    ? `共 ${result.sessions.length} 个会话 · 续聊保存到原目录` : "还没有历史会话。";
  document.getElementById("historySearch")?.dispatchEvent(new Event("input"));
  updateControls();
  list.querySelectorAll("[data-unreadable]").forEach((button) => { button.disabled = true; });
  return result;
}

function renderConversation(snapshot, prepend = false) {
  if (prepend && snapshot.session.session_id !== state.displayedSessionId) {
    throw new ApiError("会话已经变化，请刷新后重试。");
  }
  renderDevelopment(snapshot.session);
  const messages = byId("messages");
  const oldHeight = messages.scrollHeight;
  const oldTop = messages.scrollTop;
  state.historyMessages = prepend ? [...snapshot.messages, ...state.historyMessages] : snapshot.messages;
  state.displayedSessionId = snapshot.session.session_id;
  state.nextBefore = snapshot.next_before;
  messages.querySelectorAll(".message").forEach((node) => node.remove());
  byId("emptyState").hidden = state.historyMessages.length > 0;
  state.historyMessages.forEach((message) => addMessage(
    message.role === "system" ? "meta" : message.role, message.content, message, false,
  ));
  messages.scrollTop = prepend ? oldTop + messages.scrollHeight - oldHeight : messages.scrollHeight;
  byId("historyPageStatus").textContent = `已显示 ${state.historyMessages.length} / ${snapshot.total} 条消息`;
  byId("historyToolbar").hidden = !state.historyEnabled;
  byId("serviceBanner").hidden = true;
  document.querySelectorAll(".history-item").forEach((button) => {
    button.setAttribute("aria-current", String(button.title === state.displayedSessionId));
  });
  updateControls();
}

async function loadCurrentConversation() {
  if (!state.historyEnabled) return;
  state.ready = false;
  const snapshot = await api("/api/chat/messages");
  // 状态和消息必须属于同一会话。出现其他页面切换时禁止误发，要求刷新。
  if (snapshot.session.session_id !== state.status.session.session_id) {
    throw new ApiError("活动会话刚刚变化，请刷新页面重新同步。");
  }
  renderConversation(snapshot);
  state.ready = true;
  updateControls();
}

async function restoreConversation(sessionId) {
  if (state.busy || state.stopped || !state.historyEnabled) return;
  if (sessionId !== state.displayedSessionId && (byId("messageInput").value || pendingAttachments.length)
      && !window.confirm("切换会话将清空未发送草稿，已发送记录不会丢失。继续吗？")) return;
  await guarded(async () => {
    const changed = sessionId !== state.displayedSessionId;
    let snapshot;
    try {
      snapshot = await post("/api/chat/restore", { session_id: sessionId });
    } catch (error) {
      // HTTP 响应可能丢失，不能假定后台还停留在旧会话。
      state.ready = false;
      throw new ApiError(`${error.message} 请刷新页面核对当前会话；草稿仍保留。`);
    }
    renderConversation(snapshot);
    if (changed) {byId("messageInput").value = ""; clearAttachments();}
    await refresh();
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.querySelector(".workspace").classList.remove("settings-open");
      byId("toggleSettings").setAttribute("aria-expanded", "false");
    }
    return { status: "ok", session_id: sessionId };
  }, "已恢复历史会话。继续发送会追加到原记录，保存仍使用原目录。");
}

// ============================================================
// Schema / 契约辅助函数
// ============================================================

function retrievalSettings() {
  return {
    query_mode: byId("queryMode").value,
    selected_sources: Array.from(document.querySelectorAll("[data-source-id]:checked")).map((input) => input.dataset.sourceId),
    top_k: Number(byId("topK").value),
  };
}

async function saveVerified() {
  const result = await post("/api/chat/save");
  if (result.status !== "completed" || result.verified !== true || !result.path) {
    throw new ApiError("保存结果未通过校验，后台服务保持运行。请查看运行详情。");
  }
  return result;
}

// ============================================================
// 用户操作适配区 — 使用已有端点，不改变后台生命周期
// ============================================================

async function sendMessage(event) {
  event.preventDefault();
  if (state.busy || state.stopped || !state.ready) return;
  const input = byId("messageInput");
  const text = input.value.trim();
  if (!text && !pendingAttachments.length) return;
  await guarded(async () => {
    const ids = pendingAttachments.map(a=>a.id);
    await post("/api/chat/attachments/validate", {message:text,attachments:ids});
    addMessage("user", text || "请分析上传的附件。", {attachments:pendingAttachments});
    input.value = "";
    let result;
    try {
      result = await post("/api/chat/send", { message: text, attachments: ids });
    } catch (error) {
      input.value = text;
      addMessage("meta", "未取得回答，输入已恢复。请求可能已被后台接收，请确认后再重试。");
      throw error;
    }
    clearAttachments();
    if (result.response_text) addMessage("assistant", result.response_text, result);
    // 发送后重新读取已落盘的分页历史，避免重载更早记录时丢失本轮消息。
    // 回答已经成功时，状态刷新失败不能把同一问题恢复为待发送。
    try { await refresh(); await loadCurrentConversation(); } catch (error) { addMessage("meta", `回答已收到；状态刷新失败：${error.message}`); }
    return result;
  }, (result) => result.save_error
    ? "回答已收到，但自动保存失败。请点击保存重试，详情见运行详情。"
    : result.answer_truncated ? "回答达到输出上限，尚未完成；可发送“继续”。" : "回答已完成。");
  if (!state.stopped) input.focus();
}

async function saveAndExit() {
  byId("exitDialog").close();
  await guarded(async () => {
    const saved = await saveVerified();
    let result;
    try {
      result = await post("/api/admin/shutdown");
    } catch (error) {
      throw new ApiError(`会话已保存至 ${saved.path}，但未收到停服确认：${error.message}`);
    }
    if (result.status !== "stopping") throw new ApiError(`已保存至 ${saved.path}，但服务未确认停止。`);
    state.stopped = true;
    byId("serviceBanner").hidden = false;
    byId("serviceBanner").textContent = "会话已保存，后台已接受停止请求。可以关闭此页面；再次使用请运行原来的 CMD。";
    return saved;
  }, (saved) => `已保存至：${saved.path}`);
}

// ============================================================
// CLI / main 接口区
// ============================================================

async function main() {
  installDevelopment();
  byId("configureRetrievalAI").addEventListener("click",()=>{
    byId("aiStage").value="planner";
    renderAIStage();
    byId("aiSettingsCard").open=true;
    byId("aiSettingsCard").scrollIntoView({block:"start"});
    byId("aiKind").focus({preventScroll:true});
  });
  byId("aiStage").addEventListener("change",renderAIStage);
  byId("aiKind").addEventListener("change",()=>aiStageProviders());
  byId("aiProvider").addEventListener("change",()=>aiStageModels());
  byId("aiModel").addEventListener("change",aiStageHint);
  byId("saveAIStage").addEventListener("click",()=>guarded(async()=>{
    const settings={kind:byId("aiKind").value,provider:byId("aiProvider").value,model:byId("aiModel").value,
      prompt:byId("aiPrompt").value,temperature:Number(byId("aiTemperature").value),max_output_tokens:Number(byId("aiBudget").value)};
    const result=await post("/api/ai/settings",{stage:byId("aiStage").value,settings});
    await refresh(); return result;
  },"当前环节的接入与提示词已保存。"));
  byId("testAIStage").addEventListener("click",()=>guarded(async()=>{
    byId("aiTestResult").textContent="正在测试已保存的接入…";
    try {
      const result=await post("/api/ai/test",{stage:byId("aiStage").value});
      byId("aiTestResult").textContent=`${result.model}：${result.response}`;return result;
    } catch(error) {byId("aiTestResult").textContent=`测试失败：${error.message}`;throw error;}
  },"接入测试已完成。"));
  byId("toggleGlobalAI").addEventListener("click", () => guarded(() => changeAIPermission("global"), "AI 总许可已更新。"));
  byId("toggleAppAI").addEventListener("click", () => guarded(() => changeAIPermission("application"), "聊天应用许可已更新。"));
  byId("refreshAIPermissions").addEventListener("click", () => guarded(refreshAIPermissions, "权限状态已刷新。"));
  byId("toggleAIRunning").addEventListener("click", () => guarded(async () => {
    const p = await refreshAIPermissions();
    try { await post("/api/ai/running", { running: !p.app_running }); }
    finally { await refreshAIPermissions(); }
  }, "聊天 AI 启动状态已更新。"));
  let theme = "dark";
  try { theme = localStorage.getItem(THEME_STORAGE_KEY) || theme; } catch { /* 无存储权限时使用默认主题。 */ }
  setTheme(theme);
  byId("darkTheme").addEventListener("click", () => setTheme("dark"));
  byId("lightTheme").addEventListener("click", () => setTheme("light"));
  const narrow = window.matchMedia("(max-width: 760px)");
  const workspace = document.querySelector(".workspace");
  let sidebarVisible = !narrow.matches;
  try { const saved = localStorage.getItem("action-chat.sidebar.visible"); if(saved!==null) sidebarVisible=saved==="true"; } catch {}
  const syncSidebar = () => {
    workspace.classList.toggle("settings-hidden", !sidebarVisible);
    workspace.classList.toggle("settings-open", narrow.matches && sidebarVisible);
    byId("toggleSettings").setAttribute("aria-expanded", String(sidebarVisible));
    byId("toggleSettings").textContent=sidebarVisible?"收起侧栏":"展开侧栏";
  };
  const toggleSidebar = () => {sidebarVisible=!sidebarVisible;try{localStorage.setItem("action-chat.sidebar.visible",String(sidebarVisible));}catch{}syncSidebar();};
  syncSidebar(); narrow.addEventListener("change", syncSidebar);
  byId("toggleSettings").addEventListener("click", toggleSidebar);
  byId("collapseSettings").addEventListener("click", toggleSidebar);
  installAttachments();
  ["answer", "router"].forEach((kind) => {
    byId(kind + "Provider").addEventListener("change", () => {
      fillModels(byId(kind + "Provider"), byId(kind + "Model"), "");
      syncTemperature(kind);
    });
    byId(kind + "Model").addEventListener("change", () => syncTemperature(kind));
  });
  byId("retrievalMode").addEventListener("change", updateControls);
  byId("applyAnswer").addEventListener("click", () => guarded(async () => {
    const result = await post("/api/model/selection", selectionPayload("answer"));
    await refresh(); return result;
  }, "回答模型与 temperature 已应用。"));
  byId("applyRouter").addEventListener("click", () => guarded(async () => {
    const result = await post("/api/router/selection", { ...selectionPayload("router"), mode: byId("routerMode").value });
    await refresh(); return result;
  }, "路由设置已应用。"));
  byId("applyRetrieval").addEventListener("click", () => {
    if (byId("retrievalMode").value !== "off"
        && !byId("topK").reportValidity()) return;
    return guarded(async () => {
      if (byId("retrievalMode").value !== "off") {
        await post("/api/retrieval/settings", { settings: retrievalSettings() });
      }
      const result = await post("/api/retrieval/mode", { mode: byId("retrievalMode").value });
      await refresh(); return result;
    }, "检索设置已应用。");
  });
  byId("queryOnly").addEventListener("click", () => guarded(async () => {
    await post("/api/retrieval/settings", { settings: retrievalSettings() });
    const result = await post("/api/retrieval/query", { message: byId("messageInput").value });
    document.querySelector(".diagnostics").open = true;
    return result;
  }, "检索已完成，结果与来源见运行详情；未请求生成回答。"));
  byId("probeBackends").addEventListener("click", () => guarded(async () => {
    const result = await api("/api/retrieval/status?probe=1");
    document.querySelector(".diagnostics").open = true;
    return result;
  }, "数据库检查已完成，结果见左侧运行详情。"));
  byId("newSession").addEventListener("click", () => {
    if ((state.status?.session.turn_count > 0 || byId("messageInput").value || pendingAttachments.length)
        && !window.confirm("创建新会话？原会话仍保留在后台，输入框中未发送的内容将清空。")) return;
    return guarded(async () => {
      const result = await post("/api/chat/new");
      byId("messages").querySelectorAll(".message").forEach((node) => node.remove());
      byId("emptyState").hidden = false;
      byId("messageInput").value = "";
      clearAttachments();
      state.displayedSessionId = result.session.session_id;
      await refresh(); await loadCurrentConversation(); return result;
    }, "新会话已就绪。");
  });
  byId("saveSession").addEventListener("click", () => guarded(saveVerified, (result) => `已保存至：${result.path}`));
  byId("exitService").addEventListener("click", () => {
    if (!state.busy && !state.stopped) byId("exitDialog").showModal();
  });
  byId("cancelExit").addEventListener("click", () => byId("exitDialog").close());
  byId("confirmExit").addEventListener("click", saveAndExit);
  byId("chatForm").addEventListener("submit", sendMessage);
  byId("messageInput").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      if (!state.busy && !state.stopped) byId("chatForm").requestSubmit();
    }
  });
  updateControls();
  byId("refreshHistory").addEventListener("click", () => guarded(refreshHistoryList, "历史列表已刷新。"));
  byId("loadOlder").addEventListener("click", () => guarded(async () => {
    const result = await api(`/api/chat/messages?session_id=${encodeURIComponent(state.displayedSessionId)}&before=${state.nextBefore}`);
    renderConversation(result, true);
    return { status: "ok", displayed: state.historyMessages.length };
  }, "已加载更早的消息。"));
  await guarded(async () => {
    await refresh();
    await loadCurrentConversation();
    const query=new URLSearchParams(location.search);
    if(query.get("intent")&&query.get("type")==="tool_development"){const created=await post("/api/chat/new",{session_type:"tool_development",intent_id:query.get("intent")});state.displayedSessionId=created.session.session_id;history.replaceState(null,"",location.pathname+"?workbench="+(query.get("workbench")||"0"));await refresh();await loadCurrentConversation();}
    else if(query.get("session")){await restoreConversation(query.get("session"));history.replaceState(null,"",location.pathname+"?workbench="+(query.get("workbench")||"0"));}
    return { status: "ok" };
  }, () => state.historyEnabled ? "已连接，历史记录已恢复。可直接续聊，或从左侧选择其他会话。" : "已连接旧后台。请保存并退出，再运行 CMD 开启历史功能。");
}

window.addEventListener("beforeunload",()=>{for(const item of pendingAttachments)if(item.preview)URL.revokeObjectURL(item.preview);});
main();

// Explicit uploads stay local until send; file content is never evaluated.
function clearAttachments(){for(const item of pendingAttachments)if(item.preview)URL.revokeObjectURL(item.preview);pendingAttachments=[];renderAttachments();}
function renderAttachments(){const list=byId("attachmentList");list.replaceChildren();for(const item of pendingAttachments){const chip=document.createElement("div");chip.className="attachment-chip";if(item.preview){const img=document.createElement("img");img.src=item.preview;img.alt=item.name;chip.append(img);}const name=document.createElement("span");name.textContent=item.name+" · "+Math.ceil(item.size/1024)+" KB";chip.append(name);const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label","移除 "+item.name);remove.disabled=state.busy;remove.onclick=()=>{if(item.preview)URL.revokeObjectURL(item.preview);pendingAttachments=pendingAttachments.filter(x=>x!==item);renderAttachments();};chip.append(remove);list.append(chip);}}
async function uploadFiles(files){if(state.busy||state.stopped||!state.ready)return;await guarded(async()=>{const caps=await api("/api/chat/attachments/status");for(const file of files){if(pendingAttachments.length>=caps.max_files)throw new ApiError("每轮最多 6 个附件");if(file.size>caps.max_file_bytes)throw new ApiError("单个附件最大 8 MB");const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new ApiError("文件读取失败"));reader.readAsDataURL(file);});const result=await post("/api/chat/attachments/upload",{name:file.name,data});const item=result.attachment;if(item.kind==="image")item.preview=URL.createObjectURL(file);pendingAttachments.push(item);renderAttachments();}return caps;},caps=>`附件已上传到本地，发送时才交给 AI。当前总控请求上限 ${Math.floor(caps.max_request_bytes/1024)} KB。`);byId("attachmentInput").value="";}
function installAttachments(){byId("addAttachment").onclick=()=>byId("attachmentInput").click();byId("attachmentInput").onchange=event=>void uploadFiles([...event.target.files]);byId("messageInput").addEventListener("paste",event=>{const files=[...event.clipboardData.files];if(files.length){event.preventDefault();void uploadFiles(files);}});const area=document.querySelector(".chat-panel")||byId("chatForm").parentElement;area.addEventListener("dragover",event=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();area.classList.add("file-dragging");}});area.addEventListener("dragleave",()=>area.classList.remove("file-dragging"));area.addEventListener("drop",event=>{area.classList.remove("file-dragging");if(event.dataTransfer.files.length){event.preventDefault();void uploadFiles([...event.dataTransfer.files]);}});}

function renderDevelopment(session){
 const dev=session.development,active=session.session_type==='tool_development';byId('sessionTypeBadge').textContent=active?'工具开发':'普通聊天';byId('convertDevelopment').hidden=active;byId('openDevelopment').hidden=!active;document.title=(active?'工具开发 · ':'')+'Action Chat';
 const labels={requirements_discussion:'需求讨论中',awaiting_confirmation:'等待开发确认',developing:'开发中',testing:'测试与验收中',integrated:'已接入工作台',paused:'已暂停',failed:'失败'};
 byId('developmentState').textContent=active?(labels[dev.task_state]||dev.task_state):'';
 if(!active)return;const panel=byId('developmentDialog');if(panel.dataset.session!==session.session_id)delete panel.dataset.dirty;panel.dataset.revision=dev.revision;panel.dataset.session=session.session_id;
 if(!panel.open||!panel.dataset.dirty){byId('developmentGoal').value=dev.requirements;byId('developmentPlan').value=dev.plan;}
 byId('developmentAudit').textContent=JSON.stringify({session_id:session.session_id,task_state:dev.task_state,project:dev.project,conversions:session.conversion_history,requirements_history:dev.requirements_history,executions:dev.executions,tests:dev.tests,approvals:dev.approvals,tools:dev.tools},null,2);
 const running=['developing','testing'].includes(dev.task_state);byId('developmentSave').disabled=byId('developmentSubmit').disabled=running;byId('developmentStart').disabled=!['awaiting_confirmation','paused','failed'].includes(dev.task_state)||!dev.requirements||window.parent===window;byId('developmentPreview').disabled=byId('developmentAccept').disabled=dev.task_state!=='testing';
 const linked=byId('developmentTools');linked.replaceChildren();for(const tool of dev.tools){const row=document.createElement('p');row.textContent=tool.name+' · '+tool.version+' · '+tool.id;const open=document.createElement('button');open.textContent='打开工具';open.onclick=()=>developmentBridge('openTool',{id:tool.id}).catch(e=>notice(e.message));row.append(open);linked.append(row);}
}
function developmentBridge(operation,input){return new Promise((resolve,reject)=>{if(window.parent===window)return reject(new Error('执行和发布请从 Workbench 打开本会话；独立聊天可继续讨论。'));let origin;try{origin=new URL(document.referrer).origin;}catch{return reject(new Error('无法确认工作台宿主'));}const id=crypto.randomUUID(),timer=setTimeout(()=>{window.removeEventListener('message',listen);reject(new Error('工作台未返回结果；请刷新实际状态后再操作'));},120000);const listen=event=>{if(event.source!==window.parent||event.origin!==origin||event.data?.schema_version!=='workbench.development.response.v1'||event.data.id!==id)return;clearTimeout(timer);window.removeEventListener('message',listen);event.data.error?reject(new Error(event.data.error)):resolve(event.data.result);};window.addEventListener('message',listen);window.parent.postMessage({schema_version:'workbench.development.request.v1',id,operation,input},origin);});}
function installDevelopment(){
 const filter=byId('historyType');filter.onchange=()=>byId('historySearch').dispatchEvent(new Event('input'));
 byId('convertDevelopment').onclick=()=>{byId('convertDevelopmentDialog').showModal();};byId('convertCancel').onclick=()=>byId('convertDevelopmentDialog').close();
 byId('convertConfirm').onclick=()=>guarded(async()=>{await post('/api/chat/convert',{target_type:'tool_development',confirmed:true});byId('convertDevelopmentDialog').close();await refresh();await loadCurrentConversation();},'已转换为工具开发会话；原消息与附件保留。请先讨论并确认最终开发目标。');
 byId('openDevelopment').onclick=()=>{renderDevelopment(state.status.session);byId('developmentDialog').showModal();};byId('developmentClose').onclick=()=>byId('developmentDialog').close();
 for(const id of ['developmentGoal','developmentPlan'])byId(id).oninput=()=>byId('developmentDialog').dataset.dirty='1';
 const refreshDev=async()=>{delete byId('developmentDialog').dataset.dirty;await refresh();await loadCurrentConversation();renderDevelopment(state.status.session);};
 for(const [id,submit] of [['developmentSave',false],['developmentSubmit',true]])byId(id).onclick=()=>guarded(async()=>{await post('/api/development/definition',{expected_revision:Number(byId('developmentDialog').dataset.revision),requirements:byId('developmentGoal').value,plan:byId('developmentPlan').value,submit});await refreshDev();},submit?'目标与计划已登记，尚未开始执行。':'需求草稿已保存。');
 byId('developmentStart').onclick=()=>guarded(async()=>{await developmentBridge('start',{session_id:state.displayedSessionId});await refreshDev();},'已处理开发请求；以任务状态为准。');
 byId('developmentPause').onclick=()=>guarded(async()=>{await post('/api/development/pause');await refreshDev();},'已登记暂停请求；当前模型调用完成后停止后续步骤。');
 byId('developmentRefresh').onclick=()=>guarded(async()=>{const run=state.status.session.development?.executions.at(-1);if(run){const result=await developmentBridge('result',{session_id:state.displayedSessionId,run_id:run.id});byId('developmentRuntime').textContent=result.runtime?'工具运行观察：'+result.runtime.status+' · '+(result.runtime.version||'未运行'):'';}await refreshDev();},'已刷新任务状态。');
 byId('developmentStopPreview').onclick=()=>guarded(async()=>{const run=state.status.session.development.executions.at(-1);if(!run)throw new Error('尚无候选');return developmentBridge('stopPreview',{session_id:state.displayedSessionId,run_id:run.id});},'候选预览已停止，工程与测试数据保留。');
 byId('developmentPreview').onclick=()=>guarded(async()=>{const run=state.status.session.development.executions.at(-1);return developmentBridge('preview',{session_id:state.displayedSessionId,run_id:run.id});},'候选已在工作台打开；使用隔离测试数据。');
 let polling=false;const poll=setInterval(async()=>{if(polling||document.hidden||state.busy||!state.ready||state.status?.session?.session_type!=='tool_development'||byId('developmentDialog').dataset.dirty)return;polling=true;try{const snapshot=await api('/api/development/session?session_id='+encodeURIComponent(state.displayedSessionId));if(snapshot.session_id!==state.displayedSessionId)return;state.status.session={...state.status.session,...snapshot};renderDevelopment(state.status.session);}catch{}finally{polling=false;}},3000);window.addEventListener('beforeunload',()=>clearInterval(poll));
 byId('developmentAccept').onclick=()=>guarded(async()=>{const notes=byId('developmentNotes').value.trim();if(!notes)throw new Error('请先实际使用预览，填写功能验收记录。');const run=state.status.session.development.executions.at(-1);await developmentBridge('accept',{session_id:state.displayedSessionId,run_id:run.id,notes});await refreshDev();},'验收发布请求已处理。');
}
