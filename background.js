// Подія встановлення розширення
chrome.runtime.onInstalled.addListener(() => {
  console.log("Custom AdBlocker успішно встановлено та активовано.");
});

// Слухач повідомлень від content.js (за потреби)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse({ status: "active" });
  }
});