# Kick Control Panel Chrome Extension

A professional Chrome extension that provides advanced automation features for Kick.com streaming platform.

## Features

### 🤖 Chat Automation
- Send messages automatically with customizable intervals (5-300 seconds)
- Add/remove custom messages with live preview
- Randomize message order option
- Real-time message queue display

### 🛡️ Flood Detection
- Detects when the same message appears multiple times from different users
- Configurable threshold (2-10 occurrences) and time window (5-60 seconds)
- Option to automatically send detected flood messages or warn only
- Real-time message tracking and analysis

### 📤 Manual Messaging
- Send individual messages directly through the panel
- Quick message buttons for common responses
- Ctrl/Cmd+Enter shortcut for quick sending
- Message history and statistics

### 📊 Real-time Monitoring
- Live activity feed with timestamps
- Detailed statistics (total sent, auto vs manual, floods detected)
- Color-coded status indicators
- Persistent settings and data

### 🎨 Professional Interface
- Draggable, resizable floating panel
- Minimize/maximize functionality
- Dark gaming-themed UI with smooth animations
- Responsive design that works on all screen sizes

## Installation

1. Download or clone this extension
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Navigate to any Kick.com page to see the control panel

## Usage

### Getting Started
1. Click the extension icon in your browser toolbar
2. Navigate to Kick.com (required for functionality)
3. Click "Open Control Panel" to show the floating interface
4. The panel will automatically detect chat messages and integrate with Kick's interface

### Chat Automation
1. Go to the "Chat" tab
2. Add your custom messages using the input field
3. Configure interval and randomization settings
4. Click "Start" to begin automated messaging
5. Monitor progress in real-time

### Flood Detection
1. Switch to the "Flood" tab  
2. Set your detection threshold (how many times the same message must appear)
3. Configure time window for message tracking
4. Choose action: "Send Message" (auto-send detected floods) or "Warn Only"
5. Enable detection and monitor the activity feed

### Manual Messaging
1. Use the "Send" tab for one-off messages
2. Type your message or use quick buttons
3. Press "Send Message" or use Ctrl/Cmd+Enter
4. View statistics for manual vs automated messages

### Settings & Data
- All settings are automatically saved to browser storage
- Data persists across browser sessions
- Use "Clear" buttons to reset activity logs
- Panel position and state are remembered

## Technical Details

- **Manifest V3** compatible for latest Chrome versions
- **Content Script** injection for seamless Kick.com integration  
- **Local Storage** + Chrome Storage API for settings persistence
- **Modern JavaScript** with ES6+ features and error handling
- **Responsive Design** with mobile and accessibility support

## Permissions

- `activeTab`: Access current Kick.com tab for chat integration
- `storage`: Save user preferences and statistics
- `notifications`: Show system notifications for important events
- `host_permissions`: Inject functionality into Kick.com pages

## Development

The extension is built with vanilla JavaScript and modern web APIs. No external dependencies required.

### File Structure
- `manifest.json`: Extension configuration and permissions
- `content.js`: Main control panel logic and Kick.com integration
- `background.js`: Service worker for extension lifecycle management
- `popup.html/js`: Extension popup interface and statistics
- `styles.css`: Enhanced styling for the control panel
- `icons/`: Extension icons (16px, 48px, 128px)

### Key Features
- **Intelligent Chat Detection**: Automatically finds and integrates with Kick's chat input elements
- **Flood Pattern Recognition**: Analyzes message patterns across different users in real-time
- **Persistent State Management**: Saves all settings and statistics across browser sessions
- **Error Handling**: Robust error handling for network issues and DOM changes
- **Performance Optimized**: Minimal resource usage with efficient event handling

## License

This project is for educational purposes. Please respect Kick.com's terms of service when using automation features.

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify you're on a Kick.com page with chat functionality
3. Try refreshing the page and reopening the control panel
4. Check that the extension has proper permissions enabled