class KickControlPanel {
  constructor() {
    this.state = {
      isMinimized: false,
      position: { x: 20, y: 20 },
      activeTab: 'chat',
      chatAutomation: {
        enabled: false,
        messages: ['Hello chat! 👋', 'Great stream!', 'Keep it up!'],
        interval: 30,
        randomize: true,
        currentIndex: 0,
      },
      floodDetection: {
        enabled: false,
        mode: 'any', // 'any' or 'trigger'
        threshold: 3,
        timeWindow: 10,
        actionType: 'send',
        enforceUniqueUsers: true,
        uniqueUserThreshold: 2, // How many unique users needed when enforcing unique users
        triggerWords: ['GG', 'KEKW', 'PogChamp'],
        messageTracker: {},
        recentMessages: []
      },
      chatMonitor: {
        recentMessages: [],
        maxMessages: 50,
        messagesSinceLastAuto: 0,
        messagesSinceLastFlood: 0,
        showUserColors: true,
        autoScroll: true
      },
      manualMessage: '',
      statusMessages: [],
      isDragging: false,
      stats: {
        messagesSent: 0,
        floodsDetected: 0,
        autoMessagesSent: 0,
        manualMessagesSent: 0,
        totalChatMessages: 0,
      }
    };

    this.chatInterval = null;
    this.messageObserver = null;
    this.cleanupInterval = null;
    this.init();
  }

  init() {
    this.loadState();
    this.createPanel();
    this.attachEventListeners();
    this.startMessageMonitoring();
    this.startPeriodicCleanup();
    this.addStatusMessage('Control panel initialized', 'success');
    this.updateStats();
  }

  loadState() {
    const savedState = localStorage.getItem('kickControlPanelState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        this.state = { ...this.state, ...parsed };
      } catch (error) {
        console.log('Failed to load saved state:', error);
      }
    }
  }

  saveState() {
    try {
      localStorage.setItem('kickControlPanelState', JSON.stringify(this.state));
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          panelState: this.state,
          panelStats: this.state.stats
        });
      }
    } catch (error) {
      console.log('Failed to save state:', error);
    }
  }

  updateStats() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage({
          action: 'updatePopupStats',
          stats: this.state.stats,
          state: this.state
        });
      } catch (error) {
        // Popup might not be open
      }
    }
  }

  createPanel() {
    const existing = document.getElementById('kick-control-panel');
    if (existing) {
      existing.remove();
    }

    this.panel = document.createElement('div');
    this.panel.id = 'kick-control-panel';
    this.panel.className = 'kick-control-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: ${this.state.position.y}px;
      left: ${this.state.position.x}px;
      width: 350px;
      height: ${this.state.isMinimized ? '50px' : '500px'};
      background: rgba(17, 24, 39, 0.96);
      border: 1px solid rgba(139, 92, 246, 0.4);
      border-radius: 12px;
      backdrop-filter: blur(12px);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e5e7eb;
      overflow: hidden;
      transition: all 0.3s ease;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.1);
    `;

    this.createHeader();
    this.createContent();
    
    document.body.appendChild(this.panel);
  }

  createHeader() {
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(139, 92, 246, 0.1);
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
      cursor: move;
      user-select: none;
    `;

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="currentColor" style="color: #8b5cf6;">
          <circle cx="9" cy="9" r="7"/>
          <path d="M9 11h.01"/>
          <path d="M9 6v3"/>
        </svg>
        <span style="font-weight: 600; font-size: 14px;">Kick Control Panel</span>
      </div>
      <button id="minimize-btn" style="
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      " onmouseover="this.style.color='#8b5cf6'" onmouseout="this.style.color='#9ca3af'">
        <svg width="16" height="16" fill="currentColor">
          <path d="${this.state.isMinimized ? 'M4 8h8v2H4z' : 'M4 6h8v2H4zm0 4h8v2H4z'}"/>
        </svg>
      </button>
    `;

    this.panel.appendChild(header);
  }

  createContent() {
    if (this.state.isMinimized) return;

    const content = document.createElement('div');
    content.className = 'panel-content';
    content.style.cssText = `
      display: flex;
      flex-direction: column;
      height: calc(100% - 53px);
    `;

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    tabs.style.cssText = `
      display: flex;
      background: rgba(31, 41, 55, 0.5);
      border-bottom: 1px solid rgba(75, 85, 99, 0.3);
    `;

    const tabItems = [
      { id: 'chat', label: 'Chat', icon: 'M8 12l-4.5 3L5 12l-3-3h10.5L12 12l-4.5 3L8 12z' },
      { id: 'flood', label: 'Flood', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
      { id: 'monitor', label: 'Monitor', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0l2-2m0 0l7-7' },
      { id: 'manual', label: 'Send', icon: 'M22 2L11 13l-4-4-4.5 4.5L11 22l11-11z' },
      { id: 'status', label: 'Status', icon: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' }
    ];

    tabItems.forEach(tab => {
      const button = document.createElement('button');
      button.className = 'tab-button';
      button.dataset.tab = tab.id;
      button.style.cssText = `
        flex: 1;
        padding: 12px 8px;
        background: none;
        border: none;
        color: ${this.state.activeTab === tab.id ? '#8b5cf6' : '#9ca3af'};
        cursor: pointer;
        transition: all 0.2s;
        font-size: 11px;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        ${this.state.activeTab === tab.id ? 'background: rgba(139, 92, 246, 0.1); border-bottom: 2px solid #8b5cf6;' : ''}
      `;

      button.innerHTML = `
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
          <path d="${tab.icon}"/>
        </svg>
        <span>${tab.label}</span>
      `;

      button.addEventListener('click', () => this.switchTab(tab.id));
      tabs.appendChild(button);
    });

    content.appendChild(tabs);

    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    `;

    this.renderTabContent(tabContent);
    content.appendChild(tabContent);
    this.panel.appendChild(content);
  }

  renderTabContent(container) {
    container.innerHTML = '';

    switch (this.state.activeTab) {
      case 'chat':
        this.renderChatTab(container);
        break;
      case 'flood':
        this.renderFloodTab(container);
        break;
      case 'monitor':
        this.renderMonitorTab(container);
        break;
      case 'manual':
        this.renderManualTab(container);
        break;
      case 'status':
        this.renderStatusTab(container);
        break;
    }
  }

  renderChatTab(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" fill="currentColor" style="color: #8b5cf6;">
            <circle cx="8" cy="8" r="6"/>
            <path d="M8 10h.01"/>
            <path d="M8 6v2"/>
          </svg>
          Chat Automation
        </h3>
        <button id="chat-toggle" style="
          padding: 6px 12px;
          border-radius: 16px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          ${this.state.chatAutomation.enabled 
            ? 'background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);'
            : 'background: rgba(75, 85, 99, 0.2); color: #9CA3AF; border: 1px solid rgba(75, 85, 99, 0.3);'
          }
        ">
          ${this.state.chatAutomation.enabled ? '⏸ Stop' : '▶ Start'}
        </button>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Interval: ${this.state.chatAutomation.interval}s
        </label>
        <input type="range" id="chat-interval" min="5" max="300" value="${this.state.chatAutomation.interval}" 
               ${this.state.chatAutomation.enabled ? 'disabled' : ''}
               style="width: 100%; height: 6px; background: #374151; border-radius: 3px; outline: none; cursor: pointer;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d1d5db; cursor: pointer;">
          <input type="checkbox" id="chat-randomize" ${this.state.chatAutomation.randomize ? 'checked' : ''} 
                 ${this.state.chatAutomation.enabled ? 'disabled' : ''}
                 style="width: 16px; height: 16px;">
          Randomize message order
        </label>
      </div>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Messages (${this.state.chatAutomation.messages.length})
        </label>
        <div id="messages-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 8px;">
          ${this.state.chatAutomation.messages.map((msg, index) => `
            <div style="
              display: flex; 
              align-items: center; 
              gap: 8px; 
              padding: 8px; 
              margin-bottom: 4px;
              background: ${index === this.state.chatAutomation.currentIndex && this.state.chatAutomation.enabled 
                ? 'rgba(139, 92, 246, 0.1)' : 'rgba(31, 41, 55, 0.5)'};
              border: 1px solid ${index === this.state.chatAutomation.currentIndex && this.state.chatAutomation.enabled 
                ? 'rgba(139, 92, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)'};
              border-radius: 6px;
              font-size: 12px;
            ">
              <span style="color: #6b7280; min-width: 16px;">${index + 1}</span>
              <span style="flex: 1; color: #e5e7eb; word-break: break-word;">${msg}</span>
              <button class="remove-message" data-index="${index}" 
                      ${this.state.chatAutomation.enabled ? 'disabled' : ''}
                      style="color: #ef4444; background: none; border: none; cursor: pointer; padding: 2px;">
                ✕
              </button>
            </div>
          `).join('')}
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="new-message" placeholder="Add new message..." 
                 ${this.state.chatAutomation.enabled ? 'disabled' : ''}
                 style="
                   flex: 1; 
                   padding: 8px; 
                   background: rgba(31, 41, 55, 0.5); 
                   border: 1px solid rgba(75, 85, 99, 0.3); 
                   border-radius: 6px; 
                   color: #e5e7eb; 
                   font-size: 12px;
                   outline: none;
                 ">
          <button id="add-message" ${this.state.chatAutomation.enabled ? 'disabled' : ''}
                  style="
                    padding: 8px 12px; 
                    background: rgba(139, 92, 246, 0.2); 
                    border: 1px solid rgba(139, 92, 246, 0.3); 
                    border-radius: 6px; 
                    color: #8b5cf6; 
                    font-size: 12px; 
                    cursor: pointer;
                    transition: all 0.2s;
                  ">
            Add
          </button>
        </div>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: rgba(31, 41, 55, 0.3); border-radius: 6px; font-size: 11px; color: #9ca3af;">
        Auto Messages Sent: <span style="color: #8b5cf6; font-weight: 600;">${this.state.stats.autoMessagesSent}</span> • 
        Messages Since Last: <span style="color: #10b981; font-weight: 600;">${this.state.chatMonitor.messagesSinceLastAuto}</span>
      </div>
    `;

    this.attachChatEventListeners();
  }

  renderFloodTab(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" fill="currentColor" style="color: #ef4444;">
            <path d="M12 9a4 4 0 0 0-8 0v7a4 4 0 0 0 8 0V9Z"/>
            <path d="M5 9V5a7 7 0 0 1 14 0v4"/>
          </svg>
          Flood Detection
        </h3>
        <button id="flood-toggle" style="
          padding: 6px 12px;
          border-radius: 16px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          ${this.state.floodDetection.enabled 
            ? 'background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);'
            : 'background: rgba(75, 85, 99, 0.2); color: #9CA3AF; border: 1px solid rgba(75, 85, 99, 0.3);'
          }
        ">
          ${this.state.floodDetection.enabled ? '🛡 Active' : '🔒 Inactive'}
        </button>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Detection Mode
        </label>
        <select id="flood-mode" style="
          width: 100%; 
          padding: 8px; 
          background: rgba(31, 41, 55, 0.5); 
          border: 1px solid rgba(75, 85, 99, 0.3); 
          border-radius: 6px; 
          color: #e5e7eb; 
          font-size: 12px;
          outline: none;
        ">
          <option value="any" ${this.state.floodDetection.mode === 'any' ? 'selected' : ''}>Any Message</option>
          <option value="trigger" ${this.state.floodDetection.mode === 'trigger' ? 'selected' : ''}>Trigger Words Only</option>
        </select>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Threshold: ${this.state.floodDetection.threshold} occurrences
        </label>
        <input type="range" id="flood-threshold" min="2" max="10" value="${this.state.floodDetection.threshold}"
               style="width: 100%; height: 6px; background: #374151; border-radius: 3px; outline: none; cursor: pointer;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Time Window: ${this.state.floodDetection.timeWindow}s
        </label>
        <input type="range" id="flood-window" min="5" max="60" value="${this.state.floodDetection.timeWindow}"
               style="width: 100%; height: 6px; background: #374151; border-radius: 3px; outline: none; cursor: pointer;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d1d5db; cursor: pointer;">
          <input type="checkbox" id="enforce-unique" ${this.state.floodDetection.enforceUniqueUsers ? 'checked' : ''}>
          🔒 Require Unique Users
        </label>
      </div>

      ${this.state.floodDetection.enforceUniqueUsers ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
            Unique Users Required: ${this.state.floodDetection.uniqueUserThreshold}
          </label>
          <input type="range" id="unique-threshold" min="2" max="10" value="${this.state.floodDetection.uniqueUserThreshold}"
                 style="width: 100%; height: 6px; background: #374151; border-radius: 3px; outline: none; cursor: pointer;">
        </div>
      ` : ''}

      ${this.state.floodDetection.mode === 'trigger' ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
            Trigger Words (${this.state.floodDetection.triggerWords.length})
          </label>
          <div id="trigger-words-list" style="max-height: 120px; overflow-y: auto; margin-bottom: 8px;">
            ${this.state.floodDetection.triggerWords.map((word, index) => `
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px; 
                padding: 6px; 
                margin-bottom: 4px;
                background: rgba(139, 92, 246, 0.1);
                border: 1px solid rgba(139, 92, 246, 0.2);
                border-radius: 6px;
                font-size: 12px;
              ">
                <span style="flex: 1; color: #a855f7;">${word}</span>
                <button class="remove-trigger" data-index="${index}" 
                        style="color: #ef4444; background: none; border: none; cursor: pointer; padding: 2px;">
                  ✕
                </button>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="new-trigger" placeholder="Add trigger word..." 
                   style="
                     flex: 1; 
                     padding: 8px; 
                     background: rgba(31, 41, 55, 0.5); 
                     border: 1px solid rgba(75, 85, 99, 0.3); 
                     border-radius: 6px; 
                     color: #e5e7eb; 
                     font-size: 12px;
                     outline: none;
                   ">
            <button id="add-trigger"
                    style="
                      padding: 8px 12px; 
                      background: rgba(139, 92, 246, 0.2); 
                      border: 1px solid rgba(139, 92, 246, 0.3); 
                      border-radius: 6px; 
                      color: #8b5cf6; 
                      font-size: 12px; 
                      cursor: pointer;
                      transition: all 0.2s;
                    ">
              Add
            </button>
          </div>
        </div>
      ` : ''}

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Action Type
        </label>
        <select id="flood-action" style="
          width: 100%; 
          padding: 8px; 
          background: rgba(31, 41, 55, 0.5); 
          border: 1px solid rgba(75, 85, 99, 0.3); 
          border-radius: 6px; 
          color: #e5e7eb; 
          font-size: 12px;
          outline: none;
        ">
          <option value="send" ${this.state.floodDetection.actionType === 'send' ? 'selected' : ''}>Send Message</option>
          <option value="warn" ${this.state.floodDetection.actionType === 'warn' ? 'selected' : ''}>Warn Only</option>
        </select>
      </div>

      <div style="padding: 12px; background: rgba(31, 41, 55, 0.3); border-radius: 6px; font-size: 11px; color: #9ca3af;">
        Floods Detected: <span style="color: #ef4444; font-weight: 600;">${this.state.stats.floodsDetected}</span> • 
        Messages Since Last: <span style="color: #f59e0b; font-weight: 600;">${this.state.chatMonitor.messagesSinceLastFlood}</span>
      </div>
    `;

    this.attachFloodEventListeners();
  }

  renderMonitorTab(container) {
    const recentMessages = this.state.chatMonitor.recentMessages;
    
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" fill="currentColor" style="color: #10b981;">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4H9v4a1 1 0 001 1z"/>
          </svg>
          Chat Monitor
        </h3>
        <div style="display: flex; gap: 8px;">
          <button id="clear-monitor" style="
            padding: 4px 8px;
            border-radius: 12px;
            border: none;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            background: rgba(239, 68, 68, 0.2); 
            color: #ef4444; 
            border: 1px solid rgba(239, 68, 68, 0.3);
          ">
            Clear
          </button>
          <button id="toggle-autoscroll" style="
            padding: 4px 8px;
            border-radius: 12px;
            border: none;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            ${this.state.chatMonitor.autoScroll 
              ? 'background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);'
              : 'background: rgba(75, 85, 99, 0.2); color: #9CA3AF; border: 1px solid rgba(75, 85, 99, 0.3);'
            }
          ">
            ${this.state.chatMonitor.autoScroll ? '📜 Auto' : '📜 Manual'}
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div style="padding: 8px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: #8b5cf6;">${recentMessages.length}</div>
          <div style="font-size: 9px; color: #9ca3af;">Recent</div>
        </div>
        <div style="padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: #10b981;">${this.state.chatMonitor.messagesSinceLastAuto}</div>
          <div style="font-size: 9px; color: #9ca3af;">Since Auto</div>
        </div>
        <div style="padding: 8px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: #f59e0b;">${this.state.chatMonitor.messagesSinceLastFlood}</div>
          <div style="font-size: 9px; color: #9ca3af;">Since Flood</div>
        </div>
      </div>

      <div id="chat-messages" style="
        height: 300px;
        overflow-y: auto; 
        background: rgba(31, 41, 55, 0.2); 
        border: 1px solid rgba(75, 85, 99, 0.3); 
        border-radius: 8px; 
        padding: 8px;
      ">
        ${recentMessages.length === 0 
          ? `<div style="text-align: center; color: #6b7280; margin: 64px 0;">
               <svg width="32" height="32" fill="currentColor" style="margin: 0 auto 8px; opacity: 0.5;">
                 <path d="M8 12l-4.5 3L5 12l-3-3h10.5L12 12l-4.5 3L8 12z"/>
               </svg>
               <p style="font-size: 12px; margin: 0;">No messages captured yet</p>
               <p style="font-size: 10px; margin: 4px 0 0 0; opacity: 0.7;">Messages will appear here once chat activity starts</p>
             </div>`
          : recentMessages.slice().reverse().map((msg, index) => `
            <div style="
              background: ${msg.type === 'flood' ? 'rgba(239, 68, 68, 0.1)' : 
                          msg.type === 'auto' ? 'rgba(139, 92, 246, 0.1)' : 
                          msg.type === 'manual' ? 'rgba(16, 185, 129, 0.1)' : 
                          'rgba(31, 41, 55, 0.5)'}; 
              border: 1px solid ${msg.type === 'flood' ? 'rgba(239, 68, 68, 0.3)' :
                                 msg.type === 'auto' ? 'rgba(139, 92, 246, 0.3)' :
                                 msg.type === 'manual' ? 'rgba(16, 185, 129, 0.3)' :
                                 'rgba(75, 85, 99, 0.3)'}; 
              border-radius: 6px; 
              padding: 8px; 
              margin-bottom: 6px;
              font-size: 11px;
            ">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="
                  color: ${this.getUserColor(msg.username)}; 
                  font-weight: 600;
                  font-size: 10px;
                ">
                  ${msg.username}
                </span>
                ${msg.type && msg.type !== 'chat' ? `
                  <span style="
                    background: ${msg.type === 'flood' ? 'rgba(239, 68, 68, 0.2)' :
                                 msg.type === 'auto' ? 'rgba(139, 92, 246, 0.2)' :
                                 'rgba(16, 185, 129, 0.2)'}; 
                    color: ${msg.type === 'flood' ? '#ef4444' :
                             msg.type === 'auto' ? '#8b5cf6' :
                             '#10b981'}; 
                    padding: 2px 6px; 
                    border-radius: 8px; 
                    font-size: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">
                    ${msg.type}
                  </span>
                ` : ''}
                <span style="color: #6b7280; font-size: 9px; margin-left: auto;">
                  ${new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p style="
                margin: 0; 
                color: #e5e7eb; 
                word-break: break-word;
                line-height: 1.4;
              ">
                ${msg.message}
              </p>
            </div>
          `).join('')
        }
      </div>
    `;

    // Auto-scroll to bottom if enabled
    if (this.state.chatMonitor.autoScroll) {
      setTimeout(() => {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    }

    this.attachMonitorEventListeners();
  }

  renderManualTab(container) {
    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" fill="currentColor" style="color: #10b981;">
            <path d="M22 2L11 13l-4-4-4.5 4.5L11 22l11-11z"/>
          </svg>
          Send Message Manually
        </h3>
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">Send messages directly to chat without automation</p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Message
        </label>
        <textarea id="manual-message" placeholder="Type your message here..." 
                  style="
                    width: 100%; 
                    height: 80px;
                    padding: 12px; 
                    background: rgba(31, 41, 55, 0.5); 
                    border: 1px solid rgba(75, 85, 99, 0.3); 
                    border-radius: 8px; 
                    color: #e5e7eb; 
                    font-size: 13px;
                    outline: none;
                    resize: vertical;
                    font-family: inherit;
                  ">${this.state.manualMessage}</textarea>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 20px;">
        <button id="send-manual" style="
          flex: 1;
          padding: 12px; 
          background: linear-gradient(135deg, #10b981, #059669); 
          border: none;
          border-radius: 8px; 
          color: white; 
          font-size: 13px; 
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
          <svg width="14" height="14" fill="currentColor">
            <path d="M22 2L11 13l-4-4-4.5 4.5L11 22l11-11z"/>
          </svg>
          Send Message
        </button>
        <button id="clear-manual" style="
          padding: 12px; 
          background: rgba(75, 85, 99, 0.2); 
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 8px; 
          color: #9ca3af; 
          font-size: 13px; 
          cursor: pointer;
          transition: all 0.2s;
        ">
          Clear
        </button>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: #d1d5db;">
          Quick Messages
        </label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          ${['Hello!', 'GG', 'Nice!', 'KEKW', '😂', '🔥'].map(msg => `
            <button onclick="document.getElementById('manual-message').value='${msg}'" style="
              padding: 8px; 
              background: rgba(139, 92, 246, 0.1); 
              border: 1px solid rgba(139, 92, 246, 0.2);
              border-radius: 6px; 
              color: #a855f7; 
              font-size: 11px; 
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(139, 92, 246, 0.2)'" onmouseout="this.style.background='rgba(139, 92, 246, 0.1)'">
              ${msg}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="padding: 12px; background: rgba(31, 41, 55, 0.3); border-radius: 6px; font-size: 11px; color: #9ca3af;">
        Manual Messages Sent: <span style="color: #10b981; font-weight: 600;">${this.state.stats.manualMessagesSent}</span>
      </div>
    `;

    this.attachManualEventListeners();
  }

  renderStatusTab(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" fill="currentColor" style="color: #10b981;">
            <path d="M9 12l2 2 4-4"/>
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.35 0 4.47.91 6.06 2.39"/>
          </svg>
          Activity Log
        </h3>
        <button id="clear-status" style="
          padding: 6px 12px;
          border-radius: 16px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(239, 68, 68, 0.2); 
          color: #ef4444; 
          border: 1px solid rgba(239, 68, 68, 0.3);
        ">
          Clear
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <div style="padding: 8px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; text-align: center;">
          <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">${this.state.stats.messagesSent}</div>
          <div style="font-size: 10px; color: #9ca3af;">Total Sent</div>
        </div>
        <div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; text-align: center;">
          <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${this.state.stats.floodsDetected}</div>
          <div style="font-size: 10px; color: #9ca3af;">Floods</div>
        </div>
      </div>

      <div id="status-messages" style="
        max-height: 300px; 
        overflow-y: auto; 
        background: rgba(31, 41, 55, 0.2); 
        border: 1px solid rgba(75, 85, 99, 0.3); 
        border-radius: 8px; 
        padding: 8px;
      ">
        ${this.state.statusMessages.length === 0 
          ? `<div style="text-align: center; color: #6b7280; margin: 32px 0;">
               <svg width="32" height="32" fill="currentColor" style="margin: 0 auto 8px; opacity: 0.5;">
                 <circle cx="16" cy="16" r="14"/>
                 <path d="M16 8v8"/>
                 <path d="M16 20h.01"/>
               </svg>
               <p style="font-size: 12px; margin: 0;">No activity yet</p>
             </div>`
          : this.state.statusMessages.slice().reverse().map(msg => `
            <div style="
              background: rgba(31, 41, 55, 0.5); 
              border: 1px solid rgba(75, 85, 99, 0.3); 
              border-radius: 6px; 
              padding: 8px; 
              margin-bottom: 6px;
              font-size: 12px;
            ">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="
                  color: ${this.getStatusColor(msg.type)}; 
                  font-weight: 600;
                ">
                  ${this.getStatusIcon(msg.type)}
                </span>
                ${msg.feature ? `
                  <span style="
                    background: rgba(139, 92, 246, 0.2); 
                    color: #8b5cf6; 
                    padding: 2px 6px; 
                    border-radius: 10px; 
                    font-size: 10px;
                  ">
                    ${msg.feature}
                  </span>
                ` : ''}
                <span style="color: #6b7280; font-size: 10px; margin-left: auto;">
                  ${new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p style="
                margin: 0; 
                color: ${this.getStatusColor(msg.type)}; 
                word-break: break-word;
                opacity: 0.9;
              ">
                ${msg.message}
              </p>
            </div>
          `).join('')
        }
      </div>
    `;

    document.getElementById('clear-status')?.addEventListener('click', () => {
      this.state.statusMessages = [];
      this.saveState();
      this.renderTabContent(container);
    });
  }

  attachEventListeners() {
    // Header functionality
    const header = this.panel.querySelector('.panel-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('#minimize-btn')) return;
      isDragging = true;
      this.state.isDragging = true;
      dragOffset.x = e.clientX - this.state.position.x;
      dragOffset.y = e.clientY - this.state.position.y;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.state.position.x = Math.max(0, Math.min(window.innerWidth - 350, e.clientX - dragOffset.x));
      this.state.position.y = Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y));
      this.panel.style.left = `${this.state.position.x}px`;
      this.panel.style.top = `${this.state.position.y}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.state.isDragging = false;
        header.style.cursor = 'move';
        this.saveState();
      }
    });

    // Minimize button
    document.getElementById('minimize-btn')?.addEventListener('click', () => {
      this.state.isMinimized = !this.state.isMinimized;
      this.panel.style.height = this.state.isMinimized ? '50px' : '500px';
      
      const content = this.panel.querySelector('.panel-content');
      if (content) {
        content.style.display = this.state.isMinimized ? 'none' : 'flex';
      }
      
      if (!this.state.isMinimized) {
        this.createContent();
      }
      
      this.saveState();
    });

    window.kickPanel = this;
  }

  attachChatEventListeners() {
    document.getElementById('chat-toggle')?.addEventListener('click', () => {
      this.toggleChatAutomation();
    });

    document.getElementById('chat-interval')?.addEventListener('input', (e) => {
      this.state.chatAutomation.interval = parseInt(e.target.value);
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('chat-randomize')?.addEventListener('change', (e) => {
      this.state.chatAutomation.randomize = e.target.checked;
      this.saveState();
    });

    document.getElementById('add-message')?.addEventListener('click', () => {
      const input = document.getElementById('new-message');
      if (input && input.value.trim()) {
        this.state.chatAutomation.messages.push(input.value.trim());
        input.value = '';
        this.saveState();
        this.refreshCurrentTab();
      }
    });

    document.getElementById('new-message')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-message')?.click();
      }
    });

    // Attach remove message listeners
    document.querySelectorAll('.remove-message').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeMessage(index);
      });
    });
  }

  attachFloodEventListeners() {
    document.getElementById('flood-toggle')?.addEventListener('click', () => {
      this.toggleFloodDetection();
    });

    document.getElementById('flood-mode')?.addEventListener('change', (e) => {
      this.state.floodDetection.mode = e.target.value;
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('flood-threshold')?.addEventListener('input', (e) => {
      this.state.floodDetection.threshold = parseInt(e.target.value);
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('flood-window')?.addEventListener('input', (e) => {
      this.state.floodDetection.timeWindow = parseInt(e.target.value);
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('enforce-unique')?.addEventListener('change', (e) => {
      this.state.floodDetection.enforceUniqueUsers = e.target.checked;
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('unique-threshold')?.addEventListener('input', (e) => {
      this.state.floodDetection.uniqueUserThreshold = parseInt(e.target.value);
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('flood-action')?.addEventListener('change', (e) => {
      this.state.floodDetection.actionType = e.target.value;
      this.saveState();
    });

    // Trigger word management
    document.getElementById('add-trigger')?.addEventListener('click', () => {
      const input = document.getElementById('new-trigger');
      if (input && input.value.trim()) {
        const newTrigger = input.value.trim();
        if (!this.state.floodDetection.triggerWords.includes(newTrigger)) {
          this.state.floodDetection.triggerWords.push(newTrigger);
          input.value = '';
          this.saveState();
          this.refreshCurrentTab();
        }
      }
    });

    document.getElementById('new-trigger')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-trigger')?.click();
      }
    });

    // Attach remove trigger listeners
    document.querySelectorAll('.remove-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeTriggerWord(index);
      });
    });
  }

  attachMonitorEventListeners() {
    document.getElementById('clear-monitor')?.addEventListener('click', () => {
      this.state.chatMonitor.recentMessages = [];
      this.state.chatMonitor.messagesSinceLastAuto = 0;
      this.state.chatMonitor.messagesSinceLastFlood = 0;
      this.saveState();
      this.refreshCurrentTab();
    });

    document.getElementById('toggle-autoscroll')?.addEventListener('click', () => {
      this.state.chatMonitor.autoScroll = !this.state.chatMonitor.autoScroll;
      this.saveState();
      this.refreshCurrentTab();
    });
  }

  attachManualEventListeners() {
    document.getElementById('manual-message')?.addEventListener('input', (e) => {
      this.state.manualMessage = e.target.value;
      this.saveState();
    });

    document.getElementById('send-manual')?.addEventListener('click', () => {
      const textarea = document.getElementById('manual-message');
      if (textarea && textarea.value.trim()) {
        this.sendMessage(textarea.value.trim(), 'manual');
        textarea.value = '';
        this.state.manualMessage = '';
        this.saveState();
        this.refreshCurrentTab();
      }
    });

    document.getElementById('clear-manual')?.addEventListener('click', () => {
      const textarea = document.getElementById('manual-message');
      if (textarea) {
        textarea.value = '';
        this.state.manualMessage = '';
        this.saveState();
      }
    });

    document.getElementById('manual-message')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        document.getElementById('send-manual')?.click();
      }
    });
  }

  switchTab(tabId) {
    this.state.activeTab = tabId;
    this.saveState();
    this.refreshCurrentTab();
  }

  refreshCurrentTab() {
    const tabContent = this.panel.querySelector('.tab-content');
    if (tabContent) {
      this.renderTabContent(tabContent);
    }

    // Update tab buttons
    this.panel.querySelectorAll('.tab-button').forEach(btn => {
      const isActive = btn.dataset.tab === this.state.activeTab;
      btn.style.color = isActive ? '#8b5cf6' : '#9ca3af';
      btn.style.background = isActive ? 'rgba(139, 92, 246, 0.1)' : 'none';
      btn.style.borderBottom = isActive ? '2px solid #8b5cf6' : 'none';
    });
  }

  toggleChatAutomation() {
    this.state.chatAutomation.enabled = !this.state.chatAutomation.enabled;

    if (this.state.chatAutomation.enabled) {
      this.addStatusMessage('Chat automation started', 'success', 'Chat');
      this.startChatAutomation();
    } else {
      this.addStatusMessage('Chat automation stopped', 'warning', 'Chat');
      this.stopChatAutomation();
    }

    this.saveState();
    this.refreshCurrentTab();
    this.updateStats();
  }

  startChatAutomation() {
    if (this.chatInterval) clearInterval(this.chatInterval);
    
    this.chatInterval = setInterval(() => {
      if (this.state.chatAutomation.messages.length === 0) return;

      let nextIndex;
      if (this.state.chatAutomation.randomize) {
        nextIndex = Math.floor(Math.random() * this.state.chatAutomation.messages.length);
      } else {
        nextIndex = (this.state.chatAutomation.currentIndex + 1) % this.state.chatAutomation.messages.length;
      }

      const message = this.state.chatAutomation.messages[nextIndex];
      this.sendMessage(message, 'auto');
      this.state.chatAutomation.currentIndex = nextIndex;
      
      // Reset counter after sending auto message
      this.state.chatMonitor.messagesSinceLastAuto = 0;
      
      this.saveState();
    }, this.state.chatAutomation.interval * 1000);
  }

  stopChatAutomation() {
    if (this.chatInterval) {
      clearInterval(this.chatInterval);
      this.chatInterval = null;
    }
  }

  toggleFloodDetection() {
    this.state.floodDetection.enabled = !this.state.floodDetection.enabled;

    if (this.state.floodDetection.enabled) {
      this.addStatusMessage('Flood detection enabled', 'success', 'Flood');
    } else {
      this.addStatusMessage('Flood detection disabled', 'warning', 'Flood');
      this.state.floodDetection.messageTracker = {};
      this.state.floodDetection.recentMessages = [];
    }

    this.saveState();
    this.refreshCurrentTab();
    this.updateStats();
  }

  startMessageMonitoring() {
    const findChatContainer = () => {
      return document.querySelector('#chatroom-messages') || 
             document.querySelector('.relative.h-full.w-full.overflow-y-auto.contain-strict') ||
             document.querySelector('[data-testid="chat-messages"]') ||
             document.querySelector('.chat-messages');
    };

    const chatContainer = findChatContainer();
    
    if (chatContainer) {
      this.messageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewChatMessage(node);
            }
          });
        });
      });

      this.messageObserver.observe(chatContainer, { childList: true, subtree: true });
      this.addStatusMessage('Started monitoring chat messages', 'info');
    } else {
      setTimeout(() => this.startMessageMonitoring(), 2000);
    }
  }

  checkForNewChatMessage(element) {
    // Find message text in various Kick structures
    const messageElement = element.querySelector('.font-normal.leading-\\[1\\.55\\]') || 
                          element.querySelector('span[style*="leading"]') ||
                          element.querySelector('[data-testid="message-content"]') ||
                          element.querySelector('.message-text');
    
    if (!messageElement) return;

    const messageText = messageElement.textContent?.trim();
    if (!messageText || messageText.length < 2) return;

    // Find username
    const usernameElement = element.querySelector('.font-bold') ||
                           element.querySelector('[data-testid="username"]') ||
                           element.querySelector('.username');
    
    const userName = usernameElement?.textContent?.trim() || 'Unknown';

    console.log(`[Monitor] New message from ${userName}: "${messageText}"`);

    // Add to chat monitor
    this.addChatMessage(messageText, userName, 'chat');

    // Check for flood detection
    if (this.state.floodDetection.enabled) {
      this.checkFlood(messageText, userName);
    }
  }

  addChatMessage(message, username, type = 'chat') {
    const chatMessage = {
      id: Date.now().toString() + Math.random(),
      message,
      username,
      type,
      timestamp: new Date()
    };

    this.state.chatMonitor.recentMessages.unshift(chatMessage);
    
    // Keep only recent messages
    if (this.state.chatMonitor.recentMessages.length > this.state.chatMonitor.maxMessages) {
      this.state.chatMonitor.recentMessages = this.state.chatMonitor.recentMessages.slice(0, this.state.chatMonitor.maxMessages);
    }

    // Update counters
    this.state.stats.totalChatMessages++;
    if (type === 'chat') {
      this.state.chatMonitor.messagesSinceLastAuto++;
      this.state.chatMonitor.messagesSinceLastFlood++;
    }

    this.saveState();
    
    // Refresh monitor tab if active
    if (this.state.activeTab === 'monitor') {
      this.refreshCurrentTab();
    }
  }

  checkFlood(messageText, userName) {
    const now = Date.now();
    const timeWindow = this.state.floodDetection.timeWindow * 1000;
    const normalizedMessage = messageText.toLowerCase().trim();

    // Check if message matches criteria
    let shouldTrack = false;
    
    if (this.state.floodDetection.mode === 'any') {
      shouldTrack = true;
    } else if (this.state.floodDetection.mode === 'trigger') {
      shouldTrack = this.state.floodDetection.triggerWords.some(trigger => 
        normalizedMessage.includes(trigger.toLowerCase())
      );
    }

    if (!shouldTrack) return;

    // Initialize message tracker
    if (!this.state.floodDetection.messageTracker[normalizedMessage]) {
      this.state.floodDetection.messageTracker[normalizedMessage] = [];
    }

    // Clean old entries
    this.state.floodDetection.messageTracker[normalizedMessage] = 
      this.state.floodDetection.messageTracker[normalizedMessage].filter(
        entry => now - entry.timestamp < timeWindow
      );

    // Check if we should add this message
    const existingEntry = this.state.floodDetection.messageTracker[normalizedMessage]
      .find(entry => entry.user === userName);

    if (this.state.floodDetection.enforceUniqueUsers) {
      // Only add if user hasn't said this message before (within time window)
      if (!existingEntry) {
        this.state.floodDetection.messageTracker[normalizedMessage].push({
          user: userName,
          timestamp: now
        });
      }
    } else {
      // Always add, allowing same user multiple times
      this.state.floodDetection.messageTracker[normalizedMessage].push({
        user: userName,
        timestamp: now
      });
    }

    const currentCount = this.state.floodDetection.messageTracker[normalizedMessage].length;
    const requiredCount = this.state.floodDetection.enforceUniqueUsers 
      ? this.state.floodDetection.uniqueUserThreshold 
      : this.state.floodDetection.threshold;

    console.log(`[Flood] "${normalizedMessage}" count: ${currentCount}/${requiredCount}`);

    // Check if flood threshold reached
    if (currentCount >= requiredCount) {
      this.handleFloodDetection(messageText, currentCount);
      // Clear tracker to prevent immediate re-triggering
      this.state.floodDetection.messageTracker[normalizedMessage] = [];
    }

    this.saveState();
  }

  handleFloodDetection(message, count) {
    this.state.stats.floodsDetected++;

    if (this.state.floodDetection.actionType === 'send') {
      this.sendMessage(message, 'flood');
      this.addStatusMessage(
        `Flood detected and sent: "${message}" (${count}x)`,
        'success',
        'Flood'
      );
    } else {
      this.addStatusMessage(
        `Flood detected: "${message}" (${count}x) - Warning only`,
        'warning',
        'Flood'
      );
    }

    // Reset flood counter
    this.state.chatMonitor.messagesSinceLastFlood = 0;

    this.saveState();
    this.updateStats();
  }

  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeWindow = this.state.floodDetection.timeWindow * 1000;

      // Clean up message tracker
      Object.keys(this.state.floodDetection.messageTracker).forEach(message => {
        this.state.floodDetection.messageTracker[message] = 
          this.state.floodDetection.messageTracker[message].filter(
            entry => now - entry.timestamp < timeWindow
          );
        
        // Remove empty entries
        if (this.state.floodDetection.messageTracker[message].length === 0) {
          delete this.state.floodDetection.messageTracker[message];
        }
      });

      this.saveState();
    }, 2000); // Clean every 2 seconds
  }

  // FIXED: New sendMessage function using execCommand and proper input simulation
  async sendMessage(message, source = 'manual') {
    console.log(`[SendMessage] Attempting to send: "${message}" (${source})`);

    // Find Kick's chat input with multiple selectors
    const inputDiv = document.querySelector('div[data-input="true"][contenteditable="true"]') ||
                     document.querySelector('div[data-test="chat-input"]') ||
                     document.querySelector('.editor-input[contenteditable="true"]') ||
                     document.querySelector('[contenteditable="true"][data-testid="chat-input"]');

    const sendButton = document.querySelector('#send-message-button') ||
                      document.querySelector('button[data-testid="send-button"]') ||
                      document.querySelector('button:has([data-testid="send-icon"])') ||
                      document.querySelector('button[aria-label="Send message"]');

    if (!inputDiv) {
      console.warn('[SendMessage] Chat input not found');
      this.addStatusMessage('Could not find chat input', 'error');
      return;
    }

    if (!sendButton) {
      console.warn('[SendMessage] Send button not found');
      this.addStatusMessage('Could not find send button', 'error');
      return;
    }

    try {
      // Step 1: Focus the input
      inputDiv.focus();
      await this.wait(100);

      // Step 2: Clear existing content
      if (inputDiv.innerHTML) {
        inputDiv.innerHTML = '';
        const clearEvent = new InputEvent('input', { bubbles: true, cancelable: true });
        inputDiv.dispatchEvent(clearEvent);
        await this.wait(50);
      }

      // Step 3: Use execCommand for reliable text insertion
      const success = document.execCommand('insertText', false, message);
      
      if (!success) {
        // Fallback: Direct content manipulation
        console.log('[SendMessage] execCommand failed, using fallback');
        inputDiv.textContent = message;
      }

      await this.wait(100);

      // Step 4: Dispatch input events to notify Lexical
      const inputEvent = new InputEvent('input', { 
        bubbles: true, 
        cancelable: true,
        inputType: 'insertText',
        data: message
      });
      inputDiv.dispatchEvent(inputEvent);

      await this.wait(50);

      // Step 5: Dispatch change event
      const changeEvent = new Event('change', { bubbles: true });
      inputDiv.dispatchEvent(changeEvent);

      await this.wait(100);

      // Step 6: Click send button
      console.log('[SendMessage] Clicking send button');
      sendButton.click();

      // Update stats
      this.state.stats.messagesSent++;
      
      if (source === 'auto') {
        this.state.stats.autoMessagesSent++;
      } else if (source === 'manual') {
        this.state.stats.manualMessagesSent++;
      }
      
      // Add to chat monitor
      this.addChatMessage(message, 'Panel Bot', source);
      
      this.addStatusMessage(
        `Sent (${source}): "${message}"`, 
        'info', 
        source.charAt(0).toUpperCase() + source.slice(1)
      );

      console.log(`[SendMessage] Successfully sent: "${message}"`);

    } catch (error) {
      console.error('[SendMessage] Error:', error);
      this.addStatusMessage(`Failed to send message: ${error.message}`, 'error');
    }

    this.saveState();
    this.updateStats();
  }

  // Helper function for delays
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  removeMessage(index) {
    this.state.chatAutomation.messages.splice(index, 1);
    this.saveState();
    this.refreshCurrentTab();
  }

  removeTriggerWord(index) {
    if (this.state.floodDetection && this.state.floodDetection.triggerWords) {
      this.state.floodDetection.triggerWords.splice(index, 1);
      this.saveState();
      this.refreshCurrentTab();
    }
  }

  addStatusMessage(message, type, feature = null) {
    const statusMessage = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
      feature
    };

    this.state.statusMessages.unshift(statusMessage);
    
    if (this.state.statusMessages.length > 100) {
      this.state.statusMessages = this.state.statusMessages.slice(0, 100);
    }

    this.saveState();

    if (this.state.activeTab === 'status') {
      this.refreshCurrentTab();
    }
  }

  getUserColor(username) {
    // Generate consistent colors for usernames
    const colors = [
      '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', 
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getStatusColor(type) {
    switch (type) {
      case 'success': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  }

  getStatusIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  }
}

// Message handling
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'togglePanel') {
      if (window.kickPanel) {
        window.kickPanel.state.isMinimized = !window.kickPanel.state.isMinimized;
        window.kickPanel.panel.style.height = window.kickPanel.state.isMinimized ? '50px' : '500px';
        
        const content = window.kickPanel.panel.querySelector('.panel-content');
        if (content) {
          content.style.display = window.kickPanel.state.isMinimized ? 'none' : 'flex';
        }
        
        if (!window.kickPanel.state.isMinimized) {
          window.kickPanel.createContent();
        }
        
        window.kickPanel.saveState();
      } else {
        window.kickPanel = new KickControlPanel();
      }
      sendResponse({ success: true });
    }
    
    if (request.action === 'requestStats') {
      if (window.kickPanel) {
        window.kickPanel.updateStats();
      }
      sendResponse({ success: true });
    }
  });
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.kickPanel = new KickControlPanel();
  });
} else {
  window.kickPanel = new KickControlPanel();
}