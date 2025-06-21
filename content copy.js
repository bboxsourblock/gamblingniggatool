// Kick Control Panel - Advanced automation for Kick.com
// Professional Chrome extension with chat automation, flood detection, and manual messaging

class KickControlPanel {
  constructor() {
    this.state = this.defaultState();
    this.panelElement = null;
    this.isVisible = false;
    this.isMinimized = false;
    this.currentTab = 'status';
    this.chatMonitorInterval = null;
    this.activityCheckInterval = null;
    this.automationInterval = null;
    this.floodCooldownTimeout = null;
    this.lastChatHeight = 0;
    this.messageQueue = [];
    this.stats = {
      totalSent: 0,
      autoSent: 0,
      manualSent: 0,  
      floodsDetected: 0,
      lastActivity: null
    };
    
    this.loadState();
    this.init();
  }

  defaultState() {
    return {
      position: { x: 50, y: 50 },
      size: { width: 380, height: 500 },
      isMinimized: false,
      currentTab: 'status',
      chatAutomation: {
        enabled: false,
        messages: ['Hello chat! 👋'],
        interval: 30,
        randomize: false,
        currentIndex: 0
      },
      floodDetection: {
        enabled: false,
        mode: 'any',
        triggerOnly: true,
        threshold: 3,
        timeWindow: 20,
        cooldown: 5,
        isCooldownActive: false,
        cooldownEndTime: null,
        action: 'send',
        customMessage: '',
        triggerWords: [],
        enforceUniqueUsers: true,
        messageTracker: {},
        recentMessages: []
      },
      manualMessaging: {
        message: '',
        quickButtons: ['gg', 'lol', 'nice', 'pog']
      }
    };
  }

  init() {
    this.loadStats();
    this.createPanel();
    this.attachEvents();
    this.startMonitoring();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'togglePanel') {
        this.togglePanel();
      }
    });
    
    console.log('Kick Control Panel initialized');
  }

  createPanel() {
    // Remove existing panel
    const existing = document.getElementById('kick-control-panel');
    if (existing) existing.remove();

    // Create main panel
    this.panelElement = document.createElement('div');
    this.panelElement.id = 'kick-control-panel';
    this.panelElement.className = 'kick-control-panel';
    
    // Apply styles
    this.panelElement.style.cssText = `
      position: fixed;
      top: ${this.state.position.y}px;
      left: ${this.state.position.x}px;
      width: ${this.state.size.width}px;
      height: ${this.state.size.height}px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border: 2px solid rgba(139, 92, 246, 0.3);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e5e7eb;
      overflow: hidden;
      resize: both;
      min-width: 320px;
      min-height: 400px;
      max-width: 600px;
      max-height: 800px;
      display: ${this.isVisible ? 'block' : 'none'};
      backdrop-filter: blur(10px);
    `;

    this.renderContent();
    document.body.appendChild(this.panelElement);
    this.makeDraggable();
    this.makeResizable();
  }

  renderContent() {
    const isMinimized = this.state.isMinimized;
    
    this.panelElement.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Header -->
        <div style="
          background: rgba(139, 92, 246, 0.1);
          padding: 12px 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
          user-select: none;
        " class="panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px; font-weight: 700; color: #8b5cf6;">⚡ Kick Control</span>
            <span style="
              font-size: 10px;
              padding: 2px 6px;
              background: rgba(16, 185, 129, 0.2);
              color: #10b981;
              border-radius: 8px;
              font-weight: 500;
            ">ACTIVE</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button id="minimize-btn" style="
              background: rgba(75, 85, 99, 0.3);
              border: none;
              color: #9ca3af;
              width: 24px;
              height: 24px;
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
            ">${isMinimized ? '□' : '_'}</button>
            <button id="close-btn" style="
              background: rgba(239, 68, 68, 0.3);
              border: none;
              color: #ef4444;
              width: 24px;
              height: 24px;
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
            ">×</button>
          </div>
        </div>

        ${isMinimized ? '' : `
        <!-- Tab Navigation -->
        <div style="
          display: flex;
          background: rgba(31, 41, 55, 0.5);
          border-bottom: 1px solid rgba(75, 85, 99, 0.3);
        ">
          ${['status', 'chat', 'flood', 'send'].map(tab => `
            <button class="tab-button" data-tab="${tab}" style="
              flex: 1;
              padding: 10px 8px;
              background: ${this.currentTab === tab ? 'rgba(139, 92, 246, 0.2)' : 'transparent'};
              border: none;
              color: ${this.currentTab === tab ? '#a855f7' : '#9ca3af'};
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              transition: all 0.2s ease;
            ">${tab}</button>
          `).join('')}
        </div>

        <!-- Tab Content -->
        <div style="flex: 1; overflow-y: auto; padding: 16px;">
          ${this.renderTabContent()}
        </div>
        `}
      </div>
    `;
  }

  renderTabContent() {
    switch (this.currentTab) {
      case 'status': return this.renderStatusTab();
      case 'chat': return this.renderChatTab();
      case 'flood': return this.renderFloodTab();
      case 'send': return this.renderSendTab();
      default: return '';
    }
  }

  renderStatusTab() {
    const chatStatus = this.state.chatAutomation.enabled ? 'Active' : 'Inactive';
    const floodStatus = this.state.floodDetection.enabled ? 'Active' : 'Inactive';
    
    return `
      <div style="space-y: 16px;">
        <!-- Statistics Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="
            background: rgba(31, 41, 55, 0.5);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          ">
            <div style="font-size: 24px; font-weight: 700; color: #8b5cf6; margin-bottom: 4px;">
              ${this.stats.totalSent}
            </div>
            <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
              Total Sent
            </div>
          </div>
          <div style="
            background: rgba(31, 41, 55, 0.5);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          ">
            <div style="font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 4px;">
              ${this.stats.floodsDetected}
            </div>
            <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
              Floods Detected
            </div>
          </div>
        </div>

        <!-- Status List -->
        <div style="space-y: 12px;">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #d1d5db;">
            📊 System Status
          </h3>
          
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(75, 85, 99, 0.2);
          ">
            <span style="font-size: 12px; font-weight: 500;">Chat Automation</span>
            <span style="
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 10px;
              font-weight: 500;
              background: ${chatStatus === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(75, 85, 99, 0.2)'};
              color: ${chatStatus === 'Active' ? '#10b981' : '#9ca3af'};
            ">${chatStatus}</span>
          </div>
          
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(75, 85, 99, 0.2);
          ">
            <span style="font-size: 12px; font-weight: 500;">Flood Detection</span>
            <span style="
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 10px;
              font-weight: 500;
              background: ${floodStatus === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(75, 85, 99, 0.2)'};
              color: ${floodStatus === 'Active' ? '#10b981' : '#9ca3af'};
            ">${floodStatus}</span>
          </div>
          
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
          ">
            <span style="font-size: 12px; font-weight: 500;">Panel Integration</span>
            <span style="
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 10px;
              font-weight: 500;
              background: rgba(16, 185, 129, 0.2);
              color: #10b981;
            ">Connected</span>
          </div>
        </div>

        <!-- Recent Activity -->
        <div style="margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #d1d5db;">🔔 Activity Feed</h3>
            <button id="clear-activity" style="
              background: rgba(239, 68, 68, 0.2);
              border: 1px solid rgba(239, 68, 68, 0.3);
              color: #ef4444;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 10px;
              cursor: pointer;
            ">Clear</button>
          </div>
          <div id="activity-feed" style="
            max-height: 120px;
            overflow-y: auto;
            background: rgba(31, 41, 55, 0.3);
            border-radius: 6px;
            padding: 8px;
          ">
            ${this.state.floodDetection.recentMessages.length === 0 ? 
              '<div style="color: #6b7280; font-size: 11px; text-align: center; padding: 20px;">No recent activity</div>' :
              this.state.floodDetection.recentMessages.map(msg => `
                <div style="font-size: 11px; margin-bottom: 6px; color: #9ca3af;">
                  <span style="color: #8b5cf6;">[${msg.time}]</span> ${msg.text}
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  renderChatTab() {
    const isEnabled = this.state.chatAutomation.enabled;
    
    return `
      <div style="space-y: 16px;">
        <!-- Enable Toggle -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: rgba(31, 41, 55, 0.5);
          border-radius: 8px;
          border: 1px solid rgba(75, 85, 99, 0.3);
        ">
          <div>
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 2px;">Chat Automation</div>
            <div style="font-size: 11px; color: #9ca3af;">Send messages automatically</div>
          </div>
          <label style="
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
          ">
            <input type="checkbox" id="chat-enabled" ${isEnabled ? 'checked' : ''} style="
              opacity: 0;
              width: 0;
              height: 0;
            ">
            <span style="
              position: absolute;
              cursor: pointer;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: ${isEnabled ? '#8b5cf6' : '#374151'};
              transition: 0.3s;
              border-radius: 24px;
              &:before {
                position: absolute;
                content: '';
                height: 18px;
                width: 18px;
                left: ${isEnabled ? '23px' : '3px'};
                bottom: 3px;
                background: white;
                transition: 0.3s;
                border-radius: 50%;
              }
            " class="slider"></span>
          </label>
        </div>

        <!-- Interval Setting -->
        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
            Message Interval: ${this.state.chatAutomation.interval}s
          </label>
          <input type="range" id="chat-interval" 
            min="5" max="300" value="${this.state.chatAutomation.interval}"
            ${!isEnabled ? 'disabled' : ''}
            style="width: 100%; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6b7280;">
            <span>5s</span>
            <span>300s</span>
          </div>
        </div>

        <!-- Randomize Toggle -->
        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; color: #9ca3af; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="chat-randomize" ${this.state.chatAutomation.randomize ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}>
            Randomize message order
          </label>
        </div>

        <!-- Message List -->
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #d1d5db;">
            Messages (${this.state.chatAutomation.messages.length})
          </h3>
          <div id="message-list" style="
            max-height: 120px;
            overflow-y: auto;
            background: rgba(31, 41, 55, 0.3);
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 8px;
          ">
            ${this.state.chatAutomation.messages.map((msg, index) => `
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                margin-bottom: 4px;
                background: ${index === this.state.chatAutomation.currentIndex ? 'rgba(139, 92, 246, 0.2)' : 'rgba(75, 85, 99, 0.2)'};
                border-radius: 4px;
                font-size: 11px;
              ">
                <span style="flex: 1; color: ${index === this.state.chatAutomation.currentIndex ? '#a855f7' : '#e5e7eb'};">
                  ${msg}
                </span>
                <button class="remove-message" data-index="${index}" style="
                  background: rgba(239, 68, 68, 0.3);
                  border: none;
                  color: #ef4444;
                  width: 20px;
                  height: 20px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 12px;
                ">×</button>
              </div>
            `).join('')}
          </div>
          
          <!-- Add Message -->
          <div style="display: flex; gap: 8px;">
            <input type="text" id="new-message" placeholder="Add new message..." style="
              flex: 1;
              padding: 8px 12px;
              font-size: 11px;
            ">
            <button id="add-message" style="
              background: linear-gradient(135deg, #8b5cf6, #7c3aed);
              border: none;
              color: white;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
            ">Add</button>
          </div>
        </div>
      </div>
    `;
  }

  renderFloodTab() {
    const isEnabled = this.state.floodDetection.enabled;
    const cooldownRemaining = this.getCooldownRemaining();
    
    const content = document.createElement('div');
    content.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
    
    // Enable Toggle
    const enableToggle = document.createElement('div');
    enableToggle.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(31, 41, 55, 0.5);
      border-radius: 8px;
      border: 1px solid rgba(75, 85, 99, 0.3);
    `;
    enableToggle.innerHTML = `
      <div>
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 2px;">Flood Detection</div>
        <div style="font-size: 11px; color: #9ca3af;">Auto-detect repeated messages</div>
      </div>
      <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
        <input type="checkbox" id="flood-enabled" ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
        <span style="
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${isEnabled ? '#8b5cf6' : '#374151'};
          transition: 0.3s;
          border-radius: 24px;
        " class="slider"></span>
      </label>
    `;
    content.appendChild(enableToggle);

    // Detection Mode
    const modeSection = document.createElement('div');
    modeSection.style.marginBottom = '16px';
    modeSection.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Detection Mode
      </label>
      <select id="flood-mode" ${!isEnabled ? 'disabled' : ''} style="
        width: 100%;
        padding: 8px 12px;
        font-size: 11px;
      ">
        <option value="any" ${this.state.floodDetection.mode === 'any' ? 'selected' : ''}>Any repeated message</option>
        <option value="trigger" ${this.state.floodDetection.mode === 'trigger' ? 'selected' : ''}>Only trigger words</option>
      </select>
    `;
    content.appendChild(modeSection);

    // Trigger Only Toggle
    const triggerOnlyToggle = document.createElement('div');
    triggerOnlyToggle.style.marginBottom = '12px';
    triggerOnlyToggle.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        <input type="checkbox" id="trigger-only" ${this.state.floodDetection.triggerOnly ? 'checked' : ''}>
        Only flood on trigger words
      </label>
    `;
    content.appendChild(triggerOnlyToggle);

    // Flood trigger word list
    const triggerSection = document.createElement('div');
    triggerSection.style.marginBottom = '16px';
    triggerSection.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Trigger Words
      </label>
      <div id="trigger-list" style="
        max-height: 80px;
        overflow-y: auto;
        background: rgba(31, 41, 55, 0.3);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 8px;
      ">
        ${this.state.floodDetection.triggerWords.length === 0 ? 
          '<div style="color: #6b7280; font-size: 11px; text-align: center; padding: 8px;">No trigger words added</div>' :
          this.state.floodDetection.triggerWords.map((word, index) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 4px 8px;
              margin-bottom: 4px;
              background: rgba(75, 85, 99, 0.2);
              border-radius: 4px;
              font-size: 11px;
            ">
              <span style="color: #e5e7eb;">${word}</span>
              <button class="remove-trigger" data-index="${index}" style="
                background: rgba(239, 68, 68, 0.3);
                border: none;
                color: #ef4444;
                width: 18px;
                height: 18px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
              ">×</button>
            </div>
          `).join('')
        }
      </div>
      <div style="display: flex; gap: 8px;">
        <input type="text" id="new-trigger" placeholder="Add trigger word..." style="
          flex: 1;
          padding: 8px 12px;
          font-size: 11px;
        ">
        <button id="add-trigger" style="
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        ">Add</button>
      </div>
    `;
    content.appendChild(triggerSection);

    // Settings Grid
    const settingsGrid = document.createElement('div');
    settingsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;';
    
    // Threshold
    const thresholdDiv = document.createElement('div');
    thresholdDiv.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Threshold: ${this.state.floodDetection.threshold}
      </label>
      <input type="range" id="flood-threshold" 
        min="2" max="10" value="${this.state.floodDetection.threshold}"
        ${!isEnabled ? 'disabled' : ''}
        style="width: 100%;">
    `;
    settingsGrid.appendChild(thresholdDiv);

    // Time Window  
    const timeDiv = document.createElement('div');
    timeDiv.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Window: ${this.state.floodDetection.timeWindow}s
      </label>
      <input type="range" id="flood-time" 
        min="5" max="60" value="${this.state.floodDetection.timeWindow}"
        ${!isEnabled ? 'disabled' : ''}
        style="width: 100%;">
    `;
    settingsGrid.appendChild(timeDiv);
    content.appendChild(settingsGrid);

    // Cooldown Setting
    const cooldownDiv = document.createElement('div');
    cooldownDiv.style.marginBottom = '16px';
    cooldownDiv.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Cooldown: ${this.state.floodDetection.cooldown}s
      </label>
      <input type="range" id="flood-cooldown" 
        min="1" max="60" value="${this.state.floodDetection.cooldown}"
        ${!isEnabled ? 'disabled' : ''}
        style="width: 100%; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6b7280;">
        <span>1s</span>
        <span>60s</span>
      </div>
    `;
    content.appendChild(cooldownDiv);

    // Cooldown Status
    if (cooldownRemaining > 0) {
      const cooldownStatus = document.createElement('div');
      cooldownStatus.style.cssText = `
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.2);
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 16px;
        font-size: 11px;
        color: #f59e0b;
        text-align: center;
      `;
      cooldownStatus.innerHTML = `⏱️ Cooldown: ${cooldownRemaining}s remaining`;
      content.appendChild(cooldownStatus);
    }

    // Unique Users Toggle
    const uniqueDiv = document.createElement('div');
    uniqueDiv.style.marginBottom = '16px';
    uniqueDiv.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="enforce-unique" ${this.state.floodDetection.enforceUniqueUsers ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}>
        Require unique users (slider: ${this.state.floodDetection.threshold} different users)
      </label>
    `;
    content.appendChild(uniqueDiv);

    // Action Settings
    const actionDiv = document.createElement('div');
    actionDiv.style.marginBottom = '16px';
    actionDiv.innerHTML = `
      <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
        Action on Detection
      </label>
      <select id="flood-action" ${!isEnabled ? 'disabled' : ''} style="
        width: 100%;
        padding: 8px 12px;
        font-size: 11px;
        margin-bottom: 8px;
      ">
        <option value="send" ${this.state.floodDetection.action === 'send' ? 'selected' : ''}>Send detected message</option>
        <option value="custom" ${this.state.floodDetection.action === 'custom' ? 'selected' : ''}>Send custom message</option>
        <option value="warn" ${this.state.floodDetection.action === 'warn' ? 'selected' : ''}>Warn only</option>
      </select>
      ${this.state.floodDetection.action === 'custom' ? `
        <input type="text" id="flood-custom" value="${this.state.floodDetection.customMessage}" placeholder="Custom message..." style="
          width: 100%;
          padding: 8px 12px;
          font-size: 11px;
        ">
      ` : ''}
    `;
    content.appendChild(actionDiv);

    return content.outerHTML;
  }

  renderSendTab() {
    return `
      <div style="space-y: 16px;">
        <!-- Manual Message -->
        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 6px;">
            Manual Message
          </label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <textarea id="manual-message" placeholder="Type your message here... (Ctrl/Cmd+Enter to send)" 
              style="
                width: 100%;
                min-height: 80px;
                padding: 12px;
                font-size: 12px;
                resize: vertical;
              ">${this.state.manualMessaging.message}</textarea>
            <button id="send-manual" style="
              background: linear-gradient(135deg, #8b5cf6, #7c3aed);
              border: none;
              color: white;
              padding: 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            ">Send Message</button>
          </div>
        </div>

        <!-- Quick Buttons -->
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #d1d5db;">
            Quick Messages
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            ${this.state.manualMessaging.quickButtons.map(btn => `
              <button class="quick-btn" data-message="${btn}" style="
                background: rgba(75, 85, 99, 0.3);
                border: 1px solid rgba(75, 85, 99, 0.5);
                color: #d1d5db;
                padding: 8px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s ease;
              ">${btn}</button>
            `).join('')}
          </div>
          
          <!-- Add Quick Button -->
          <div style="display: flex; gap: 8px;">
            <input type="text" id="new-quick" placeholder="Add quick button..." style="
              flex: 1;
              padding: 8px 12px;
              font-size: 11px;
            ">
            <button id="add-quick" style="
              background: linear-gradient(135deg, #8b5cf6, #7c3aed);
              border: none;
              color: white;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
            ">Add</button>
          </div>
        </div>

        <!-- Statistics -->
        <div style="
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 8px;
          padding: 16px;
        ">
          <h3 style="font-size: 12px; font-weight: 600; margin-bottom: 12px; color: #d1d5db;">
            📊 Message Statistics
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">${this.stats.manualSent}</div>
              <div style="font-size: 10px; color: #9ca3af;">Manual</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #10b981;">${this.stats.autoSent}</div>
              <div style="font-size: 10px; color: #9ca3af;">Automated</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Header buttons
    document.getElementById('minimize-btn')?.addEventListener('click', () => this.toggleMinimize());
    document.getElementById('close-btn')?.addEventListener('click', () => this.hidePanel());
    
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentTab = e.target.dataset.tab;
        this.saveState();
        this.refreshTab();
      });
    });

    // Status tab events
    document.getElementById('clear-activity')?.addEventListener('click', () => {
      this.state.floodDetection.recentMessages = [];
      this.saveState();
      this.refreshTab();
    });

    // Chat tab events
    this.attachChatEvents();
    
    // Flood tab events  
    this.attachFloodEvents();
    
    // Send tab events
    this.attachSendEvents();
  }

  attachChatEvents() {
    document.getElementById('chat-enabled')?.addEventListener('change', (e) => {
      this.state.chatAutomation.enabled = e.target.checked;
      this.saveState();
      this.refreshTab();
      
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
      
      if (this.state.chatAutomation.enabled) {
        this.restartChatAutomation();
      }
    });

    document.getElementById('chat-randomize')?.addEventListener('change', (e) => {
      this.state.chatAutomation.randomize = e.target.checked;
      this.saveState();
    });

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
        document.getElementById('add-message').click();
      }
    });

    document.querySelectorAll('.remove-message').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.state.chatAutomation.messages.splice(index, 1);
        if (this.state.chatAutomation.currentIndex >= this.state.chatAutomation.messages.length) {
          this.state.chatAutomation.currentIndex = 0;
        }
        this.saveState();
        this.refreshTab();
      });
    });
  }

  attachFloodEvents() {
    document.getElementById('flood-enabled')?.addEventListener('change', (e) => {
      this.state.floodDetection.enabled = e.target.checked;
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-mode')?.addEventListener('change', (e) => {
      this.state.floodDetection.mode = e.target.value;
      this.saveState();
    });

    document.getElementById('flood-threshold')?.addEventListener('input', (e) => {
      this.state.floodDetection.threshold = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-time')?.addEventListener('input', (e) => {
      this.state.floodDetection.timeWindow = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-cooldown')?.addEventListener('input', (e) => {
      this.state.floodDetection.cooldown = parseInt(e.target.value);
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('enforce-unique')?.addEventListener('change', (e) => {
      this.state.floodDetection.enforceUniqueUsers = e.target.checked;
      this.saveState();
    });

    document.getElementById('flood-action')?.addEventListener('change', (e) => {
      this.state.floodDetection.action = e.target.value;
      this.saveState();
      this.refreshTab();
    });

    document.getElementById('flood-custom')?.addEventListener('input', (e) => {
      this.state.floodDetection.customMessage = e.target.value;
      this.saveState();
    });

    document.getElementById('add-trigger')?.addEventListener('click', () => {
      const input = document.getElementById('new-trigger');
      const word = input.value.trim();
      if (word && !this.state.floodDetection.triggerWords.includes(word)) {
        this.state.floodDetection.triggerWords.push(word);
        input.value = '';
        this.saveState();
        this.refreshTab();
      }
    });

    document.getElementById('new-trigger')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-trigger').click();
      }
    });

    document.querySelectorAll('.remove-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeTriggerWord(index);
      });
    });

    document.getElementById('trigger-only')?.addEventListener('change', (e) => {
      this.state.floodDetection.triggerOnly = e.target.checked;
      this.saveState();
    });
  }

  attachSendEvents() {
    document.getElementById('send-manual')?.addEventListener('click', () => {
      const textarea = document.getElementById('manual-message');
      const message = textarea.value.trim();
      if (message) {
        this.sendMessage(message);
        this.stats.manualSent++;
        this.stats.totalSent++;
        this.saveStats();
        this.addActivity(`Manual message sent: "${message}"`);
        textarea.value = '';
        this.state.manualMessaging.message = '';
        this.saveState();
        this.refreshTab();
      }
    });

    document.getElementById('manual-message')?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        document.getElementById('send-manual').click();
      }
    });

    document.getElementById('manual-message')?.addEventListener('input', (e) => {
      this.state.manualMessaging.message = e.target.value;
      this.saveState();
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const message = e.currentTarget.dataset.message;
        this.sendMessage(message);
        this.stats.manualSent++;
        this.stats.totalSent++;
        this.saveStats();
        this.addActivity(`Quick message sent: "${message}"`);
        this.refreshTab();
      });
    });

    document.getElementById('add-quick')?.addEventListener('click', () => {
      const input = document.getElementById('new-quick');
      const button = input.value.trim();
      if (button && !this.state.manualMessaging.quickButtons.includes(button)) {
        this.state.manualMessaging.quickButtons.push(button);
        input.value = '';
        this.saveState();
        this.refreshTab();
      }
    });

    document.getElementById('new-quick')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('add-quick').click();
      }
    });
  }

  removeTriggerWord(index) {
    if (this.state.floodDetection && this.state.floodDetection.triggerWords) {
      this.state.floodDetection.triggerWords.splice(index, 1);
      this.saveState();
      this.refreshTab();
      this.attachFloodEvents(); // ✅ re-attach buttons after tab refresh
    }
  }

  refreshTab() {
    if (this.panelElement) {
      this.renderContent();
      this.attachEvents();
    }
  }

  togglePanel() {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  showPanel() {
    this.isVisible = true;
    if (this.panelElement) {
      this.panelElement.style.display = 'block';
    }
    this.saveState();
  }

  hidePanel() {
    this.isVisible = false;
    if (this.panelElement) {
      this.panelElement.style.display = 'none';
    }
    this.saveState();
  }

  toggleMinimize() {
    this.state.isMinimized = !this.state.isMinimized;
    this.saveState();
    this.refreshTab();
  }

  makeDraggable() {
    const header = this.panelElement.querySelector('.panel-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffset.x = e.clientX - this.panelElement.offsetLeft;
      dragOffset.y = e.clientY - this.panelElement.offsetTop;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - this.panelElement.offsetWidth));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - this.panelElement.offsetHeight));
        
        this.panelElement.style.left = newX + 'px';
        this.panelElement.style.top = newY + 'px';
        
        this.state.position.x = newX;
        this.state.position.y = newY;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  makeResizable() {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        this.state.size.width = width;
        this.state.size.height = height;
        this.saveState();
      }
    });

    resizeObserver.observe(this.panelElement);
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

    // Simulate text input using execCommand (still supported by Lexical for now)
    document.execCommand('insertText', false, msg);

    // Dispatch input event for Lexical update
    const inputEvent = new InputEvent('input', { bubbles: true });
    inputDiv.dispatchEvent(inputEvent);

    // Click the send button
    sendButton.click();
  }

  startChatAutomation() {
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
    }

    this.automationInterval = setInterval(() => {
      if (this.state.chatAutomation.enabled && this.state.chatAutomation.messages.length > 0) {
        let index = this.state.chatAutomation.currentIndex;
        
        if (this.state.chatAutomation.randomize) {
          index = Math.floor(Math.random() * this.state.chatAutomation.messages.length);
        }
        
        const message = this.state.chatAutomation.messages[index];
        this.sendMessage(message);
        
        this.stats.autoSent++;
        this.stats.totalSent++;
        this.saveStats();
        this.addActivity(`Auto message sent: "${message}"`);
        
        if (!this.state.chatAutomation.randomize) {
          this.state.chatAutomation.currentIndex = (index + 1) % this.state.chatAutomation.messages.length;
        }
        
        this.saveState();
        this.refreshTab();
      }
    }, this.state.chatAutomation.interval * 1000);
  }

  stopChatAutomation() {
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
      this.automationInterval = null;
    }
  }

  restartChatAutomation() {
    this.stopChatAutomation();
    this.startChatAutomation();
  }

  startMonitoring() {
    if (this.chatMonitorInterval) {
      clearInterval(this.chatMonitorInterval);
    }

    this.chatMonitorInterval = setInterval(() => {
      this.checkForNewMessages();
    }, 500);
  }

  checkForNewMessages() {
    const chatContainer = document.querySelector('[data-chat-entry]')?.parentElement ||
                         document.querySelector('.chat-messages') ||
                         document.querySelector('[class*="chat"]');
    
    if (!chatContainer) return;

    const messages = chatContainer.querySelectorAll('[data-chat-entry]');
    const currentHeight = chatContainer.scrollHeight;
    
    if (currentHeight > this.lastChatHeight) {
      this.lastChatHeight = currentHeight;
      
      // Process recent messages for flood detection
      if (this.state.floodDetection.enabled && messages.length > 0) {
        const recentMessages = Array.from(messages).slice(-5);
        recentMessages.forEach(msgElement => {
          this.processMessage(msgElement);
        });
      }
    }
  }

  processMessage(msgElement) {
    try {
      const usernameElement = msgElement.querySelector('[class*="username"]') ||
                             msgElement.querySelector('.chat-entry-username') ||
                             msgElement.querySelector('[data-username]');
      
      const messageElement = msgElement.querySelector('[class*="message"]') ||
                            msgElement.querySelector('.chat-entry-content') ||
                            msgElement.querySelector('[data-message]');

      if (!usernameElement || !messageElement) return;

      const userName = usernameElement.textContent.trim();
      const messageText = messageElement.textContent.trim();
      
      if (userName && messageText) {
        this.checkFlood(userName, messageText);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  checkFlood(userName, messageText) {
    const now = Date.now();
    const normalizedMessage = messageText.toLowerCase().trim();
    
    if (!normalizedMessage) return;

    // Check if trigger-only mode is enabled
    if (this.state.floodDetection.triggerOnly) {
      const triggerMatch = this.state.floodDetection.triggerWords
        .some(word => normalizedMessage.includes(word.toLowerCase()));
      if (!triggerMatch) return;
    }

    // Initialize message tracker
    if (!this.state.floodDetection.messageTracker[normalizedMessage]) {
      this.state.floodDetection.messageTracker[normalizedMessage] = [];
    }

    // Clean old entries outside time window
    const cutoff = now - (this.state.floodDetection.timeWindow * 1000);
    this.state.floodDetection.messageTracker[normalizedMessage] = 
      this.state.floodDetection.messageTracker[normalizedMessage].filter(entry => entry.timestamp > cutoff);

    // Check for existing entry from this user
    const isUnique = this.state.floodDetection.enforceUniqueUsers !== false;
    const existingEntry = this.state.floodDetection.messageTracker[normalizedMessage]
      .find(entry => entry.user === userName);

    if (!isUnique || !existingEntry) {
      this.state.floodDetection.messageTracker[normalizedMessage].push({
        user: userName,
        timestamp: now
      });
    }

    // Check if threshold is met
    const count = this.state.floodDetection.messageTracker[normalizedMessage].length;
    if (count >= this.state.floodDetection.threshold) {
      this.handleFloodDetected(normalizedMessage, messageText);
      
      // Clear this message from tracker to prevent repeated triggers
      delete this.state.floodDetection.messageTracker[normalizedMessage];
    }

    this.saveState();
  }

  handleFloodDetected(normalizedMessage, originalMessage) {
    this.stats.floodsDetected++;
    this.saveStats();

    // Check cooldown
    if (this.state.floodDetection.isCooldownActive) {
      this.addActivity(`Flood detected but cooldown active: "${originalMessage}"`);
      return;
    }

    let messageToSend = '';
    
    switch (this.state.floodDetection.action) {
      case 'send':
        messageToSend = originalMessage;
        break;
      case 'custom':
        messageToSend = this.state.floodDetection.customMessage || originalMessage;
        break;
      case 'warn':
        this.addActivity(`⚠️ Flood detected: "${originalMessage}"`);
        return;
    }

    if (messageToSend) {
      this.sendMessage(messageToSend);
      this.stats.autoSent++;
      this.stats.totalSent++;
      this.saveStats();
      this.addActivity(`🔥 Flood sent: "${messageToSend}"`);
      
      // Start cooldown
      this.startFloodCooldown();
    }
  }

  startFloodCooldown() {
    this.state.floodDetection.isCooldownActive = true;
    this.state.floodDetection.cooldownEndTime = Date.now() + (this.state.floodDetection.cooldown * 1000);
    this.saveState();

    // Clear existing timeout
    if (this.floodCooldownTimeout) {
      clearTimeout(this.floodCooldownTimeout);
    }

    // Set timeout to end cooldown
    this.floodCooldownTimeout = setTimeout(() => {
      this.state.floodDetection.isCooldownActive = false;
      this.state.floodDetection.cooldownEndTime = null;
      this.saveState();
      this.refreshTab();
    }, this.state.floodDetection.cooldown * 1000);

    // Start updating cooldown display
    this.updateCooldownDisplay();
  }

  updateCooldownDisplay() {
    if (!this.state.floodDetection.isCooldownActive) return;

    const remaining = this.getCooldownRemaining();
    if (remaining <= 0) {
      this.state.floodDetection.isCooldownActive = false;
      this.state.floodDetection.cooldownEndTime = null;
      this.saveState();
      this.refreshTab();
      return;
    }

    // Update display if on flood tab
    if (this.currentTab === 'flood') {
      this.refreshTab();
    }

    // Continue updating every second
    setTimeout(() => this.updateCooldownDisplay(), 1000);
  }

  getCooldownRemaining() {
    if (!this.state.floodDetection.isCooldownActive || !this.state.floodDetection.cooldownEndTime) {
      return 0;
    }
    return Math.max(0, Math.ceil((this.state.floodDetection.cooldownEndTime - Date.now()) / 1000));
  }

  addActivity(message) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.state.floodDetection.recentMessages.unshift({
      time: timestamp,
      text: message
    });
    
    // Keep only last 20 messages
    if (this.state.floodDetection.recentMessages.length > 20) {
      this.state.floodDetection.recentMessages = this.state.floodDetection.recentMessages.slice(0, 20);
    }
    
    this.saveState();
    
    // Update stats in storage for popup
    chrome.storage.local.set({
      panelStats: this.stats,
      panelState: this.state
    });
  }

  saveState() {
    localStorage.setItem('kickControlPanelState', JSON.stringify(this.state));
  }

  loadState() {
    try {
      const saved = localStorage.getItem('kickControlPanelState');
      if (saved) {
        const parsedState = JSON.parse(saved);
        this.state = { ...this.state, ...parsedState };
        
        // Ensure all required properties exist
        this.state = { ...this.defaultState(), ...this.state };
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  saveStats() {
    localStorage.setItem('kickControlPanelStats', JSON.stringify(this.stats));
  }

  loadStats() {
    try {
      const saved = localStorage.getItem('kickControlPanelStats');
      if (saved) {
        this.stats = { ...this.stats, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
}

// Initialize the control panel
const kickControlPanel = new KickControlPanel();