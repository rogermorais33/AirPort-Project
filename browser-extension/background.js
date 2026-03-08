const DEFAULT_WS_URL = "ws://localhost:8000/api/v1/ws/live";

let ws = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

async function getWsUrl() {
  const data = await chrome.storage.local.get(["ws_url"]);
  return data.ws_url || DEFAULT_WS_URL;
}

function broadcastCommand(commandPayload) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) {
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "gazepilot_command",
        payload: commandPayload,
      });
    });
  });
}

async function connect() {
  const url = await getWsUrl();

  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectAttempt = 0;
    console.log("[GazePilotExt] WS connected", url);
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "command_triggered" && payload.data) {
        broadcastCommand(payload.data);
      }
    } catch (err) {
      console.warn("[GazePilotExt] invalid event", err);
    }
  };

  ws.onclose = () => {
    scheduleReconnect();
  };

  ws.onerror = () => {
    if (ws) {
      ws.close();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  const delay = Math.min(10000, 800 * 2 ** reconnectAttempt) + Math.floor(Math.random() * 400);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(connect, delay);
}

chrome.runtime.onInstalled.addListener(() => {
  connect();
});

chrome.runtime.onStartup.addListener(() => {
  connect();
});
