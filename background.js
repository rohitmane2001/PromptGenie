chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectContentScript') {
      chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        files: ['content.js']
      });
    }
  });