// Default settings
const defaultSettings = {
    imageQuality: 'high',
    maxScreenshots: 50,
    autoTimestamp: true,
    promptCaption: true,
    darkMode: false
};

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    
    // Add event listener for save button
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

// Load settings from storage
function loadSettings() {
    chrome.storage.sync.get(defaultSettings, (settings) => {
        document.getElementById('imageQuality').value = settings.imageQuality;
        document.getElementById('maxScreenshots').value = settings.maxScreenshots;
        document.getElementById('autoTimestamp').checked = settings.autoTimestamp;
        document.getElementById('promptCaption').checked = settings.promptCaption;
        document.getElementById('darkMode').checked = settings.darkMode;
    });
}

// Save settings to storage
function saveSettings() {
    const settings = {
        imageQuality: document.getElementById('imageQuality').value,
        maxScreenshots: parseInt(document.getElementById('maxScreenshots').value),
        autoTimestamp: document.getElementById('autoTimestamp').checked,
        promptCaption: document.getElementById('promptCaption').checked,
        darkMode: document.getElementById('darkMode').checked
    };
    
    chrome.storage.sync.set(settings, () => {
        // Show success message
        const status = document.getElementById('status');
        status.textContent = 'Settings saved successfully!';
        status.className = 'status success';
        
        // Notify content script about settings change
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'settingsUpdated',
                settings: settings
            });
        });
        
        // Hide success message after 2 seconds
        setTimeout(() => {
            status.className = 'status';
        }, 2000);
    });
}

// Validate input values
document.getElementById('maxScreenshots').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    if (value < 1) e.target.value = 1;
    if (value > 100) e.target.value = 100;
}); 