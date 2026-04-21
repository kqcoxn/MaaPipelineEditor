/**
 * MPE iframe 嵌入测试宿主
 * 实现 mpe-embed 协议 v1.0.0 的宿主侧通信逻辑
 */

const PROTOCOL = "mpe-embed";
const VERSION = "1.0.0";
const REQUEST_TIMEOUT = 10000;

// DOM 元素引用
const els = {
  iframeUrl: document.getElementById("iframe-url"),
  iframeContainer: document.getElementById("iframe-container"),
  iframeStatus: document.getElementById("iframe-status"),
  logContainer: document.getElementById("log-container"),
  pipelineData: document.getElementById("pipeline-data"),
  nodeId: document.getElementById("node-id"),
  resizeWidth: document.getElementById("resize-width"),
  resizeHeight: document.getElementById("resize-height"),
  stateFields: document.getElementById("state-fields"),
  uiHiddenPanels: document.getElementById("ui-hiddenPanels"),
};

// 按钮引用
const btns = {
  create: document.getElementById("btn-create"),
  destroy: document.getElementById("btn-destroy"),
  init: document.getElementById("btn-init"),
  load: document.getElementById("btn-load"),
  save: document.getElementById("btn-save"),
  select: document.getElementById("btn-select"),
  focus: document.getElementById("btn-focus"),
  resize: document.getElementById("btn-resize"),
  state: document.getElementById("btn-state"),
  destroyMsg: document.getElementById("btn-destroy-msg"),
  loadSample: document.getElementById("btn-load-sample"),
  clear: document.getElementById("btn-clear"),
  clearLog: document.getElementById("btn-clear-log"),
};

// Capability 复选框引用
const caps = {
  readOnly: document.getElementById("cap-readOnly"),
  allowCopy: document.getElementById("cap-allowCopy"),
  allowUndoRedo: document.getElementById("cap-allowUndoRedo"),
  allowAutoLayout: document.getElementById("cap-allowAutoLayout"),
  allowAI: document.getElementById("cap-allowAI"),
  allowSearch: document.getElementById("cap-allowSearch"),
  allowCustomTemplate: document.getElementById("cap-allowCustomTemplate"),
};

// UI 配置引用
const uiCfgs = {
  hideHeader: document.getElementById("ui-hideHeader"),
  hideToolbar: document.getElementById("ui-hideToolbar"),
};

// 状态
let iframe = null;
let requestIdCounter = 0;
const pendingRequests = new Map();

// ========== 工具函数 ==========

function generateRequestId() {
  return `req-${++requestIdCounter}-${Date.now()}`;
}

function formatTime() {
  const now = new Date();
  return now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
}

function log(type, data, direction) {
  const entry = document.createElement("div");
  entry.className = `log-entry ${direction}`;

  const timeEl = document.createElement("div");
  timeEl.className = "log-time";
  timeEl.textContent = formatTime();

  const typeEl = document.createElement("div");
  typeEl.className = "log-type";
  typeEl.textContent = `[${direction.toUpperCase()}] ${type}`;

  const payloadEl = document.createElement("div");
  payloadEl.className = "log-payload";
  payloadEl.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  entry.appendChild(timeEl);
  entry.appendChild(typeEl);
  entry.appendChild(payloadEl);

  els.logContainer.appendChild(entry);
  els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function logSystem(msg) {
  const entry = document.createElement("div");
  entry.className = "log-entry system";

  const timeEl = document.createElement("div");
  timeEl.className = "log-time";
  timeEl.textContent = formatTime();

  const typeEl = document.createElement("div");
  typeEl.className = "log-type";
  typeEl.textContent = "[SYSTEM]";

  const payloadEl = document.createElement("div");
  payloadEl.className = "log-payload";
  payloadEl.textContent = msg;

  entry.appendChild(timeEl);
  entry.appendChild(typeEl);
  entry.appendChild(payloadEl);

  els.logContainer.appendChild(entry);
  els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function sendMessage(type, payload, needResponse = false) {
  if (!iframe || !iframe.contentWindow) {
    logSystem("iframe 未加载，无法发送消息");
    return null;
  }

  const msg = {
    protocol: PROTOCOL,
    version: VERSION,
    type,
    payload,
  };

  if (needResponse) {
    msg.requestId = generateRequestId();
  }

  iframe.contentWindow.postMessage(msg, "*");
  log(type, msg, "outgoing");

  if (needResponse && msg.requestId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(msg.requestId);
        logSystem(`请求超时: ${type} (requestId: ${msg.requestId})`);
        reject(new Error("timeout"));
      }, REQUEST_TIMEOUT);

      pendingRequests.set(msg.requestId, {
        resolve: (data) => {
          clearTimeout(timer);
          pendingRequests.delete(msg.requestId);
          resolve(data);
        },
        reject: (err) => {
          clearTimeout(timer);
          pendingRequests.delete(msg.requestId);
          reject(err);
        },
      });
    });
  }

  return null;
}

function getCapabilities() {
  return {
    readOnly: caps.readOnly.checked,
    allowCopy: caps.allowCopy.checked,
    allowUndoRedo: caps.allowUndoRedo.checked,
    allowAutoLayout: caps.allowAutoLayout.checked,
    allowAI: caps.allowAI.checked,
    allowSearch: caps.allowSearch.checked,
    allowCustomTemplate: caps.allowCustomTemplate.checked,
  };
}

function getUIConfig() {
  const hiddenPanels = els.uiHiddenPanels.value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);

  return {
    hideHeader: uiCfgs.hideHeader.checked,
    hideToolbar: uiCfgs.hideToolbar.checked,
    hiddenPanels,
  };
}

// ========== iframe 生命周期 ==========

function createIframe() {
  if (iframe) {
    logSystem("iframe 已存在，先销毁旧实例");
    destroyIframe();
  }

  const url = els.iframeUrl.value.trim();
  if (!url) {
    logSystem("iframe URL 不能为空");
    return;
  }

  els.iframeContainer.innerHTML = "";
  iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  els.iframeContainer.appendChild(iframe);

  els.iframeStatus.textContent = "已加载";
  els.iframeStatus.className = "status-badge status-online";

  logSystem(`iframe 已创建: ${url}`);

  // iframe 加载后自动发送 init
  iframe.addEventListener("load", () => {
    logSystem("iframe load 事件触发");
    // 延迟发送 init，确保 MPE 初始化完成
    setTimeout(() => {
      handleInit();
    }, 1000);
  });
}

function destroyIframe() {
  if (iframe) {
    sendMessage("mpe:destroy", {});
    iframe.remove();
    iframe = null;
  }

  els.iframeContainer.innerHTML = '<div class="placeholder">请点击「创建 iframe」加载编辑器</div>';
  els.iframeStatus.textContent = "未加载";
  els.iframeStatus.className = "status-badge status-offline";

  // 清理待处理的请求
  for (const [reqId, handler] of pendingRequests) {
    handler.reject(new Error("iframe destroyed"));
  }
  pendingRequests.clear();

  logSystem("iframe 已销毁");
}

// ========== 消息发送处理 ==========

async function handleInit() {
  const payload = {
    capabilities: getCapabilities(),
    ui: getUIConfig(),
  };

  try {
    const response = await sendMessage("mpe:init", payload, true);
    logSystem(`握手完成: version=${response?.payload?.version}, supportedCaps=${JSON.stringify(response?.payload?.supportedCaps)}`);
  } catch (err) {
    logSystem(`握手失败: ${err.message}`);
  }
}

async function handleLoadPipeline() {
  const raw = els.pipelineData.value.trim();
  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (err) {
    logSystem(`JSON 解析失败: ${err.message}`);
    return;
  }

  const payload = {
    fileName: "test_pipeline.json",
    data,
  };

  try {
    const response = await sendMessage("mpe:loadPipeline", payload, true);
    logSystem(`加载结果: success=${response?.payload?.success}`);
  } catch (err) {
    logSystem(`加载超时: ${err.message}`);
  }
}

async function handleSave() {
  try {
    const response = await sendMessage("mpe:save", {}, true);
    logSystem(`保存数据返回: fileName=${response?.payload?.fileName}`);
    if (response?.payload?.data) {
      els.pipelineData.value = JSON.stringify(response.payload.data, null, 2);
      log("saveData payload", response.payload.data, "incoming");
    }
  } catch (err) {
    logSystem(`保存超时: ${err.message}`);
  }
}

function handleSelectNode() {
  const nodeId = els.nodeId.value.trim();
  if (!nodeId) {
    logSystem("nodeId 不能为空");
    return;
  }
  sendMessage("mpe:selectNode", { nodeId });
}

function handleFocusNode() {
  const nodeId = els.nodeId.value.trim();
  if (!nodeId) {
    logSystem("nodeId 不能为空");
    return;
  }
  sendMessage("mpe:focusNode", { nodeId });
}

function handleResize() {
  const width = parseInt(els.resizeWidth.value, 10) || 800;
  const height = parseInt(els.resizeHeight.value, 10) || 600;
  sendMessage("mpe:resize", { width, height });
}

async function handleState() {
  const fields = els.stateFields.value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);

  try {
    const response = await sendMessage("mpe:state", { fields }, true);
    logSystem(`状态查询结果: ${JSON.stringify(response?.payload)}`);
  } catch (err) {
    logSystem(`状态查询超时: ${err.message}`);
  }
}

function handleDestroyMsg() {
  sendMessage("mpe:destroy", {});
}

function loadSampleData() {
  const sample = {
    StartAction: {
      action: "Click",
      target: [100, 200, 300, 400],
      next: ["Action1"],
    },
    Action1: {
      recognition: {
        type: "TemplateMatch",
        template: "test_template.png",
      },
      action: "Click",
      target: [150, 250, 350, 450],
      next: ["Action2"],
    },
    Action2: {
      action: "Swipe",
      target: [200, 300, 400, 500],
      next: [],
    },
  };
  els.pipelineData.value = JSON.stringify(sample, null, 2);
  logSystem("已加载示例 pipeline 数据");
}

function clearPipelineData() {
  els.pipelineData.value = "";
}

function clearLog() {
  els.logContainer.innerHTML = "";
}

// ========== 消息监听 ==========

window.addEventListener("message", (event) => {
  const msg = event.data;

  // 只处理 mpe-embed 协议消息
  if (!msg || msg.protocol !== PROTOCOL) return;

  log(msg.type, msg, "incoming");

  // 处理请求-响应模式
  if (msg.requestId && pendingRequests.has(msg.requestId)) {
    const handler = pendingRequests.get(msg.requestId);
    handler.resolve(msg);
    return;
  }

  // 处理推送消息
  switch (msg.type) {
    case "mpe:ready":
      logSystem(`MPE 就绪: version=${msg.payload?.version}`);
      break;

    case "mpe:change":
      logSystem(`流程变更: type=${msg.payload?.type}`);
      break;

    case "mpe:saveRequest":
      logSystem(`MPE 主动请求保存: hint=${msg.payload?.hint}`);
      // 自动响应 save 请求
      setTimeout(() => {
        logSystem("自动响应 saveRequest → 发送 mpe:save");
        handleSave();
      }, 100);
      break;

    case "mpe:nodeSelect":
      logSystem(`节点选中: nodeId=${msg.payload?.nodeId}`);
      break;

    case "mpe:error":
      logSystem(`错误通知: code=${msg.payload?.code}, message=${msg.payload?.message}`);
      break;

    default:
      break;
  }
});

// ========== 事件绑定 ==========

btns.create.addEventListener("click", createIframe);
btns.destroy.addEventListener("click", destroyIframe);
btns.init.addEventListener("click", handleInit);
btns.load.addEventListener("click", handleLoadPipeline);
btns.save.addEventListener("click", handleSave);
btns.select.addEventListener("click", handleSelectNode);
btns.focus.addEventListener("click", handleFocusNode);
btns.resize.addEventListener("click", handleResize);
btns.state.addEventListener("click", handleState);
btns.destroyMsg.addEventListener("click", handleDestroyMsg);
btns.loadSample.addEventListener("click", loadSampleData);
btns.clear.addEventListener("click", clearPipelineData);
btns.clearLog.addEventListener("click", clearLog);

// ========== 初始化 ==========

logSystem("MPE iframe 测试宿主已就绪");
logSystem(`协议版本: ${VERSION}`);
