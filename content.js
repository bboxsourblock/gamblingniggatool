class KickControlPanel {
  constructor() {
    this.panel = null;
    this.isVisible = false;
    this.currentTab = 'chat';
    this.chatMessages = [];
    this.messagesSinceAuto = 0;
    this.messagesSinceFlood = 0;
    
    this.state = {
      chatAutomation: {
        enabled: false,
        messages: ['Hello everyone! 👋', 'Thanks for watching! 🎮'],
        interval: 30,
        randomize: false,
        currentIndex: 0,
        intervalId: null
      },
      floodDetection: {
        enabled: false,
        threshold: 3,
        timeWindow: 20,
        uniqueUsers: 5,
        enforceUniqueUsers: true,
        triggerWords: ['flood', 'spam', 'bot'],
        messageTracker: {},
        cooldownSeconds: 5, // NEW: cooldown between flood messages
        lastFloodTime: 0, // NEW: timestamp of last flood message sent
        intervalId: null
      },
      stats: {
        totalSent: 0,
        autoSent: 0,
        manualSent: 0,
        floodsDetected: 0,
        floodsSent: 0
      }
    };

    this.init();
  }

  init() {
    this.loadState();
    this.createPanel();
    this.attachEventListeners();
    this.startChatMonitoring();
    this.startFloodDetection();
    
    window.kickPanel = this;
  }

  createPanel() {
    if (this.panel) {
      this.panel.remove();
    }

    this.panel = document.createElement('div');
    this.panel.className = 'kick-control-panel';
    this.panel.innerHTML = `
      <div class="panel-header" id="panel-header">
        <div class="panel-title">
          <span class="panel-icon">⚡</span>
          <span>Kick Control Panel</span>
        </div>
        <div class="panel-controls">
          <button class="panel-btn minimize-btn" id="minimize-btn">−</button>
          <button class="panel-btn close-btn" id="close-btn">×</button>
        </div>
      </div>
      <div class="panel-content" id="panel-content">
        <div class="tabs">
          <button class="tab-button ${this.currentTab === 'chat' ? 'active' : ''}" data-tab="chat">
            <span class="tab-icon">💬</span>
            Chat
          </button>
          <button class="tab-button ${this.currentTab === 'flood' ? 'active' : ''}" data-tab="flood">
            <span class="tab-icon">🛡️</span>
            Flood
          </button>
          <button class="tab-button ${this.currentTab === 'send' ? 'active' : ''}" data-tab="send">
            <span class="tab-icon">📤</span>
            Send
          </button>
          <button class="tab-button ${this.currentTab === 'monitor' ? 'active' : ''}" data-tab="monitor">
            <span class="tab-icon">📊</span>
            Monitor
          </button>
        </div>
        <div class="tab-content" id="tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      min-height: 500px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      backdrop-filter: blur(10px);
      display: ${this.isVisible ? 'block' : 'none'};
    `;

    document.body.appendChild(this.panel);
    
    this.attachPanelEvents();
    this.refreshTab();
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
        return '';
    }
  }

  renderChatTab() {
    const { enabled, messages, interval, randomize } = this.state.chatAutomation;
    const { totalSent, autoSent } = this.state.stats;
    
    return `
      <div class="tab-panel">
        <div class="section">
          <div class="section-header">
            <h3>💬 Chat Automation</h3>
            <div class="toggle-container">
              <input type="checkbox" id="chat-enabled" ${enabled ? 'checked' : ''}>
              <label for="chat-enabled" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-text">${enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalSent}</div>
              <div class="stat-label">Total Sent</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${autoSent}</div>
              <div class="stat-label">Auto Sent</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.messagesSinceAuto}</div>
              <div class="stat-label">Since Last</div>
            </div>
          </div>

          <div class="control-group">
            <label class="control-label">
              Interval: <span class="control-value">${interval}s</span>
            </label>
            <input type="range" id="chat-interval" min="5" max="300" value="${interval}" 
                   class="control-slider" ${enabled ? 'disabled' : ''}>
          </div>

          <div class="control-group">
            <label class="control-label">
              <input type="checkbox" id="chat-randomize" ${randomize ? 'checked' : ''} ${enabled ? 'disabled' : ''}>
              Randomize message order
            </label>
          </div>

          <div class="messages-section">
            <div class="messages-header">
              <span class="messages-title">Messages (${messages.length})</span>
              <button class="btn btn-sm" id="clear-messages" ${enabled ? 'disabled' : ''}>Clear</button>
            </div>
            
            <div class="message-input-container">
              <input type="text" id="new-message" placeholder="Enter new message..." 
                     class="message-input" maxlength="500" ${enabled ? 'disabled' : ''}>
              <button class="btn btn-primary btn-sm" id="add-message" ${enabled ? 'disabled' : ''}>Add</button>
            </div>

            <div class="messages-list" id="messages-list">
              ${messages.map((msg, i) => `
                <div class="message-item ${this.state.chatAutomation.currentIndex === i ? 'current' : ''}">
                  <span class="message-text">${this.escapeHtml(msg)}</span>
                  <button class="remove-message" data-index="${i}" ${enabled ? 'disabled' : ''}>×</button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn ${enabled ? 'btn-danger' : 'btn-primary'}" id="toggle-chat">
              ${enabled ? 'Stop Chat' : 'Start Chat'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderFloodTab() {
    const { enabled, threshold, timeWindow, uniqueUsers, enforceUniqueUsers, triggerWords, cooldownSeconds } = this.state.floodDetection;
    const { floodsDetected, floodsSent } = this.state.stats;
    const cooldownRemaining = this.getFloodCooldownRemaining();
    
    return `
      <div class="tab-panel">
        <div class="section">
          <div class="section-header">
            <h3>🛡️ Flood Detection</h3>
            <div class="toggle-container">
              <input type="checkbox" id="flood-enabled" ${enabled ? 'checked' : ''}>
              <label for="flood-enabled" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-text">${enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${floodsDetected}</div>
              <div class="stat-label">Floods Detected</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${floodsSent}</div>
              <div class="stat-label">Messages Sent</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.messagesSinceFlood}</div>
              <div class="stat-label">Since Last</div>
            </div>
          </div>

          ${cooldownRemaining > 0 ? `
            <div class="cooldown-status">
              <div class="cooldown-icon">⏱️</div>
              <div class="cooldown-text">
                Cooldown: ${cooldownRemaining}s remaining
              </div>
            </div>
          ` : ''}

          <div class="control-group">
            <label class="control-label">
              Message Threshold: <span class="control-value">${threshold}</span>
            </label>
            <input type="range" id="flood-threshold" min="2" max="10" value="${threshold}" class="control-slider">
          </div>

          <div class="control-group">
            <label class="control-label">
              Time Window: <span class="control-value">${timeWindow}s</span>
            </label>
            <input type="range" id="flood-time-window" min="5" max="60" value="${timeWindow}" class="control-slider">
          </div>

          <div class="control-group">
            <label class="control-label">
              <input type="checkbox" id="enforce-unique-users" ${enforceUniqueUsers ? 'checked' : ''}>
              Require unique users
            </label>
          </div>

          ${enforceUniqueUsers ? `
            <div class="control-group">
              <label class="control-label">
                Unique Users Required: <span class="control-value">${uniqueUsers}</span>
              </label>
              <input type="range" id="flood-unique-users" min="2" max="10" value="${uniqueUsers}" class="control-slider">
            </div>
          ` : ''}

          <div class="control-group">
            <label class="control-label">
              Cooldown Between Floods: <span class="control-value">${cooldownSeconds}s</span>
            </label>
            <input type="range" id="flood-cooldown" min="1" max="60" value="${cooldownSeconds}" class="control-slider">
          </div>

          <div class="trigger-words-section">
            <div class="trigger-words-header">
              <span class="trigger-words-title">Trigger Words (${triggerWords.length})</span>
              <button class="btn btn-sm" id="clear-triggers">Clear</button>
            </div>
            
            <div class="trigger-input-container">
              <input type="text" id="new-trigger" placeholder="Enter trigger word..." 
                     class="trigger-input" maxlength="50">
              <button class="btn btn-primary btn-sm" id="add-trigger">Add</button>
            </div>

            <div class="trigger-words-list" id="trigger-words-list">
              ${triggerWords.map((word, i) => `
                <div class="trigger-item">
                  <span class="trigger-text">${this.escapeHtml(word)}</span>
                  <button class="remove-trigger" data-index="${i}">×</button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn ${enabled ? 'btn-danger' : 'btn-primary'}" id="toggle-flood">
              ${enabled ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderSendTab() {
    const { manualSent } = this.state.stats;
    
    return `
      <div class="tab-panel">
        <div class="section">
          <div class="section-header">
            <h3>📤 Manual Send</h3>
            <div class="manual-stats">
              <span class="manual-count">${manualSent} sent</span>
            </div>
          </div>

          <div class="send-section">
            <div class="manual-input-container">
              <textarea id="manual-message" placeholder="Type your message here..." 
                        class="manual-textarea" maxlength="500" rows="3"></textarea>
              <div class="manual-controls">
                <div class="char-count">
                  <span id="char-count">0</span>/500
                </div>
                <button class="btn btn-primary" id="send-manual">Send Message</button>
              </div>
            </div>

            <div class="quick-messages">
              <div class="quick-messages-title">Quick Messages</div>
              <div class="quick-buttons">
                <button class="btn btn-secondary btn-sm quick-msg" data-msg="Thanks for the follow! 🎉">Thanks Follow</button>
                <button class="btn btn-secondary btn-sm quick-msg" data-msg="Welcome to the stream! 👋">Welcome</button>
                <button class="btn btn-secondary btn-sm quick-msg" data-msg="GG everyone! 🎮">GG</button>
                <button class="btn btn-secondary btn-sm quick-msg" data-msg="Don't forget to subscribe! ⭐">Subscribe</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderMonitorTab() {
    const totalMessages = this.chatMessages.length;
    
    return `
      <div class="tab-panel">
        <div class="section">
          <div class="section-header">
            <h3>📊 Chat Monitor</h3>
            <button class="btn btn-sm" id="clear-monitor">Clear</button>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalMessages}</div>
              <div class="stat-label">Recent Messages</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.messagesSinceAuto}</div>
              <div class="stat-label">Since Auto</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.messagesSinceFlood}</div>
              <div class="stat-label">Since Flood</div>
            </div>
          </div>

          <div class="monitor-controls">
            <label class="control-label">
              <input type="checkbox" id="auto-scroll" checked>
              Auto-scroll to latest
            </label>
          </div>

          <div class="chat-monitor" id="chat-monitor">
            ${this.chatMessages.slice(-20).map(msg => `
              <div class="monitor-message ${msg.type}">
                <div class="monitor-header">
                  <span class="monitor-user" style="color: ${msg.userColor}">${this.escapeHtml(msg.user)}</span>
                  <span class="monitor-time">${msg.time}</span>
                  ${msg.type !== 'chat' ? `<span class="monitor-type">${msg.type}</span>` : ''}
                </div>
                <div class="monitor-text">${this.escapeHtml(msg.text)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getFloodCooldownRemaining() {
    if (!this.state.floodDetection.lastFloodTime) return 0;
    
    const now = Date.now();
    const elapsed = (now - this.state.floodDetection.lastFloodTime) / 1000;
    const remaining = Math.max(0, this.state.floodDetection.cooldownSeconds - elapsed);
    
    return Math.ceil(remaining);
  }

  attachPanelEvents() {
    // Panel dragging
    const header = this.panel.querySelector('#panel-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.panel-btn')) return;
      isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    });

    const handleDrag = (e) => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - this.panel.offsetWidth, e.clientX - dragOffset.x));
      const y = Math.max(0, Math.min(window.innerHeight - this.panel.offsetHeight, e.clientY - dragOffset.y));
      this.panel.style.left = x + 'px';
      this.panel.style.top = y + 'px';
      this.panel.style.right = 'auto';
    };

    const stopDrag = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    // Panel controls
    this.panel.querySelector('#minimize-btn').addEventListener('click', () => {
      const content = this.panel.querySelector('#panel-content');
      const isMinimized = content.style.display === 'none';
      content.style.display = isMinimized ? 'block' : 'none';
      this.panel.querySelector('#minimize-btn').textContent = isMinimized ? '−' : '+';
    });

    this.panel.querySelector('#close-btn').addEventListener('click', () => {
      this.togglePanel();
    });

    // Tab switching
    this.panel.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        this.refreshTab();
      });
    });
  }

  attachChatEvents() {
    // Chat automation controls
    document.getElementById('chat-enabled')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startChatAutomation();
      } else {
        this.stopChatAutomation();
      }
    });

    document.getElementById('chat-interval')?.addEventListener('input', (e) => {
      this.state.chatAutomation.interval = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('chat-randomize')?.addEventListener('change', (e) => {
      this.state.chatAutomation.randomize = e.target.checked;
      this.saveState();
    });

    // Message management
    document.getElementById('add-message')?.addEventListener('click', () => {
      const input = document.getElementById('new-message');
      const message = input.value.trim();
      if (message) {
        this.state.chatAutomation.messages.push(message);
        input.value = '';
        this.saveState();
        this.refreshTab();
      }
    });

    document.getElementById('new-message')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-message')?.click();
      }
    });

    document.getElementById('clear-messages')?.addEventListener('click', () => {
      this.state.chatAutomation.messages = [];
      this.state.chatAutomation.currentIndex = 0;
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('toggle-chat')?.addEventListener('click', () => {
      if (this.state.chatAutomation.enabled) {
        this.stopChatAutomation();
      } else {
        this.startChatAutomation();
      }
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
    // Flood detection controls
    document.getElementById('flood-enabled')?.addEventListener('change', (e) => {
      this.state.floodDetection.enabled = e.target.checked;
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-threshold')?.addEventListener('input', (e) => {
      this.state.floodDetection.threshold = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-time-window')?.addEventListener('input', (e) => {
      this.state.floodDetection.timeWindow = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-unique-users')?.addEventListener('input', (e) => {
      this.state.floodDetection.uniqueUsers = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('enforce-unique-users')?.addEventListener('change', (e) => {
      this.state.floodDetection.enforceUniqueUsers = e.target.checked;
      this.saveState();
      this.refreshTab();
    });

    // NEW: Cooldown slider
    document.getElementById('flood-cooldown')?.addEventListener('input', (e) => {
      this.state.floodDetection.cooldownSeconds = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    // Trigger word management
    document.getElementById('add-trigger')?.addEventListener('click', () => {
      const input = document.getElementById('new-trigger');
      const word = input.value.trim().toLowerCase();
      if (word && !this.state.floodDetection.triggerWords.includes(word)) {
        this.state.floodDetection.triggerWords.push(word);
        input.value = '';
        this.saveState();
        this.refreshTab();
      }
    });

    document.getElementById('new-trigger')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-trigger')?.click();
      }
    });

    document.getElementById('clear-triggers')?.addEventListener('click', () => {
      this.state.floodDetection.triggerWords = [];
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('toggle-flood')?.addEventListener('click', () => {
      this.state.floodDetection.enabled = !this.state.floodDetection.enabled;
      this.saveState();
      this.refreshTab();
    });

    // Remove trigger buttons
    document.querySelectorAll('.remove-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeTriggerWord(index);
      });
    });
  }

  attachSendEvents() {
    const textarea = document.getElementById('manual-message');
    const charCount = document.getElementById('char-count');
    const sendBtn = document.getElementById('send-manual');

    textarea?.addEventListener('input', (e) => {
      const length = e.target.value.length;
      charCount.textContent = length;
      charCount.style.color = length > 450 ? '#ef4444' : '#9ca3af';
    });

    textarea?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendBtn?.click();
      }
    });

    sendBtn?.addEventListener('click', () => {
      const message = textarea.value.trim();
      if (message) {
        this.sendMessage(message);
        this.addChatMessage('You', message, 'manual');
        this.state.stats.totalSent++;
        this.state.stats.manualSent++;
        this.saveState();
        textarea.value = '';
        charCount.textContent = '0';
        this.refreshTab();
      }
    });

    // Quick message buttons
    document.querySelectorAll('.quick-msg').forEach(btn => {
      btn.addEventListener('click', () => {
        const message = btn.dataset.msg;
        textarea.value = message;
        charCount.textContent = message.length;
      });
    });
  }

  attachMonitorEvents() {
    document.getElementById('clear-monitor')?.addEventListener('click', () => {
      this.chatMessages = [];
      this.messagesSinceAuto = 0;
      this.messagesSinceFlood = 0;
      this.saveState();
      this.refreshTab();
    });
  }

  refreshTab() {
    const tabContent = this.panel?.querySelector('#tab-content');
    if (!tabContent) return;

    // Update active tab
    this.panel.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.currentTab);
    });

    // Render content
    tabContent.innerHTML = this.renderTabContent();

    // Attach events based on current tab
    switch (this.currentTab) {
      case 'chat':
        this.attachChatEvents();
        break;
      case 'flood':
        this.attachFloodEvents();
        break;
      case 'send':
        this.attachSendEvents();
        break;
      case 'monitor':
        this.attachMonitorEvents();
        break;
    }

    this.updatePanelStats();
  }

  removeMessage(index) {
    if (this.state.chatAutomation.messages[index]) {
      this.state.chatAutomation.messages.splice(index, 1);
      if (this.state.chatAutomation.currentIndex >= this.state.chatAutomation.messages.length) {
        this.state.chatAutomation.currentIndex = 0;
      }
      this.saveState();
      this.refreshTab();
    }
  }

  removeTriggerWord(index) {
    if (this.state.floodDetection && this.state.floodDetection.triggerWords) {
      this.state.floodDetection.triggerWords.splice(index, 1);
      this.saveState();
      this.refreshTab();
    }
  }

  startChatAutomation() {
    if (this.state.chatAutomation.messages.length === 0) {
      this.addActivityMessage('Cannot start: No messages configured', 'error');
      return;
    }

    this.state.chatAutomation.enabled = true;
    this.state.chatAutomation.intervalId = setInterval(() => {
      this.sendNextMessage();
    }, this.state.chatAutomation.interval * 1000);

    this.saveState();
    this.addActivityMessage(`Chat automation started (${this.state.chatAutomation.interval}s interval)`, 'success');
    this.refreshTab();
  }

  stopChatAutomation() {
    this.state.chatAutomation.enabled = false;
    if (this.state.chatAutomation.intervalId) {
      clearInterval(this.state.chatAutomation.intervalId);
      this.state.chatAutomation.intervalId = null;
    }
    
    this.saveState();
    this.addActivityMessage('Chat automation stopped', 'info');
    this.refreshTab();
  }

  sendNextMessage() {
    const { messages, randomize, currentIndex } = this.state.chatAutomation;
    
    if (messages.length === 0) {
      this.stopChatAutomation();
      return;
    }

    let messageIndex;
    if (randomize) {
      messageIndex = Math.floor(Math.random() * messages.length);
    } else {
      messageIndex = currentIndex;
      this.state.chatAutomation.currentIndex = (currentIndex + 1) % messages.length;
    }

    const message = messages[messageIndex];
    this.sendMessage(message);
    this.addChatMessage('You', message, 'auto');
    
    this.state.stats.totalSent++;
    this.state.stats.autoSent++;
    this.messagesSinceAuto = 0;
    
    this.saveState();
    this.addActivityMessage(`Auto sent: ${message}`, 'success');
    this.refreshTab();
  }

  sendMessage(msg) {
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
  }

  startChatMonitoring() {
    const checkForMessages = () => {
      const chatContainer = document.querySelector('.chat-container') || 
                           document.querySelector('[data-test="chat-messages"]') ||
                           document.querySelector('.chat-messages');

      if (chatContainer) {
        const messageElements = chatContainer.querySelectorAll('.chat-entry, .message-item, [data-test="chat-message"]');
        
        messageElements.forEach(element => {
          if (element.dataset.processed) return;
          
          const userElement = element.querySelector('.username, .chat-entry-username, [data-test="username"]');
          const messageElement = element.querySelector('.message, .chat-entry-message, [data-test="message-text"]') || element;
          
          if (userElement && messageElement) {
            const userName = userElement.textContent.trim();
            const messageText = messageElement.textContent.trim();
            
            if (userName && messageText && !messageText.includes('You:')) {
              this.addChatMessage(userName, messageText, 'chat');
              this.messagesSinceAuto++;
              this.messagesSinceFlood++;
              element.dataset.processed = 'true';
            }
          }
        });
      }

      setTimeout(checkForMessages, 1000);
    };

    checkForMessages();
  }

  startFloodDetection() {
    // Clean up old message tracker every 30 seconds
    this.state.floodDetection.intervalId = setInterval(() => {
      this.cleanupMessageTracker();
    }, 30000);
  }

  checkFlood(userName, messageText) {
    if (!this.state.floodDetection.enabled) return;

    const normalizedMessage = messageText.toLowerCase().trim();
    const now = Date.now();
    const { threshold, timeWindow, uniqueUsers, enforceUniqueUsers, triggerWords } = this.state.floodDetection;

    // Check if message contains trigger words
    const containsTrigger = triggerWords.some(word => 
      normalizedMessage.includes(word.toLowerCase())
    );

    if (!containsTrigger) return;

    // Initialize message tracker for this message
    if (!this.state.floodDetection.messageTracker[normalizedMessage]) {
      this.state.floodDetection.messageTracker[normalizedMessage] = [];
    }

    const tracker = this.state.floodDetection.messageTracker[normalizedMessage];

    // Add this occurrence if unique user or unique users not enforced
    const isUnique = !enforceUniqueUsers || !tracker.some(entry => entry.user === userName);
    
    if (isUnique) {
      tracker.push({
        user: userName,
        timestamp: now
      });
    }

    // Clean old entries outside time window
    const cutoff = now - (timeWindow * 1000);
    this.state.floodDetection.messageTracker[normalizedMessage] = tracker.filter(
      entry => entry.timestamp > cutoff
    );

    const currentTracker = this.state.floodDetection.messageTracker[normalizedMessage];
    const uniqueUserCount = new Set(currentTracker.map(entry => entry.user)).size;

    // Check if flood threshold is met
    let floodDetected = false;
    if (enforceUniqueUsers) {
      floodDetected = uniqueUserCount >= uniqueUsers && currentTracker.length >= threshold;
    } else {
      floodDetected = currentTracker.length >= threshold;
    }

    if (floodDetected) {
      this.state.stats.floodsDetected++;
      
      // Check cooldown before sending
      const cooldownRemaining = this.getFloodCooldownRemaining();
      if (cooldownRemaining > 0) {
        this.addActivityMessage(`Flood detected but cooldown active (${cooldownRemaining}s remaining)`, 'warning');
        this.saveState();
        return;
      }

      // Send flood message
      this.sendMessage(messageText);
      this.addChatMessage('You', messageText, 'flood');
      
      // Update cooldown timestamp
      this.state.floodDetection.lastFloodTime = now;
      
      this.state.stats.totalSent++;
      this.state.stats.floodsSent++;
      this.messagesSinceFlood = 0;
      
      this.addActivityMessage(`Flood detected and sent: ${messageText}`, 'success');
      this.saveState();
      
      // Clear this message from tracker to prevent spam
      delete this.state.floodDetection.messageTracker[normalizedMessage];
      
      this.refreshTab();
    }
  }

  cleanupMessageTracker() {
    const now = Date.now();
    const cutoff = now - (this.state.floodDetection.timeWindow * 1000);

    Object.keys(this.state.floodDetection.messageTracker).forEach(message => {
      this.state.floodDetection.messageTracker[message] = 
        this.state.floodDetection.messageTracker[message].filter(
          entry => entry.timestamp > cutoff
        );

      // Remove empty trackers
      if (this.state.floodDetection.messageTracker[message].length === 0) {
        delete this.state.floodDetection.messageTracker[message];
      }
    });
  }

  addChatMessage(user, text, type = 'chat') {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Generate consistent color for user
    let userColor = '#9ca3af';
    if (type === 'chat') {
      const hash = user.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const hue = Math.abs(hash) % 360;
      userColor = `hsl(${hue}, 60%, 65%)`;
    } else if (type === 'auto') {
      userColor = '#8b5cf6';
    } else if (type === 'manual') {
      userColor = '#10b981';
    } else if (type === 'flood') {
      userColor = '#ef4444';
    }

    this.chatMessages.push({
      user,
      text,
      time,
      type,
      userColor,
      timestamp: now.getTime()
    });

    // Keep only last 50 messages for performance
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }

    // Check for flood if it's a chat message
    if (type === 'chat') {
      this.checkFlood(user, text);
    }

    // Auto-scroll in monitor tab if enabled
    if (this.currentTab === 'monitor') {
      setTimeout(() => {
        const monitor = document.getElementById('chat-monitor');
        const autoScroll = document.getElementById('auto-scroll');
        if (monitor && autoScroll?.checked) {
          monitor.scrollTop = monitor.scrollHeight;
        }
      }, 100);
    }
  }

  addActivityMessage(message, type = 'info') {
    // This could be expanded to show in a dedicated activity feed
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  attachEventListeners() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'togglePanel') {
        this.togglePanel();
        sendResponse({ success: true });
      }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, pause intensive operations
      } else {
        // Page is visible, resume operations
        this.updatePanelStats();
      }
    });
  }

  togglePanel() {
    this.isVisible = !this.isVisible;
    if (this.panel) {
      this.panel.style.display = this.isVisible ? 'block' : 'none';
    }
    
    if (this.isVisible) {
      this.updatePanelStats();
    }
  }

  updatePanelStats() {
    // Update extension badge
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      text: this.state.stats.totalSent.toString(),
      color: this.state.chatAutomation.enabled || this.state.floodDetection.enabled ? '#10B981' : '#8B5CF6'
    });

    // Store stats for popup
    chrome.storage.local.set({
      panelStats: this.state.stats,
      panelState: {
        chatAutomation: { enabled: this.state.chatAutomation.enabled },
        floodDetection: { enabled: this.state.floodDetection.enabled }
      }
    });
  }

  saveState() {
    try {
      localStorage.setItem('kickControlPanel', JSON.stringify({
        state: this.state,
        messagesSinceAuto: this.messagesSinceAuto,
        messagesSinceFlood: this.messagesSinceFlood,
        chatMessages: this.chatMessages.slice(-20) // Save only recent messages
      }));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('kickControlPanel');
      if (saved) {
        const data = JSON.parse(saved);
        this.state = { ...this.state, ...data.state };
        this.messagesSinceAuto = data.messagesSinceAuto || 0;
        this.messagesSinceFlood = data.messagesSinceFlood || 0;
        this.chatMessages = data.chatMessages || [];
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new KickControlPanel();
  });
} else {
  new KickControlPanel();
}

// Add required styles
if (!document.getElementById('kick-control-panel-styles')) {
  const style = document.createElement('style');
  style.id = 'kick-control-panel-styles';
  style.textContent = `
    .kick-control-panel {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
    }

    .kick-control-panel * {
      box-sizing: border-box;
    }

    .kick-control-panel .panel-header {
      background: rgba(139, 92, 246, 0.1);
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    }

    .kick-control-panel .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #8b5cf6;
    }

    .kick-control-panel .panel-icon {
      font-size: 16px;
    }

    .kick-control-panel .panel-controls {
      display: flex;
      gap: 4px;
    }

    .kick-control-panel .panel-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(75, 85, 99, 0.3);
      color: #9ca3af;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .kick-control-panel .panel-btn:hover {
      background: rgba(75, 85, 99, 0.5);
      color: #d1d5db;
    }

    .kick-control-panel .close-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }

    .kick-control-panel .panel-content {
      height: calc(100% - 48px);
      overflow: hidden;
    }

    .kick-control-panel .tabs {
      display: flex;
      border-bottom: 1px solid rgba(75, 85, 99, 0.3);
      background: rgba(31, 41, 55, 0.3);
    }

    .kick-control-panel .tab-button {
      flex: 1;
      padding: 10px 8px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .kick-control-panel .tab-button:hover {
      background: rgba(139, 92, 246, 0.05);
      color: #a855f7;
    }

    .kick-control-panel .tab-button.active {
      color: #8b5cf6;
      border-bottom-color: #8b5cf6;
      background: rgba(139, 92, 246, 0.1);
    }

    .kick-control-panel .tab-icon {
      font-size: 12px;
    }

    .kick-control-panel .tab-content {
      height: calc(100% - 41px);
      overflow-y: auto;
    }

    .kick-control-panel .tab-panel {
      padding: 16px;
      height: 100%;
    }

    .kick-control-panel .section {
      margin-bottom: 20px;
    }

    .kick-control-panel .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .kick-control-panel .section-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kick-control-panel .toggle-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .kick-control-panel .toggle-label {
      position: relative;
      width: 40px;
      height: 20px;
      background: #374151;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .kick-control-panel .toggle-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s ease;
    }

    .kick-control-panel input[type="checkbox"]:checked + .toggle-label {
      background: #8b5cf6;
    }

    .kick-control-panel input[type="checkbox"]:checked + .toggle-label .toggle-slider {
      transform: translateX(20px);
    }

    .kick-control-panel input[type="checkbox"] {
      display: none;
    }

    .kick-control-panel .toggle-text {
      font-size: 11px;
      color: #9ca3af;
      font-weight: 500;
    }

    .kick-control-panel .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .kick-control-panel .stat-card {
      background: rgba(31, 41, 55, 0.5);
      border: 1px solid rgba(75, 85, 99, 0.3);
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }

    .kick-control-panel .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #8b5cf6;
      margin-bottom: 2px;
    }

    .kick-control-panel .stat-label {
      font-size: 9px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kick-control-panel .cooldown-status {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .kick-control-panel .cooldown-icon {
      font-size: 14px;
    }

    .kick-control-panel .cooldown-text {
      font-size: 11px;
      color: #f59e0b;
      font-weight: 500;
    }

    .kick-control-panel .control-group {
      margin-bottom: 12px;
    }

    .kick-control-panel .control-label {
      display: block;
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 6px;
      font-weight: 500;
    }

    .kick-control-panel .control-value {
      color: #8b5cf6;
      font-weight: 600;
    }

    .kick-control-panel .control-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #374151;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    .kick-control-panel .control-slider::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #8b5cf6;
      cursor: pointer;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .kick-control-panel .control-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #8b5cf6;
      cursor: pointer;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .kick-control-panel .messages-section,
    .kick-control-panel .trigger-words-section {
      background: rgba(31, 41, 55, 0.3);
      border: 1px solid rgba(75, 85, 99, 0.2);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .kick-control-panel .messages-header,
    .kick-control-panel .trigger-words-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .kick-control-panel .messages-title,
    .kick-control-panel .trigger-words-title {
      font-size: 12px;
      font-weight: 600;
      color: #d1d5db;
    }

    .kick-control-panel .message-input-container,
    .kick-control-panel .trigger-input-container {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .kick-control-panel .message-input,
    .kick-control-panel .trigger-input {
      flex: 1;
      padding: 8px 10px;
      background: rgba(31, 41, 55, 0.5);
      border: 1px solid rgba(75, 85, 99, 0.3);
      border-radius: 4px;
      color: #e5e7eb;
      font-size: 12px;
      outline: none;
    }

    .kick-control-panel .message-input:focus,
    .kick-control-panel .trigger-input:focus {
      border-color: rgba(139, 92, 246, 0.5);
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
    }

    .kick-control-panel .messages-list,
    .kick-control-panel .trigger-words-list {
      max-height: 120px;
      overflow-y: auto;
    }

    .kick-control-panel .message-item,
    .kick-control-panel .trigger-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 4px;
      background: rgba(75, 85, 99, 0.2);
      border-radius: 4px;
      font-size: 11px;
    }

    .kick-control-panel .message-item.current {
      border: 1px solid rgba(139, 92, 246, 0.5);
      background: rgba(139, 92, 246, 0.1);
    }

    .kick-control-panel .message-text,
    .kick-control-panel .trigger-text {
      flex: 1;
      color: #d1d5db;
      word-break: break-word;
      margin-right: 8px;
    }

    .kick-control-panel .remove-message,
    .kick-control-panel .remove-trigger {
      width: 20px;
      height: 20px;
      border: none;
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .kick-control-panel .remove-message:hover,
    .kick-control-panel .remove-trigger:hover {
      background: rgba(239, 68, 68, 0.3);
    }

    .kick-control-panel .send-section {
      background: rgba(31, 41, 55, 0.3);
      border: 1px solid rgba(75, 85, 99, 0.2);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .kick-control-panel .manual-stats {
      font-size: 11px;
      color: #9ca3af;
    }

    .kick-control-panel .manual-count {
      color: #8b5cf6;
      font-weight: 600;
    }

    .kick-control-panel .manual-input-container {
      margin-bottom: 12px;
    }

    .kick-control-panel .manual-textarea {
      width: 100%;
      padding: 10px;
      background: rgba(31, 41, 55, 0.5);
      border: 1px solid rgba(75, 85, 99, 0.3);
      border-radius: 6px;
      color: #e5e7eb;
      font-size: 12px;
      resize: vertical;
      outline: none;
      font-family: inherit;
      margin-bottom: 8px;
    }

    .kick-control-panel .manual-textarea:focus {
      border-color: rgba(139, 92, 246, 0.5);
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
    }

    .kick-control-panel .manual-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kick-control-panel .char-count {
      font-size: 10px;
      color: #9ca3af;
    }

    .kick-control-panel .quick-messages {
      margin-top: 12px;
    }

    .kick-control-panel .quick-messages-title {
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .kick-control-panel .quick-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .kick-control-panel .chat-monitor {
      max-height: 200px;
      overflow-y: auto;
      background: rgba(31, 41, 55, 0.3);
      border: 1px solid rgba(75, 85, 99, 0.2);
      border-radius: 6px;
      padding: 8px;
    }

    .kick-control-panel .monitor-message {
      margin-bottom: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      background: rgba(75, 85, 99, 0.2);
      font-size: 11px;
    }

    .kick-control-panel .monitor-message.auto {
      background: rgba(139, 92, 246, 0.1);
      border-left: 3px solid #8b5cf6;
    }

    .kick-control-panel .monitor-message.manual {
      background: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
    }

    .kick-control-panel .monitor-message.flood {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
    }

    .kick-control-panel .monitor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .kick-control-panel .monitor-user {
      font-weight: 600;
      font-size: 10px;
    }

    .kick-control-panel .monitor-time {
      font-size: 9px;
      color: #9ca3af;
    }

    .kick-control-panel .monitor-type {
      font-size: 8px;
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.2);
      padding: 1px 4px;
      border-radius: 8px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .kick-control-panel .monitor-text {
      color: #d1d5db;
      word-break: break-word;
      line-height: 1.3;
    }

    .kick-control-panel .monitor-controls {
      margin-bottom: 12px;
    }

    .kick-control-panel .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .kick-control-panel .btn {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .kick-control-panel .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .kick-control-panel .btn:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .kick-control-panel .btn-primary {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
    }

    .kick-control-panel .btn-secondary {
      background: rgba(75, 85, 99, 0.3);
      color: #9ca3af;
      border: 1px solid rgba(75, 85, 99, 0.3);
    }

    .kick-control-panel .btn-secondary:hover {
      background: rgba(75, 85, 99, 0.5);
      color: #d1d5db;
    }

    .kick-control-panel .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }

    .kick-control-panel .btn-sm {
      padding: 4px 8px;
      font-size: 10px;
    }

    .kick-control-panel .quick-msg {
      font-size: 9px;
      padding: 4px 6px;
    }

    /* Scrollbar styles */
    .kick-control-panel ::-webkit-scrollbar {
      width: 6px;
    }

    .kick-control-panel ::-webkit-scrollbar-track {
      background: rgba(31, 41, 55, 0.3);
      border-radius: 3px;
    }

    .kick-control-panel ::-webkit-scrollbar-thumb {
      background: rgba(75, 85, 99, 0.5);
      border-radius: 3px;
    }

    .kick-control-panel ::-webkit-scrollbar-thumb:hover {
      background: rgba(75, 85, 99, 0.7);
    }

    /* Animation */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .kick-control-panel .monitor-message {
      animation: fadeInUp 0.3s ease;
    }
  `;
  
  document.head.appendChild(style);
}