// Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Custom AdBlocker (100% Tester Edition) successfully installed.");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url?.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      files: ['content.js'],
      world: 'MAIN'
    }).catch(() => {});
  }
});