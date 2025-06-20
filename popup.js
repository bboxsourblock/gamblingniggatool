document.addEventListener('DOMContentLoaded', async () => {
  const openPanelBtn = document.getElementById('open-panel');
  const openKickBtn = document.getElementById('open-kick');
  const notOnKickWarning = document.getElementById('not-on-kick');
  const chatStatus = document.getElementById('chat-status');
  const floodStatus = document.getElementById('flood-status');
  const messagesSent = document.getElementById('messages-sent');
  const floodsDetected = document.getElementById('floods-detected');

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (error) {
    console.error('Failed to get current tab:', error);
    return;
  }
  
  const isOnKick = tab?.url && tab.url.includes('kick.com');

  if (!isOnKick) {
    notOnKickWarning.style.display = 'block';
    openPanelBtn.disabled = true;
    openPanelBtn.textContent = 'Not on Kick.com';
    openPanelBtn.classList.remove('btn-primary');
    openPanelBtn.classList.add('btn-secondary');
  }

  // Load status
  try {
    const result = await chrome.storage.local.get(['panelStats', 'panelState']);
    
    if (result.panelStats) {
      messagesSent.textContent = result.panelStats.messagesSent || 0;
      floodsDetected.textContent = result.panelStats.floodsDetected || 0;
    }

    if (result.panelState) {
      if (result.panelState.chatAutomation?.enabled) {
        chatStatus.textContent = 'Active';
        chatStatus.classList.remove('inactive');
        chatStatus.classList.add('active');
      }

      if (result.panelState.floodDetection?.enabled) {
        floodStatus.textContent = 'Active';
        floodStatus.classList.remove('inactive');
        floodStatus.classList.add('active');
      }
    }
  } catch (error) {
    console.log('No stored data found');
  }

  openPanelBtn.addEventListener('click', async () => {
    if (!isOnKick) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
      window.close();
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
            window.close();
          } catch (e) {
            console.error('Failed to open panel after injection:', e);
          }
        }, 1000);
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
      }
    }
  });

  openKickBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://kick.com' });
    window.close();
  });
});