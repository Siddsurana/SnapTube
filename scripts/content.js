// Store captured screenshots
let capturedScreenshots = [];
let isInitialized = false;
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

// Debug logging function - only log to console
function debugLog(message, error = false) {
    const prefix = '[TubeSnap PDF]';
    if (error) {
        console.error(`${prefix} Error:`, message);
    } else {
        console.log(`${prefix}`, message);
    }
}

// Function to inject CSS
function injectCSS() {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL('styles/toolbar.css');
        link.onload = () => {
            debugLog('CSS loaded successfully');
            resolve();
        };
        link.onerror = (err) => {
            debugLog('CSS loading failed: ' + err, true);
            reject(err);
        };
        document.head.appendChild(link);
    });
}

// Add keyboard listener for screenshot capture
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's' && isInitialized) {
        e.preventDefault();
        debugLog('Screenshot shortcut pressed');
        captureScreenshot();
    }
});

// Create and inject the floating toolbar
function createFloatingToolbar() {
    debugLog('Creating floating toolbar');
    
    // Check if toolbar already exists
    if (document.getElementById('tubeSnap-toolbar')) {
        debugLog('Toolbar already exists');
        return;
    }

    const toolbar = document.createElement('div');
    toolbar.id = 'tubeSnap-toolbar';
    toolbar.innerHTML = `
        <div class="tubeSnap-controls">
            <button id="tubeSnap-capture" title="Capture Screenshot (Press 'S')">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm-7 7H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4z"/>
                </svg>
            </button>
            <button id="tubeSnap-view" title="View Captures">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
                </svg>
            </button>
            <button id="tubeSnap-reset" title="Reset">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
            </button>
            <button id="tubeSnap-pdf" title="Generate PDF">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/>
                </svg>
            </button>
        </div>
    `;

    // Force toolbar to be visible
    toolbar.style.display = 'block !important';
    toolbar.style.visibility = 'visible !important';
    toolbar.style.opacity = '1 !important';
    
    // Insert toolbar into the page
    document.body.appendChild(toolbar);
    debugLog('Toolbar injected into page');

    // Make toolbar draggable
    makeDraggable(toolbar);
    
    // Add event listeners
    setupEventListeners(toolbar);
}

// Make an element draggable
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        // Only allow dragging from the toolbar itself, not its buttons
        if (e.target.tagName.toLowerCase() === 'button' || 
            e.target.tagName.toLowerCase() === 'svg' || 
            e.target.tagName.toLowerCase() === 'path') {
            return;
        }
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Setup event listeners for toolbar buttons
function setupEventListeners(toolbar) {
    toolbar.querySelector('#tubeSnap-capture').addEventListener('click', captureScreenshot);
    toolbar.querySelector('#tubeSnap-view').addEventListener('click', viewCaptures);
    toolbar.querySelector('#tubeSnap-reset').addEventListener('click', resetCaptures);
    toolbar.querySelector('#tubeSnap-pdf').addEventListener('click', generatePDF);
}

// Function to check if extension context is valid
async function checkExtensionContext() {
    try {
        await chrome.runtime.getURL('');
        return true;
    } catch (error) {
        return false;
    }
}

// Function to reinitialize the extension
async function reinitialize() {
    debugLog('Attempting to reinitialize extension...');
    if (initRetryCount >= MAX_INIT_RETRIES) {
        showNotification('Extension needs to be reloaded. Please refresh the page.', 'error');
        return false;
    }
    
    initRetryCount++;
    try {
        await init();
        initRetryCount = 0;
        return true;
    } catch (error) {
        debugLog('Reinitialization attempt failed: ' + error.message, true);
        return false;
    }
}

// Capture screenshot of current video frame
async function captureScreenshot() {
    if (!await checkExtensionContext()) {
        if (!await reinitialize()) {
            showNotification('Please refresh the page to continue capturing screenshots.', 'error');
            return;
        }
    }

    const video = document.querySelector('video');
    if (!video) {
        showNotification('No video found on page!', 'error');
        return;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const timestamp = video.currentTime;
        const screenshotData = {
            image: canvas.toDataURL('image/png'),
            timestamp: timestamp,
            timeFormatted: formatTime(timestamp),
            caption: '',
            dateCapture: new Date().toISOString()
        };

        capturedScreenshots.push(screenshotData);
        await chrome.storage.local.set({ screenshots: capturedScreenshots });
        showNotification('Screenshot captured!', 'success');
        promptForCaption(capturedScreenshots.length - 1);
    } catch (error) {
        debugLog('Error capturing screenshot: ' + error.message, true);
        if (error.message.includes('Extension context invalidated')) {
            showNotification('Extension needs to be reloaded. Please refresh the page.', 'error');
        } else {
            showNotification('Error capturing screenshot: ' + error.message, 'error');
        }
    }
}

// Format time in HH:MM:SS
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Show notification with type
function showNotification(message, type = 'success') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.tubeSnap-notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `tubeSnap-notification ${type}`;
    notification.textContent = message;
    
    // Force styles to ensure visibility
    notification.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 16px !important;
        font-weight: 500 !important;
        min-width: 200px !important;
        text-align: center !important;
        opacity: 1 !important;
        transition: opacity 0.3s ease !important;
        display: block !important;
        ${type === 'success' 
            ? 'background: #4caf50 !important; color: white !important; border: 2px solid #2e7d32 !important;' 
            : 'background: #f44336 !important; color: white !important; border: 2px solid #d32f2f !important;'
        }
    `;
    
    // Add to page
    document.body.appendChild(notification);

    // Log for debugging
    console.log('Showing notification:', message, type);

    // Remove after delay with fade out
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification && notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Prompt for caption
function promptForCaption(index) {
    const modal = document.createElement('div');
    modal.className = 'tubeSnap-modal';
    modal.innerHTML = `
        <div class="tubeSnap-modal-content">
            <h3>Add Caption</h3>
            <textarea placeholder="Enter caption for this screenshot..."></textarea>
            <div class="tubeSnap-modal-buttons">
                <button class="save">Save</button>
                <button class="skip">Skip</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const saveCaption = () => {
        const caption = modal.querySelector('textarea').value;
        capturedScreenshots[index].caption = caption;
        chrome.storage.local.set({ screenshots: capturedScreenshots }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving caption:', chrome.runtime.lastError);
                showNotification('Error saving caption!', 'error');
            }
        });
        modal.remove();
    };

    modal.querySelector('.save').addEventListener('click', saveCaption);
    modal.querySelector('.skip').addEventListener('click', () => modal.remove());

    // Allow Enter key to save
    modal.querySelector('textarea').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveCaption();
        }
    });
}

// View captured screenshots
function viewCaptures() {
    if (capturedScreenshots.length === 0) {
        showNotification('No screenshots to view!', 'error');
        return;
    }

    const viewer = document.createElement('div');
    viewer.className = 'tubeSnap-viewer';
    viewer.innerHTML = `
        <div class="tubeSnap-viewer-content">
            <h2>Captured Screenshots (${capturedScreenshots.length})</h2>
            <div class="tubeSnap-screenshots"></div>
            <button class="tubeSnap-close-btn">Close</button>
        </div>
    `;
    
    const screenshotsContainer = viewer.querySelector('.tubeSnap-screenshots');
    capturedScreenshots.forEach((screenshot, index) => {
        const screenshotElement = document.createElement('div');
        screenshotElement.className = 'tubeSnap-screenshot';
        screenshotElement.innerHTML = `
            <img src="${screenshot.image}" alt="Screenshot ${index + 1}">
            <div class="tubeSnap-screenshot-info">
                <span class="timestamp">${screenshot.timeFormatted}</span>
                <p class="caption">${screenshot.caption || 'No caption'}</p>
            </div>
        `;
        screenshotsContainer.appendChild(screenshotElement);
    });

    document.body.appendChild(viewer);

    // Add click event listener to close button
    const closeButton = viewer.querySelector('.tubeSnap-close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            viewer.remove();
        });
    }

    // Also close when clicking outside the content
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            viewer.remove();
        }
    });
}

// Reset captures
function resetCaptures() {
    if (capturedScreenshots.length === 0) {
        showNotification('No screenshots to reset!', 'error');
        return;
    }

    if (confirm('Are you sure you want to reset all captures?')) {
        capturedScreenshots = [];
        chrome.storage.local.set({ screenshots: [] }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error resetting screenshots:', chrome.runtime.lastError);
                showNotification('Error resetting screenshots!', 'error');
                return;
            }
            showNotification('All captures reset!', 'success');
        });
    }
}

// Generate PDF
async function generatePDF() {
    if (!await checkExtensionContext()) {
        if (!await reinitialize()) {
            showNotification('Please refresh the page to generate PDF.', 'error');
            return;
        }
    }

    if (capturedScreenshots.length === 0) {
        showNotification('No screenshots to generate PDF from!', 'error');
        return;
    }

    showNotification('Generating PDF...', 'success');
    debugLog('Starting PDF generation...');

    try {
        // Load jsPDF library
        await new Promise((resolve, reject) => {
            if (typeof window.jspdf !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = chrome.runtime.getURL('scripts/jspdf.umd.min.js');
            
            script.onload = () => {
                debugLog('jsPDF library loaded successfully');
                resolve();
            };
            
            script.onerror = (error) => {
                debugLog('Error loading jsPDF library: ' + error, true);
                reject(new Error('Failed to load PDF library'));
            };
            
            document.head.appendChild(script);
        });

        // Wait a moment for the library to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if library is properly loaded
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            throw new Error('PDF library not properly initialized');
        }

        debugLog('Creating new PDF document');
        const doc = new window.jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        for (let i = 0; i < capturedScreenshots.length; i++) {
            const screenshot = capturedScreenshots[i];
            debugLog(`Processing screenshot ${i + 1} of ${capturedScreenshots.length}`);
            
            if (i > 0) {
                doc.addPage();
            }
            
            // Add timestamp
            doc.setFontSize(12);
            doc.text(`Timestamp: ${screenshot.timeFormatted}`, 20, 20);
            
            // Add caption if exists
            if (screenshot.caption) {
                doc.setFontSize(10);
                doc.text(`Note: ${screenshot.caption}`, 20, 30);
            }
            
            // Add image with error handling
            try {
                debugLog(`Adding image for screenshot ${i + 1}`);
                const imgData = screenshot.image;
                const imgProps = doc.getImageProperties(imgData);
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                
                // Calculate dimensions to fit the page while maintaining aspect ratio
                let imgWidth = pageWidth - 40; // 20mm margins on each side
                let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                
                // If height is too large, scale based on height instead
                if (imgHeight > pageHeight - 50) { // 50mm total space for text and margins
                    imgHeight = pageHeight - 50;
                    imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                }
                
                doc.addImage(
                    imgData,
                    'PNG',
                    20,
                    40,
                    imgWidth,
                    imgHeight
                );
            } catch (err) {
                debugLog('Error adding image to PDF: ' + err.message, true);
                throw new Error(`Error adding image ${i + 1} to PDF: ${err.message}`);
            }
        }
        
        debugLog('Generating PDF blob');
        const pdfBlob = doc.output('blob');
        
        debugLog('Sending PDF to background script for download');
        const response = await chrome.runtime.sendMessage({
            action: 'downloadPDF',
            blob: await blobToBase64(pdfBlob)
        });

        if (response && response.success) {
            debugLog('PDF generation and download successful');
            showNotification('PDF generated successfully!', 'success');
        } else {
            throw new Error(response?.error || 'Unknown error during download');
        }
    } catch (error) {
        debugLog('PDF generation failed: ' + error.message, true);
        if (error.message.includes('Extension context invalidated')) {
            showNotification('Extension needs to be reloaded. Please refresh the page.', 'error');
        } else {
            showNotification('Error generating PDF: ' + error.message, 'error');
        }
    }
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Initialize the extension
async function init() {
    debugLog('Initializing extension');
    
    try {
        // Inject CSS first
        await injectCSS();
        
        // Load existing screenshots
        const data = await chrome.storage.local.get('screenshots');
        if (chrome.runtime.lastError) {
            throw new Error('Error loading screenshots: ' + chrome.runtime.lastError.message);
        }
        
        if (data.screenshots) {
            capturedScreenshots = data.screenshots;
            debugLog(`Loaded ${capturedScreenshots.length} existing screenshots`);
        }
        
        // Create toolbar
        createFloatingToolbar();
        isInitialized = true;
        debugLog('Extension initialized successfully');
        
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Wait for video to be ready with timeout
function waitForVideo(timeout = 10000) {
    debugLog('Waiting for video element');
    
    let timeElapsed = 0;
    const checkInterval = 1000; // Check every second
    
    const videoCheck = setInterval(() => {
        const video = document.querySelector('video');
        if (video) {
            clearInterval(videoCheck);
            debugLog('Video element found');
            init();
        } else {
            timeElapsed += checkInterval;
            if (timeElapsed >= timeout) {
                clearInterval(videoCheck);
                debugLog('Timeout waiting for video element');
                // Try initializing anyway
                init();
            }
        }
    }, checkInterval);
}

// Check if we're on a YouTube watch page
function isYouTubeWatch() {
    return window.location.pathname.includes('/watch');
}

// Start initialization immediately
init();

// Also wait for video as a backup
waitForVideo();

// Add a visible test button
const testButton = document.createElement('button');
testButton.textContent = 'Test TubeSnap';
testButton.style.cssText = `
    position: fixed;
    top: 40px;
    left: 10px;
    z-index: 999999;
    background: blue;
    color: white;
    padding: 10px;
`;
testButton.onclick = () => {
    debugLog('Test button clicked');
    createFloatingToolbar();
};
document.body.appendChild(testButton);

// Listen for URL changes (for YouTube's SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        debugLog('URL changed');
        if (isYouTubeWatch()) {
            debugLog('New YouTube watch page detected');
            waitForVideo();
        }
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('Received message: ' + JSON.stringify(request));
    
    if (request.action === 'pdfError') {
        showNotification('Error generating PDF: ' + request.error, 'error');
    }
    
    return true;
}); 