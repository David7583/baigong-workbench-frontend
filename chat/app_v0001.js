// ============================================================
// 文件名: app_v0001.js
// 中文名: 新版独立 Action Chat Web 交互脚本
// 版本号: v0001
//
// 主层级: action
// 层级: development / independent_action_chat / web_ui
// 脚本定位: 浏览器控件与本地 Chat Service API 之间的展示适配器
//
// 职责说明:
// - 展示配置驱动的 Provider/Model、Router 和检索运行状态
// - 发送聊天、切换、保存和只读检查请求并渲染结果
//
// 本脚本做什么:
// - 只调用公开 API，不复制后端编排逻辑
//
// 本脚本不做什么:
// - 不读取密钥，不执行 Router/检索，不持久化业务数据
//
// 制度边界声明:
// - 文本使用 textContent 渲染，检索和模型输出不作为 HTML 执行
// - Provider/Model 列表完全来自后端配置
//
// 可更新: True
// ============================================================

// ============================================================
// ALIAS_META
// ============================================================
// alias: independent_action_chat_web_app_v0001
// family: independent_action_chat_web_app
// role: browser_ui_controller
// version: v0001
// status: active
// entry_point: scripts/action/development/scripts/independent_action_chat/web/app_v0001.js
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
const SCRIPT_NAME = "independent_action_chat_web_app_v0001";
const SCRIPT_VERSION = "v0001";

// ============================================================
// 异常类型
// ============================================================

class ApiError extends Error {}

// ============================================================
// 数据结构
// ============================================================

const state = { providers: [], status: null };

// ============================================================
// 工具函数区
// ============================================================

const byId = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.status === "error") {
    throw new ApiError(payload.error?.detail || `HTTP ${response.status}`);
  }
  return payload;
}

function providerById(providerId) {
  return state.providers.find((item) => item.provider_id === providerId);
}

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
  const provider = providerById(providerSelect.value);
  modelSelect.replaceChildren();
  (provider?.models || []).forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.display_name || model.id;
    option.selected = model.id === selected;
    modelSelect.append(option);
  });
}

function showStatus(value) {
  byId("statusBar").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function addMessage(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  byId("messages").append(node);
  node.scrollIntoView({ block: "end", behavior: "smooth" });
}

// ============================================================
// 默认映射
// ============================================================

const RETRIEVAL_CHECKBOXES = {
  sqlite_supplement: "allowSqlite",
  duckdb: "allowDuckdb",
  neo4j: "allowNeo4j",
};

// ============================================================
// 核心类
// ============================================================

async function refresh() {
  const [runtime, catalog] = await Promise.all([api("/api/status"), api("/api/providers")]);
  state.status = runtime;
  state.providers = catalog.providers;
  const session = runtime.session;
  byId("sessionLabel").textContent = `${session.session_id} · ${session.turn_count} turns`;
  fillProviders(byId("answerProvider"), session.answer_provider);
  fillModels(byId("answerProvider"), byId("answerModel"), session.answer_model);
  fillProviders(byId("routerProvider"), session.router_provider);
  fillModels(byId("routerProvider"), byId("routerModel"), session.router_model);
  byId("routerMode").value = session.router_mode;
  byId("retrievalMode").value = runtime.retrieval.mode || "off";
  const allowed = runtime.retrieval.allowed_backends || [];
  Object.entries(RETRIEVAL_CHECKBOXES).forEach(([name, id]) => { byId(id).checked = allowed.includes(name); });
  if (runtime.retrieval.parameters?.chroma) {
    byId("topK").value = runtime.retrieval.parameters.chroma.top_k;
    byId("threshold").value = runtime.retrieval.parameters.chroma.distance_threshold;
  }
  showStatus(runtime);
}

async function guarded(action) {
  try {
    document.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    const result = await action();
    showStatus(result);
    return result;
  } catch (error) {
    showStatus({ status: "error", detail: error.message });
    addMessage("meta", `错误：${error.message}`);
    return null;
  } finally {
    document.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
}

// ============================================================
// Schema / 契约辅助函数
// ============================================================

function retrievalSettings() {
  return {
    allowed_backends: Object.entries(RETRIEVAL_CHECKBOXES).filter(([, id]) => byId(id).checked).map(([name]) => name),
    parameters: {
      chroma: {
        top_k: Number(byId("topK").value),
        distance_threshold: Number(byId("threshold").value),
      },
    },
  };
}

// ============================================================
// CLI / main 接口区
// ============================================================

async function main() {
  byId("answerProvider").addEventListener("change", () => fillModels(byId("answerProvider"), byId("answerModel"), ""));
  byId("routerProvider").addEventListener("change", () => fillModels(byId("routerProvider"), byId("routerModel"), ""));
  byId("applyAnswer").addEventListener("click", () => guarded(async () => {
    const result = await api("/api/model/selection", { method: "POST", body: JSON.stringify({ provider: byId("answerProvider").value, model: byId("answerModel").value }) });
    await refresh(); return result;
  }));
  byId("applyRouter").addEventListener("click", () => guarded(async () => {
    await api("/api/router/selection", { method: "POST", body: JSON.stringify({ provider: byId("routerProvider").value, model: byId("routerModel").value }) });
    const result = await api("/api/router/mode", { method: "POST", body: JSON.stringify({ mode: byId("routerMode").value }) });
    await refresh(); return result;
  }));
  byId("applyRetrieval").addEventListener("click", () => guarded(async () => {
    await api("/api/retrieval/settings", { method: "POST", body: JSON.stringify({ settings: retrievalSettings() }) });
    const result = await api("/api/retrieval/mode", { method: "POST", body: JSON.stringify({ mode: byId("retrievalMode").value }) });
    await refresh(); return result;
  }));
  byId("probeBackends").addEventListener("click", () => guarded(() => api("/api/retrieval/status?probe=1")));
  byId("newSession").addEventListener("click", () => guarded(async () => { const result = await api("/api/chat/new", { method: "POST", body: "{}" }); byId("messages").replaceChildren(); await refresh(); return result; }));
  byId("saveSession").addEventListener("click", () => guarded(() => api("/api/chat/save", { method: "POST", body: "{}" })));
  byId("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = byId("messageInput");
    const text = input.value.trim();
    if (!text) return;
    addMessage("user", text); input.value = "";
    const result = await guarded(() => api("/api/chat/send", { method: "POST", body: JSON.stringify({ message: text }) }));
    if (result?.response_text) addMessage("assistant", result.response_text);
    await refresh();
  });
  byId("messageInput").addEventListener("keydown", (event) => { if (event.ctrlKey && event.key === "Enter") byId("chatForm").requestSubmit(); });
  await refresh();
}

main().catch((error) => showStatus({ status: "error", detail: error.message }));
