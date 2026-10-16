// ============================================================
// 文件名: app_v0003.js
// 中文名: 独立 Action Chat 黑白双栏交互脚本
// 版本号: v0003
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
// alias: independent_action_chat_web_app_v0003
// family: independent_action_chat_web_app
// role: browser_ui_controller
// version: v0003
// status: active
// entry_point: scripts/action/development/scripts/independent_action_chat/web/app_v0003.js
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
const SCRIPT_NAME = "independent_action_chat_web_app_v0003";
const SCRIPT_VERSION = "v0003";
const THEME_STORAGE_KEY = "independent-action-chat-theme";

// ============================================================
// 异常类型
// ============================================================

class ApiError extends Error {}

// ============================================================
// 数据结构
// ============================================================

const state = { providers: [], status: null, busy: false, stopped: false, ready: false,
  displayedSessionId: null, historyEnabled: false, historyMessages: [], nextBefore: 0 };
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
  method: "POST", body: JSON.stringify({
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

const RETRIEVAL_CHECKBOXES = {
  sqlite_supplement: "allowSqlite",
  duckdb: "allowDuckdb",
  neo4j: "allowNeo4j",
};
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

function updateControls() {
  document.querySelectorAll("[data-service]").forEach((element) => {
    element.disabled = state.busy || state.stopped || !state.ready;
  });
  byId("retrievalOptions").disabled = byId("retrievalMode").value === "off";
  byId("retrievalHint").textContent = byId("retrievalMode").value === "off"
    ? "关闭时不会查询数据库；下方勾选暂不生效。"
    : "先语义召回并回查原文，再执行勾选的补充查询。勾选不代表数据库已连接。";
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
  const messages = byId("messages");
  messages.append(node);
  if (scroll) messages.scrollTop = messages.scrollHeight;
}

async function refresh() {
  const [runtime, catalog] = await Promise.all([api("/api/status"), api("/api/providers")]);
  state.status = runtime;
  state.providers = catalog.providers;
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
  byId("routerMode").value = session.router_mode;
  byId("routerSummary").textContent = ROUTER_LABELS[session.router_mode] || session.router_mode;
  byId("retrievalMode").value = runtime.retrieval.mode || "off";
  byId("retrievalSummary").textContent = RETRIEVAL_LABELS[byId("retrievalMode").value];
  const allowed = runtime.retrieval.allowed_backends || [];
  Object.entries(RETRIEVAL_CHECKBOXES).forEach(([name, id]) => { byId(id).checked = allowed.includes(name); });
  if (runtime.retrieval.parameters?.chroma) {
    byId("topK").value = runtime.retrieval.parameters.chroma.top_k;
    byId("threshold").value = runtime.retrieval.parameters.chroma.distance_threshold;
  }
  state.historyEnabled = runtime.capabilities?.session_history === true;
  if (state.historyEnabled) {
    await refreshHistoryList();
  } else {
    byId("historyStatus").textContent = "旧后台尚未重启：请保存并退出，再运行 CMD 开启历史功能。";
  }
  showStatus(runtime);
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
    if (session.readable === false) button.setAttribute("data-unreadable", "");
    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = session.title || "空会话";
    const detail = document.createElement("span");
    detail.className = "history-detail";
    detail.textContent = `${sessionDate(session.updated_at || session.created_at)} · ${session.turn_count || 0} 轮`;
    button.append(title, detail);
    button.addEventListener("click", () => restoreConversation(session.session_id));
    list.append(button);
  });
  byId("historyStatus").textContent = result.sessions.length
    ? `共 ${result.sessions.length} 个会话 · 续聊保存到原目录` : "还没有历史会话。";
  updateControls();
  list.querySelectorAll("[data-unreadable]").forEach((button) => { button.disabled = true; });
  return result;
}

function renderConversation(snapshot, prepend = false) {
  if (prepend && snapshot.session.session_id !== state.displayedSessionId) {
    throw new ApiError("会话已经变化，请刷新后重试。");
  }
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
  if (sessionId !== state.displayedSessionId && byId("messageInput").value
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
    if (changed) byId("messageInput").value = "";
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
    allowed_backends: Object.entries(RETRIEVAL_CHECKBOXES).filter(([, id]) => byId(id).checked).map(([name]) => name),
    parameters: {
      chroma: { top_k: Number(byId("topK").value), distance_threshold: Number(byId("threshold").value) },
    },
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
  if (!text) return;
  await guarded(async () => {
    addMessage("user", text);
    input.value = "";
    let result;
    try {
      result = await post("/api/chat/send", { message: text });
    } catch (error) {
      input.value = text;
      addMessage("meta", "未取得回答，输入已恢复。请求可能已被后台接收，请确认后再重试。");
      throw error;
    }
    if (result.response_text) addMessage("assistant", result.response_text, result);
    // 发送后重新读取已落盘的分页历史，避免重载更早记录时丢失本轮消息。
    // 回答已经成功时，状态刷新失败不能把同一问题恢复为待发送。
    try { await refresh(); await loadCurrentConversation(); } catch (error) { addMessage("meta", `回答已收到；状态刷新失败：${error.message}`); }
    return result;
  }, (result) => result.save_error
    ? "回答已收到，但自动保存失败。请点击保存重试，详情见运行详情。"
    : "回答已完成。");
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
  let theme = "dark";
  try { theme = localStorage.getItem(THEME_STORAGE_KEY) || theme; } catch { /* 无存储权限时使用默认主题。 */ }
  setTheme(theme);
  byId("darkTheme").addEventListener("click", () => setTheme("dark"));
  byId("lightTheme").addEventListener("click", () => setTheme("light"));
  const narrow = window.matchMedia("(max-width: 760px)");
  const workspace = document.querySelector(".workspace");
  const syncSidebar = () => {
    workspace.classList.remove("settings-hidden", "settings-open");
    byId("toggleSettings").setAttribute("aria-expanded", String(!narrow.matches));
  };
  syncSidebar();
  narrow.addEventListener("change", syncSidebar);
  byId("toggleSettings").addEventListener("click", () => {
    const expanded = narrow.matches
      ? workspace.classList.toggle("settings-open")
      : !workspace.classList.toggle("settings-hidden");
    byId("toggleSettings").setAttribute("aria-expanded", String(expanded));
  });
  byId("answerProvider").addEventListener("change", () => fillModels(byId("answerProvider"), byId("answerModel"), ""));
  byId("routerProvider").addEventListener("change", () => fillModels(byId("routerProvider"), byId("routerModel"), ""));
  byId("retrievalMode").addEventListener("change", updateControls);
  byId("applyAnswer").addEventListener("click", () => guarded(async () => {
    const result = await post("/api/model/selection", { provider: byId("answerProvider").value, model: byId("answerModel").value });
    await refresh(); return result;
  }, "回答模型已切换。"));
  byId("applyRouter").addEventListener("click", () => guarded(async () => {
    await post("/api/router/selection", { provider: byId("routerProvider").value, model: byId("routerModel").value });
    const result = await post("/api/router/mode", { mode: byId("routerMode").value });
    await refresh(); return result;
  }, "路由设置已应用。"));
  byId("applyRetrieval").addEventListener("click", () => {
    if (byId("retrievalMode").value !== "off"
        && (!byId("topK").reportValidity() || !byId("threshold").reportValidity())) return;
    return guarded(async () => {
      if (byId("retrievalMode").value !== "off") {
        await post("/api/retrieval/settings", { settings: retrievalSettings() });
      }
      const result = await post("/api/retrieval/mode", { mode: byId("retrievalMode").value });
      await refresh(); return result;
    }, "检索设置已应用。");
  });
  byId("probeBackends").addEventListener("click", () => guarded(async () => {
    const result = await api("/api/retrieval/status?probe=1");
    document.querySelector(".diagnostics").open = true;
    return result;
  }, "数据库检查已完成，结果见左侧运行详情。"));
  byId("newSession").addEventListener("click", () => {
    if ((state.status?.session.turn_count > 0 || byId("messageInput").value)
        && !window.confirm("创建新会话？原会话仍保留在后台，输入框中未发送的内容将清空。")) return;
    return guarded(async () => {
      const result = await post("/api/chat/new");
      byId("messages").querySelectorAll(".message").forEach((node) => node.remove());
      byId("emptyState").hidden = false;
      byId("messageInput").value = "";
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
    return { status: "ok" };
  }, () => state.historyEnabled ? "已连接，历史记录已恢复。可直接续聊，或从左侧选择其他会话。" : "已连接旧后台。请保存并退出，再运行 CMD 开启历史功能。");
}

main();
