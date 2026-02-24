// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchRandomNumber') {
    fetch('http://www.randomnumberapi.com/api/v1.0/random?min=1&max=100&count=1')
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, number: data[0] });
      })
      .catch(error => {
        console.error('Background fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }
});