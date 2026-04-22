chrome.runtime.onInstalled.addListener(() => {
  console.log("[UploadBlocker] installed");
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "notify") {
    const tabId = sender?.tab?.id;
    if (typeof tabId === "number" && tabId >= 0) {
      chrome.tabs.sendMessage(tabId, {
        type: "show_alert",
        reason: msg.reason || "File upload is not permitted."
      }).catch(() => {});
    }
  }
});