// Background service worker for Kick Control Panel
chrome.runtime.onInstalled.addListener(() => {
  console.log('Kick Control Panel extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we're on Kick.com
  if (tab.url && tab.url.includes('kick.com')) {
    // Send message to content script to toggle panel
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (error) {
      console.log('Content script not ready, injecting...');
      // Inject content script if not already present
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    }
  } else {
    // Not on Kick.com - show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Kick Control Panel',
      message: 'Please navigate to Kick.com to use this extension.'
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: request.title || 'Kick Control Panel',
      message: request.message
    });
  }
  
  if (request.action === 'updateBadge') {
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: request.text
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: request.color || '#8B5CF6'
    });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up any stored data for this tab if needed
  console.log(`Tab ${tabId} closed`);
});

// Handle tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('kick.com')) {
    // Update badge to show extension is active
    chrome.action.setBadgeText({
      tabId: tabId,
      text: '●'
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: '#10B981'
    });
  } else if (changeInfo.status === 'complete') {
    // Clear badge for non-Kick pages
    chrome.action.setBadgeText({
      tabId: tabId,
      text: ''
    });
  }
});