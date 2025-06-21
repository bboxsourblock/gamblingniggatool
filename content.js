class KickControlPanel {
  constructor() {
    this.panel = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentTab = 'chat';
    this.messageInterval = null;
    this.chatObserver = null;
    
    this.state = {
      chatAutomation: {
        enabled: false,
        messages: ['Hello everyone! 👋', 'How is everyone doing today?', 'Great stream! 🔥'],
        interval: 30,
        randomize: true,
        currentIndex: 0
      },
      floodDetection: {
        enabled: false,
        threshold: 3,
        timeWindow: 20,
        action: 'send',
        triggerWords: ['Hello everyone! 👋'],
        messageTracker: {},
        enforceUniqueUsers: true,
        uniqueUsersRequired: 2,
        cooldownSeconds: 10,
        lastFloodTime: 0
      },
      stats: {
        totalSent: 0,
        autoSent: 0,
        manualSent: 0,
        floodsDetected: 0
      },
      monitoring: {
        recentMessages: [],
        messagesSinceAuto: 0,
        messagesSinceFlood: 0,
        autoScroll: true
      }
    };

    this.userColors = new Map();
    this.availableColors = [
      '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444',
      '#06B6D4', '#84CC16', '#F97316', '#8B5A2B', '#6366F1'
    ];
    
    this.init();
  }

  init() {
    this.loadState();
    this.createPanel();
    this.attachEvents();
    this.setupChatObserver();
    this.updateStats();
    
    window.kickPanel = this;
  }

  loadState() {
    try {
      const stored = localStorage.getItem('kickControlPanelState');
      if (stored) {
        const parsedState = JSON.parse(stored);
        this.state = { ...this.state, ...parsedState };
      }
    } catch (error) {
      console.log('Failed to load state:', error);
    }
  }

  saveState() {
    try {
      localStorage.setItem('kickControlPanelState', JSON.stringify(this.state));
      chrome.storage?.local.set({
        panelState: this.state,
        panelStats: this.state.stats
      });
    } catch (error) {
      console.log('Failed to save state:', error);
    }
  }

  createPanel() {
    if (this.panel) return;

    this.panel = document.createElement('div');
    this.panel.className = 'kick-control-panel';
    this.panel.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span class="title-icon">⚡</span>
          <span class="title-text">Kick Control Panel</span>
        </div>
        <div class="panel-controls">
          <button class="control-btn minimize-btn" title="Minimize">−</button>
          <button class="control-btn close-btn" title="Close">×</button>
        </div>
      </div>
      
      <div class="panel-content">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="chat">💬 Chat</button>
          <button class="tab-button" data-tab="flood">🛡️ Flood</button>
          <button class="tab-button" data-tab="send">📤 Send</button>
          <button class="tab-button" data-tab="monitor">📊 Monitor</button>
        </div>
        
        <div class="tab-content" id="tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    // Apply styles
    this.panel.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 350px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 999999;
      backdrop-filter: blur(10px);
      user-select: none;
      overflow: hidden;
    `;

    document.body.appendChild(this.panel);
    this.attachPanelEvents();
  }

  renderTabContent() {
    switch (this.currentTab) {
      case 'chat':
        return this.renderChatTab();
      case 'flood':
        return this.renderFloodTab();
      case 'send':
        return this.renderSendTab();
      case 'monitor':
        return this.renderMonitorTab();
      default:
        return this.renderChatTab();
    }
  }

  renderChatTab() {
    const { enabled, messages, interval, randomize } = this.state.chatAutomation;
    
    return `
      <div class="tab-section">
        <div class="section-header">
          <h3>🤖 Chat Automation</h3>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input type="checkbox" id="chat-toggle" ${enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">${enabled ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div class="settings-group">
          <label>Interval: <span id="interval-value">${interval}s</span></label>
          <input type="range" id="interval-slider" min="5" max="300" value="${interval}" ${!enabled ? 'disabled' : ''}>
          
          <div class="checkbox-container">
            <label>
              <input type="checkbox" id="randomize-toggle" ${randomize ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
              Randomize message order
            </label>
          </div>
        </div>

        <div class="messages-section">
          <label>Messages (${messages.length}):</label>
          <div class="add-message-container">
            <input type="text" id="new-message" placeholder="Add new message..." ${!enabled ? 'disabled' : ''}>
            <button id="add-message-btn" ${!enabled ? 'disabled' : ''}>Add</button>
          </div>
          
          <div class="messages-list">
            ${messages.map((msg, i) => `
              <div class="message-item">
                <span class="message-text">${msg}</span>
                <button class="remove-message" data-index="${i}" ${!enabled ? 'disabled' : ''}>×</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">${this.state.stats.autoSent}</span>
            <span class="stat-label">Auto Sent</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.state.monitoring.messagesSinceAuto}</span>
            <span class="stat-label">Messages Since Last</span>
          </div>
        </div>
      </div>
    `;
  }

  renderFloodTab() {
    const { enabled, threshold, timeWindow, action, triggerWords, enforceUniqueUsers, uniqueUsersRequired, cooldownSeconds, lastFloodTime } = this.state.floodDetection;
    
    // Calculate remaining cooldown
    const now = Date.now();
    const timeSinceLastFlood = (now - lastFloodTime) / 1000;
    const remainingCooldown = Math.max(0, cooldownSeconds - timeSinceLastFlood);
    const onCooldown = remainingCooldown > 0;
    
    return `
      <div class="tab-section">
        <div class="section-header">
          <h3>🛡️ Flood Detection</h3>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input type="checkbox" id="flood-toggle" ${enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">${enabled ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div class="settings-group">
          <label>Detection Threshold: <span id="threshold-value">${threshold}</span></label>
          <input type="range" id="threshold-slider" min="2" max="10" value="${threshold}" ${!enabled ? 'disabled' : ''}>
          
          <label>Time Window: <span id="time-window-value">${timeWindow}s</span></label>
          <input type="range" id="time-window-slider" min="5" max="60" value="${timeWindow}" ${!enabled ? 'disabled' : ''}>
          
          <div class="checkbox-container">
            <label>
              <input type="checkbox" id="enforce-unique-toggle" ${enforceUniqueUsers ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
              Require unique users
            </label>
          </div>
          
          ${enforceUniqueUsers ? `
            <label>Unique Users Required: <span id="unique-users-value">${uniqueUsersRequired}</span></label>
            <input type="range" id="unique-users-slider" min="2" max="10" value="${uniqueUsersRequired}" ${!enabled ? 'disabled' : ''}>
          ` : ''}
          
          <label>Action:</label>
          <select id="flood-action" ${!enabled ? 'disabled' : ''}>
            <option value="send" ${action === 'send' ? 'selected' : ''}>Send Message</option>
            <option value="warn" ${action === 'warn' ? 'selected' : ''}>Warn Only</option>
          </select>
          
          ${action === 'send' ? `
            <label>Cooldown After Send: <span id="cooldown-value">${cooldownSeconds}s</span></label>
            <input type="range" id="cooldown-slider" min="5" max="120" value="${cooldownSeconds}" ${!enabled ? 'disabled' : ''}>
            
            ${onCooldown ? `
              <div class="cooldown-indicator">
                <span class="cooldown-text">⏱️ Cooldown: ${remainingCooldown.toFixed(1)}s remaining</span>
                <div class="cooldown-bar">
                  <div class="cooldown-progress" style="width: ${((cooldownSeconds - remainingCooldown) / cooldownSeconds) * 100}%"></div>
                </div>
              </div>
            ` : ''}
          ` : ''}
        </div>

        <div class="trigger-words-section">
          <label>Trigger Words (${triggerWords.length}):</label>
          <div class="add-trigger-container">
            <input type="text" id="new-trigger" placeholder="Add trigger word..." ${!enabled ? 'disabled' : ''}>
            <button id="add-trigger-btn" ${!enabled ? 'disabled' : ''}>Add</button>
          </div>
          
          <div class="trigger-words-list">
            ${triggerWords.map((word, i) => `
              <div class="trigger-item">
                <span class="trigger-text">${word}</span>
                <button class="remove-trigger" data-index="${i}" ${!enabled ? 'disabled' : ''}>×</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">${this.state.stats.floodsDetected}</span>
            <span class="stat-label">Floods Detected</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.state.monitoring.messagesSinceFlood}</span>
            <span class="stat-label">Messages Since Last</span>
          </div>
        </div>
      </div>
    `;
  }

  renderSendTab() {
    return `
      <div class="tab-section">
        <div class="section-header">
          <h3>📤 Manual Messaging</h3>
        </div>

        <div class="send-section">
          <div class="manual-input-container">
            <textarea id="manual-message" placeholder="Type your message..." rows="3"></textarea>
            <button id="send-manual-btn">Send Message</button>
          </div>
          
          <div class="quick-messages">
            <label>Quick Messages:</label>
            <div class="quick-buttons">
              <button class="quick-btn" data-message="Hello everyone! 👋">👋 Hello</button>
              <button class="quick-btn" data-message="Thanks for watching! ❤️">❤️ Thanks</button>
              <button class="quick-btn" data-message="Great stream! 🔥">🔥 Great</button>
              <button class="quick-btn" data-message="POGGERS! 🎉">🎉 Poggers</button>
            </div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">${this.state.stats.manualSent}</span>
            <span class="stat-label">Manual Sent</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.state.stats.totalSent}</span>
            <span class="stat-label">Total Sent</span>
          </div>
        </div>
      </div>
    `;
  }

  renderMonitorTab() {
    const { recentMessages, messagesSinceAuto, messagesSinceFlood, autoScroll } = this.state.monitoring;
    
    return `
      <div class="tab-section">
        <div class="section-header">
          <h3>📊 Chat Monitor</h3>
          <div class="monitor-controls">
            <label class="checkbox-container">
              <input type="checkbox" id="auto-scroll-toggle" ${autoScroll ? 'checked' : ''}>
              Auto-scroll
            </label>
            <button id="clear-monitor-btn">Clear</button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">${recentMessages.length}</span>
            <span class="stat-label">Recent Messages</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${messagesSinceAuto}</span>
            <span class="stat-label">Since Auto</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${messagesSinceFlood}</span>
            <span class="stat-label">Since Flood</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.state.stats.totalSent}</span>
            <span class="stat-label">Total Sent</span>
          </div>
        </div>

        <div class="messages-monitor">
          <div class="monitor-messages" id="monitor-messages">
            ${recentMessages.map(msg => `
              <div class="monitor-message ${msg.type}" data-timestamp="${msg.timestamp}">
                <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString().slice(0, -3)}</span>
                <span class="message-user" style="color: ${msg.userColor}">${msg.user}</span>
                <span class="message-content">${msg.content}</span>
                ${msg.type !== 'chat' ? `<span class="message-type-badge">${msg.type}</span>` : ''}
              </div>
            `).join('')}
            ${recentMessages.length === 0 ? '<div class="no-messages">No messages captured yet...</div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  attachPanelEvents() {
    // Panel dragging
    const header = this.panel.querySelector('.panel-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.control-btn')) return;
      this.isDragging = true;
      this.dragOffset.x = e.clientX - this.panel.offsetLeft;
      this.dragOffset.y = e.clientY - this.panel.offsetTop;
    });

    // Panel controls
    this.panel.querySelector('.minimize-btn').addEventListener('click', () => {
      this.panel.style.height = this.panel.style.height === '40px' ? 'auto' : '40px';
    });

    this.panel.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Tab navigation
    this.panel.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Attach tab-specific events
    this.attachTabEvents();
  }

  attachTabEvents() {
    this.attachChatEvents();
    this.attachFloodEvents();
    this.attachSendEvents();
    this.attachMonitorEvents();
  }

  attachChatEvents() {
    // Chat automation toggle
    const chatToggle = document.getElementById('chat-toggle');
    chatToggle?.addEventListener('change', (e) => {
      this.state.chatAutomation.enabled = e.target.checked;
      this.saveState();
      this.refreshTab();
      
      if (e.target.checked) {
        this.startChatAutomation();
      } else {
        this.stopChatAutomation();
      }
    });

    // Interval slider
    const intervalSlider = document.getElementById('interval-slider');
    const intervalValue = document.getElementById('interval-value');
    intervalSlider?.addEventListener('input', (e) => {
      this.state.chatAutomation.interval = parseInt(e.target.value);
      intervalValue.textContent = `${e.target.value}s`;
      this.saveState();
    });

    // Randomize toggle
    const randomizeToggle = document.getElementById('randomize-toggle');
    randomizeToggle?.addEventListener('change', (e) => {
      this.state.chatAutomation.randomize = e.target.checked;
      this.saveState();
    });

    // Add message
    const newMessageInput = document.getElementById('new-message');
    const addMessageBtn = document.getElementById('add-message-btn');
    
    const addMessage = () => {
      const message = newMessageInput?.value.trim();
      if (message) {
        this.state.chatAutomation.messages.push(message);
        this.saveState();
        this.refreshTab();
      }
    };

    addMessageBtn?.addEventListener('click', addMessage);
    newMessageInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addMessage();
    });

    // Remove message buttons
    document.querySelectorAll('.remove-message').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeMessage(index);
      });
    });
  }

  attachFloodEvents() {
    // Flood detection toggle
    const floodToggle = document.getElementById('flood-toggle');
    floodToggle?.addEventListener('change', (e) => {
      this.state.floodDetection.enabled = e.target.checked;
      this.saveState();
      this.refreshTab();
    });

    // Threshold slider
    const thresholdSlider = document.getElementById('threshold-slider');
    const thresholdValue = document.getElementById('threshold-value');
    thresholdSlider?.addEventListener('input', (e) => {
      this.state.floodDetection.threshold = parseInt(e.target.value);
      thresholdValue.textContent = e.target.value;
      this.saveState();
    });

    // Time window slider
    const timeWindowSlider = document.getElementById('time-window-slider');
    const timeWindowValue = document.getElementById('time-window-value');
    timeWindowSlider?.addEventListener('input', (e) => {
      this.state.floodDetection.timeWindow = parseInt(e.target.value);
      timeWindowValue.textContent = `${e.target.value}s`;
      this.saveState();
    });

    // Enforce unique users toggle
    const enforceUniqueToggle = document.getElementById('enforce-unique-toggle');
    enforceUniqueToggle?.addEventListener('change', (e) => {
      this.state.floodDetection.enforceUniqueUsers = e.target.checked;
      this.saveState();
      this.refreshTab();
    });

    // Unique users required slider
    const uniqueUsersSlider = document.getElementById('unique-users-slider');
    const uniqueUsersValue = document.getElementById('unique-users-value');
    uniqueUsersSlider?.addEventListener('input', (e) => {
      this.state.floodDetection.uniqueUsersRequired = parseInt(e.target.value);
      uniqueUsersValue.textContent = e.target.value;
      this.saveState();
    });

    // Cooldown slider
    const cooldownSlider = document.getElementById('cooldown-slider');
    const cooldownValue = document.getElementById('cooldown-value');
    cooldownSlider?.addEventListener('input', (e) => {
      this.state.floodDetection.cooldownSeconds = parseInt(e.target.value);
      cooldownValue.textContent = `${e.target.value}s`;
      this.saveState();
    });

    // Action select
    const floodAction = document.getElementById('flood-action');
    floodAction?.addEventListener('change', (e) => {
      this.state.floodDetection.action = e.target.value;
      this.saveState();
      this.refreshTab();
    });

    // Add trigger word
    const newTriggerInput = document.getElementById('new-trigger');
    const addTriggerBtn = document.getElementById('add-trigger-btn');
    
    const addTriggerWord = () => {
      const word = newTriggerInput?.value.trim();
      if (word) {
        this.state.floodDetection.triggerWords.push(word);
        this.saveState();
        this.refreshTab();
      }
    };

    addTriggerBtn?.addEventListener('click', addTriggerWord);
    newTriggerInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTriggerWord();
    });

    // Remove trigger word buttons
    document.querySelectorAll('.remove-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeTriggerWord(index);
      });
    });
  }

  attachSendEvents() {
    // Manual message sending
    const manualInput = document.getElementById('manual-message');
    const sendBtn = document.getElementById('send-manual-btn');

    const sendManualMessage = () => {
      const message = manualInput?.value.trim();
      if (message) {
        this.sendMessage(message, 'manual');
        manualInput.value = '';
        this.addToMonitor('You', message, 'manual');
      }
    };

    sendBtn?.addEventListener('click', sendManualMessage);
    manualInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendManualMessage();
      }
    });

    // Quick message buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const message = e.currentTarget.dataset.message;
        this.sendMessage(message, 'manual');
        this.addToMonitor('You', message, 'manual');
      });
    });
  }

  attachMonitorEvents() {
    // Auto-scroll toggle
    const autoScrollToggle = document.getElementById('auto-scroll-toggle');
    autoScrollToggle?.addEventListener('change', (e) => {
      this.state.monitoring.autoScroll = e.target.checked;
      this.saveState();
    });

    // Clear monitor
    const clearBtn = document.getElementById('clear-monitor-btn');
    clearBtn?.addEventListener('click', () => {
      this.state.monitoring.recentMessages = [];
      this.state.monitoring.messagesSinceAuto = 0;
      this.state.monitoring.messagesSinceFlood = 0;
      this.saveState();
      this.refreshTab();
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab buttons
    this.panel.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update content
    this.refreshTab();
  }

  refreshTab() {
    const content = this.panel.querySelector('#tab-content');
    content.innerHTML = this.renderTabContent();
    this.attachTabEvents();
  }

  removeMessage(index) {
    this.state.chatAutomation.messages.splice(index, 1);
    this.saveState();
    this.refreshTab();
  }

  removeTriggerWord(index) {
    if (this.state.floodDetection && this.state.floodDetection.triggerWords) {
      this.state.floodDetection.triggerWords.splice(index, 1);
      this.saveState();
      this.refreshTab();
    }
  }

  startChatAutomation() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }

    const sendAutoMessage = () => {
      const { messages, randomize } = this.state.chatAutomation;
      if (messages.length === 0) return;

      let messageToSend;
      if (randomize) {
        messageToSend = messages[Math.floor(Math.random() * messages.length)];
      } else {
        messageToSend = messages[this.state.chatAutomation.currentIndex];
        this.state.chatAutomation.currentIndex = (this.state.chatAutomation.currentIndex + 1) % messages.length;
      }

      this.sendMessage(messageToSend, 'auto');
      this.addToMonitor('You', messageToSend, 'auto');
      this.state.monitoring.messagesSinceAuto = 0;
      this.saveState();
    };

    sendAutoMessage();
    this.messageInterval = setInterval(sendAutoMessage, this.state.chatAutomation.interval * 1000);
  }

  stopChatAutomation() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }

  sendMessage(msg, type = 'manual') {
    const inputDiv =
      document.querySelector('div[data-input="true"][contenteditable="true"]') ||
      document.querySelector('div[data-test="chat-input"]') ||
      document.querySelector('.editor-input[contenteditable="true"]');

    const sendButton = document.querySelector('#send-message-button');

    if (!inputDiv || !sendButton) {
      console.warn('Chat input or send button not found.');
      return;
    }

    // Focus the input
    inputDiv.focus();

    // Simulate text input using execCommand
    document.execCommand('insertText', false, msg);

    // Dispatch input event for Lexical update
    const inputEvent = new InputEvent('input', { bubbles: true });
    inputDiv.dispatchEvent(inputEvent);

    // Click the send button
    sendButton.click();

    // Update stats
    this.state.stats.totalSent++;
    if (type === 'auto') {
      this.state.stats.autoSent++;
    } else if (type === 'manual') {
      this.state.stats.manualSent++;
    }
    
    this.saveState();
    this.updateStats();
  }

  setupChatObserver() {
    const chatContainer = document.querySelector('[data-chat-entry]')?.parentElement;
    if (!chatContainer) {
      setTimeout(() => this.setupChatObserver(), 1000);
      return;
    }

    this.chatObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-chat-entry')) {
            this.processChatMessage(node);
          }
        });
      });
    });

    this.chatObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  processChatMessage(messageElement) {
    try {
      const usernameElement = messageElement.querySelector('[data-chat-entry-username]');
      const contentElement = messageElement.querySelector('[data-chat-entry-content]');
      
      if (!usernameElement || !contentElement) return;

      const username = usernameElement.textContent.trim();
      const content = contentElement.textContent.trim();
      
      if (!username || !content) return;

      // Add to monitor
      this.addToMonitor(username, content, 'chat');
      
      // Update message counters
      this.state.monitoring.messagesSinceAuto++;
      this.state.monitoring.messagesSinceFlood++;
      
      // Check for flood
      if (this.state.floodDetection.enabled) {
        this.checkFlood(content, username);
      }
      
      this.saveState();
      
    } catch (error) {
      console.log('Error processing chat message:', error);
    }
  }

  checkFlood(message, username) {
    const now = Date.now();
    const { threshold, timeWindow, enforceUniqueUsers, uniqueUsersRequired, cooldownSeconds, lastFloodTime } = this.state.floodDetection;
    
    // Check cooldown
    const timeSinceLastFlood = (now - lastFloodTime) / 1000;
    if (timeSinceLastFlood < cooldownSeconds) {
      return; // Still on cooldown
    }
    
    const normalizedMessage = message.toLowerCase().trim();
    
    // Initialize message tracker if needed
    if (!this.state.floodDetection.messageTracker[normalizedMessage]) {
      this.state.floodDetection.messageTracker[normalizedMessage] = [];
    }
    
    // Clean old entries
    const cutoffTime = now - (timeWindow * 1000);
    this.state.floodDetection.messageTracker[normalizedMessage] = 
      this.state.floodDetection.messageTracker[normalizedMessage].filter(entry => entry.timestamp > cutoffTime);
    
    // Add current message if unique (when enforcing unique users)
    const existingUserEntry = this.state.floodDetection.messageTracker[normalizedMessage]
      .find(entry => entry.user === username);
    
    if (!enforceUniqueUsers || !existingUserEntry) {
      this.state.floodDetection.messageTracker[normalizedMessage].push({
        user: username,
        timestamp: now
      });
    }
    
    // Check if flood threshold is met
    const messageCount = this.state.floodDetection.messageTracker[normalizedMessage].length;
    const uniqueUsers = new Set(this.state.floodDetection.messageTracker[normalizedMessage].map(entry => entry.user)).size;
    
    let isFlood = false;
    
    if (enforceUniqueUsers) {
      isFlood = uniqueUsers >= uniqueUsersRequired && messageCount >= threshold;
    } else {
      isFlood = messageCount >= threshold;
    }
    
    if (isFlood) {
      this.handleFloodDetected(message);
    }
  }

  handleFloodDetected(message) {
    this.state.stats.floodsDetected++;
    this.state.floodDetection.lastFloodTime = Date.now();
    this.state.monitoring.messagesSinceFlood = 0;
    
    if (this.state.floodDetection.action === 'send' && this.state.floodDetection.triggerWords.length > 0) {
      const triggerWord = this.state.floodDetection.triggerWords[
        Math.floor(Math.random() * this.state.floodDetection.triggerWords.length)
      ];
      
      this.sendMessage(triggerWord, 'flood');
      this.addToMonitor('You', triggerWord, 'flood');
      
      // Refresh tab to show cooldown
      if (this.currentTab === 'flood') {
        this.refreshTab();
      }
    }
    
    this.saveState();
    
    // Show notification
    chrome.runtime?.sendMessage({
      action: 'showNotification',
      title: 'Flood Detected!',
      message: `Message "${message.substring(0, 30)}..." repeated ${this.state.floodDetection.threshold}+ times`
    });
  }

  addToMonitor(username, content, type) {
    const timestamp = Date.now();
    
    // Get or assign color for user
    if (!this.userColors.has(username)) {
      const colorIndex = this.userColors.size % this.availableColors.length;
      this.userColors.set(username, this.availableColors[colorIndex]);
    }
    
    const message = {
      user: username,
      userColor: this.userColors.get(username),
      content: content,
      timestamp: timestamp,
      type: type
    };
    
    this.state.monitoring.recentMessages.push(message);
    
    // Keep only last 50 messages
    if (this.state.monitoring.recentMessages.length > 50) {
      this.state.monitoring.recentMessages.shift();
    }
    
    // Auto-scroll to bottom if enabled and on monitor tab
    if (this.state.monitoring.autoScroll && this.currentTab === 'monitor') {
      setTimeout(() => {
        const container = document.getElementById('monitor-messages');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }

  updateStats() {
    // Update browser action badge
    chrome.runtime?.sendMessage({
      action: 'updateBadge',
      text: this.state.stats.totalSent.toString(),
      color: '#8B5CF6'
    });
  }

  show() {
    if (!this.panel) this.createPanel();
    this.panel.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    if (this.panel) {
      this.panel.style.display = 'none';
    }
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    this.stopChatAutomation();
    
    if (this.chatObserver) {
      this.chatObserver.disconnect();
    }
    
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
  }
}

// Global mouse events for dragging
document.addEventListener('mousemove', (e) => {
  if (window.kickPanel?.isDragging) {
    const panel = window.kickPanel.panel;
    panel.style.left = (e.clientX - window.kickPanel.dragOffset.x) + 'px';
    panel.style.top = (e.clientY - window.kickPanel.dragOffset.y) + 'px';
    panel.style.right = 'auto';
  }
});

document.addEventListener('mouseup', () => {
  if (window.kickPanel) {
    window.kickPanel.isDragging = false;
  }
});

// Initialize panel
if (window.location.hostname.includes('kick.com')) {
  // Delay initialization to ensure page is loaded
  setTimeout(() => {
    if (!window.kickPanel) {
      window.kickPanel = new KickControlPanel();
    }
  }, 2000);
}

// Listen for messages from popup/background
chrome.runtime?.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'togglePanel') {
    if (!window.kickPanel) {
      window.kickPanel = new KickControlPanel();
    }
    window.kickPanel.toggle();
  }
});

// CSS styles
const style = document.createElement('style');
style.textContent = `
  .kick-control-panel {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .panel-header {
    background: rgba(139, 92, 246, 0.1);
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  }
  
  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #8b5cf6;
  }
  
  .title-icon {
    font-size: 14px;
  }
  
  .title-text {
    font-size: 13px;
  }
  
  .panel-controls {
    display: flex;
    gap: 4px;
  }
  
  .control-btn {
    width: 20px;
    height: 20px;
    border: none;
    background: rgba(75, 85, 99, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .control-btn:hover {
    background: rgba(139, 92, 246, 0.3);
    color: #e5e7eb;
  }
  
  .panel-content {
    max-height: 500px;
    overflow: hidden;
  }
  
  .tab-navigation {
    display: flex;
    background: rgba(31, 41, 55, 0.5);
    border-bottom: 1px solid rgba(75, 85, 99, 0.3);
  }
  
  .tab-button {
    flex: 1;
    padding: 10px 8px;
    border: none;
    background: transparent;
    color: #9ca3af;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
  }
  
  .tab-button:hover {
    background: rgba(139, 92, 246, 0.1);
    color: #a855f7;
  }
  
  .tab-button.active {
    color: #8b5cf6;
    border-bottom-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
  }
  
  .tab-content {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .tab-section {
    padding: 16px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .section-header h3 {
    font-size: 13px;
    font-weight: 600;
    color: #e5e7eb;
    margin: 0;
  }
  
  .toggle-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .toggle-switch {
    position: relative;
    width: 40px;
    height: 20px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #374151;
    transition: 0.3s;
    border-radius: 20px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  
  .toggle-switch input:checked + .toggle-slider {
    background-color: #8b5cf6;
  }
  
  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }
  
  .toggle-label {
    font-size: 11px;
    color: #9ca3af;
    min-width: 50px;
  }
  
  .settings-group {
    margin-bottom: 16px;
  }
  
  .settings-group label {
    display: block;
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  
  .settings-group input[type="range"] {
    width: 100%;
    margin-bottom: 12px;
  }
  
  .settings-group select {
    width: 100%;
    padding: 6px;
    font-size: 11px;
    margin-bottom: 12px;
  }
  
  .checkbox-container {
    margin: 8px 0;
  }
  
  .checkbox-container label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #9ca3af;
    cursor: pointer;
  }
  
  .messages-section,
  .trigger-words-section {
    margin-bottom: 16px;
  }
  
  .messages-section label,
  .trigger-words-section label {
    display: block;
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 8px;
  }
  
  .add-message-container,
  .add-trigger-container {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .add-message-container input,
  .add-trigger-container input {
    flex: 1;
    padding: 6px;
    font-size: 11px;
  }
  
  .add-message-container button,
  .add-trigger-container button {
    padding: 6px 12px;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .add-message-container button:hover,
  .add-trigger-container button:hover {
    background: #7c3aed;
  }
  
  .messages-list,
  .trigger-words-list {
    max-height: 120px;
    overflow-y: auto;
  }
  
  .message-item,
  .trigger-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px;
    background: rgba(31, 41, 55, 0.3);
    border-radius: 4px;
    margin-bottom: 4px;
  }
  
  .message-text,
  .trigger-text {
    font-size: 11px;
    color: #e5e7eb;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .remove-message,
  .remove-trigger {
    width: 18px;
    height: 18px;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .remove-message:hover,
  .remove-trigger:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 16px;
  }
  
  .stat-item {
    background: rgba(31, 41, 55, 0.3);
    border: 1px solid rgba(75, 85, 99, 0.3);
    border-radius: 6px;
    padding: 8px;
    text-align: center;
  }
  
  .stat-value {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: #8b5cf6;
    margin-bottom: 2px;
  }
  
  .stat-label {
    font-size: 9px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .send-section {
    margin-bottom: 16px;
  }
  
  .manual-input-container {
    margin-bottom: 16px;
  }
  
  .manual-input-container textarea {
    width: 100%;
    padding: 8px;
    font-size: 11px;
    resize: vertical;
    min-height: 60px;
    margin-bottom: 8px;
  }
  
  .manual-input-container button {
    width: 100%;
    padding: 8px;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .manual-input-container button:hover {
    background: #7c3aed;
  }
  
  .quick-messages label {
    display: block;
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 8px;
  }
  
  .quick-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  
  .quick-btn {
    padding: 6px;
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid rgba(75, 85, 99, 0.3);
    color: #e5e7eb;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .quick-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }
  
  .monitor-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .monitor-controls button {
    padding: 4px 8px;
    background: rgba(75, 85, 99, 0.3);
    color: #9ca3af;
    border: 1px solid rgba(75, 85, 99, 0.3);
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .monitor-controls button:hover {
    background: rgba(75, 85, 99, 0.5);
    color: #d1d5db;
  }
  
  .messages-monitor {
    margin-top: 12px;
  }
  
  .monitor-messages {
    max-height: 200px;
    overflow-y: auto;
    background: rgba(31, 41, 55, 0.3);
    border: 1px solid rgba(75, 85, 99, 0.3);
    border-radius: 6px;
    padding: 8px;
  }
  
  .monitor-message {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(75, 85, 99, 0.2);
    font-size: 10px;
    line-height: 1.3;
  }
  
  .monitor-message:last-child {
    border-bottom: none;
  }
  
  .monitor-message.auto {
    background: rgba(139, 92, 246, 0.1);
    border-radius: 4px;
    padding: 4px 6px;
    margin: 2px 0;
  }
  
  .monitor-message.manual {
    background: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
    padding: 4px 6px;
    margin: 2px 0;
  }
  
  .monitor-message.flood {
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    padding: 4px 6px;
    margin: 2px 0;
  }
  
  .message-time {
    color: #6b7280;
    min-width: 35px;
    font-size: 9px;
  }
  
  .message-user {
    font-weight: 600;
    min-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .message-content {
    flex: 1;
    color: #e5e7eb;
    word-break: break-word;
  }
  
  .message-type-badge {
    background: rgba(139, 92, 246, 0.2);
    color: #a855f7;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-left: auto;
  }
  
  .no-messages {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    padding: 20px;
  }

  .cooldown-indicator {
    margin-top: 8px;
    padding: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 6px;
  }

  .cooldown-text {
    font-size: 10px;
    color: #f59e0b;
    display: block;
    margin-bottom: 6px;
  }

  .cooldown-bar {
    width: 100%;
    height: 4px;
    background: rgba(245, 158, 11, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .cooldown-progress {
    height: 100%;
    background: #f59e0b;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
`;

document.head.appendChild(style);