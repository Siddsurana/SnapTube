// Send a test message to the background script
chrome.runtime.sendMessage({ action: 'test' }, response => {
    if (chrome.runtime.lastError) {
        console.error('Test failed:', chrome.runtime.lastError);
    } else {
        console.log('Test successful:', response);
    }
});

// Log that content script is loaded
console.log('TubeSnap: Test script loaded'); 