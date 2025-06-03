// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log('TubeSnap PDF extension installed/updated');
});

// Keep service worker active
chrome.runtime.onStartup.addListener(() => {
  console.log('TubeSnap PDF extension started');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (request.action === 'saveScreenshots') {
    try {
      // Create a zip of screenshots
      const downloads = request.screenshots.map(screenshot => {
        // Convert base64 to blob
        const base64Data = screenshot.data.replace(/^data:image\/png;base64,/, '');
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        
        const blob = new Blob(byteArrays, { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        
        // Download the image
        return new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: url,
            filename: `youtube-screenshots/${screenshot.filename}`,
            saveAs: false
          }, (downloadId) => {
            URL.revokeObjectURL(url);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(downloadId);
            }
          });
        });
      });

      // Create and download the index file
      const indexContent = request.screenshots.map(s => 
        `File: ${s.filename}\nTimestamp: ${s.timestamp}\nCaption: ${s.caption}\n---`
      ).join('\n');
      
      const indexBlob = new Blob([indexContent], { type: 'text/plain' });
      const indexUrl = URL.createObjectURL(indexBlob);
      
      downloads.push(new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: indexUrl,
          filename: 'youtube-screenshots/index.txt',
          saveAs: false
        }, (downloadId) => {
          URL.revokeObjectURL(indexUrl);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(downloadId);
          }
        });
      }));

      // Wait for all downloads to complete
      Promise.all(downloads)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error downloading files:', error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // Keep the message channel open for async response
    } catch (error) {
      console.error('Error processing screenshots:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  if (request.action === 'downloadPDF') {
    try {
      // Convert base64 to data URL
      const base64Data = request.blob.split(',')[1];
      const dataUrl = `data:application/pdf;base64,${base64Data}`;
      
      // Download PDF using data URL
      chrome.downloads.download({
        url: dataUrl,
        filename: 'youtube-screenshots.pdf',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: 'Error downloading PDF' });
        } else {
          sendResponse({ success: true });
        }
      });
      
      return true; // Keep the message channel open for async response
    } catch (error) {
      console.error('PDF download error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}); 