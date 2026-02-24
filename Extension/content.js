// Function to fetch random number via background script
async function fetchRandomNumber() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchRandomNumber' },
      response => {
        if (response && response.success) {
          resolve(response.number);
        } else {
          // Fallback to local random number if API fails
          console.log('API failed, using local fallback');
          resolve(Math.floor(Math.random() * 100) + 1);
        }
      }
    );
  });
}

// Function to show result popup
function showResultPopup(number, tweetElement, usedFallback = false) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.random-number-popup');
  if (existingPopup) existingPopup.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'random-number-popup';
  
  if (usedFallback) {
    popup.innerHTML = `
      <div class="popup-content fallback">
        <div class="popup-header">
          <span>Bot chance</span>
          <button class="popup-close">×</button>
        </div>
        <div class="popup-number">This tweet is ${number}% bot-written</div>
        <div style="font-size: 11px; padding: 4px 16px 12px; color: #888; text-align: center;">
          ⚡ API unavailable - used local generation
        </div>
      </div>
    `;
  } else {
    popup.innerHTML = `
      <div class="popup-content">
        <div class="popup-header">
          <span>Bot chance</span>
          <button class="popup-close">×</button>
        </div>
        <div class="popup-number">This tweet is ${number}% bot-written</div>
      </div>
    `;
  }

  // Position popup near the tweet
  const tweetRect = tweetElement.getBoundingClientRect();
  popup.style.top = `${window.scrollY + tweetRect.top - 10}px`;
  popup.style.left = `${window.scrollX + tweetRect.right - 320}px`;

  // Add to page
  document.body.appendChild(popup);

  // Add close button functionality
  popup.querySelector('.popup-close').addEventListener('click', () => {
    popup.remove();
  });
}

// Function to add button to tweet
function addButtonToTweet(tweet) {
  // Check if button already exists
  if (tweet.querySelector('.random-number-btn')) {
    return;
  }

  // Find the actions bar in the tweet
  const actionsBar = tweet.querySelector('[role="group"]');
  if (!actionsBar) return;

  // Create button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'random-number-btn-container';
  
  const button = document.createElement('button');
  button.className = 'random-number-btn';
  button.setAttribute('aria-label', 'Generate random number');
  button.innerHTML = '🤖';
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Show loading state
    button.innerHTML = '⏳';
    button.disabled = true;
    
    // Fetch random number via background script
    const number = await fetchRandomNumber();
    
    // Check if we used fallback (number between 1-100 and API failed)
    const usedFallback = number === Math.floor(Math.random() * 100) + 1;
    
    // Show result popup
    showResultPopup(number, tweet, usedFallback);
    
    // Reset button
    button.innerHTML = '🤖';
    button.disabled = false;
  });

  buttonContainer.appendChild(button);
  actionsBar.appendChild(buttonContainer);
}

// Function to scan for tweets
function scanForTweets() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(tweet => addButtonToTweet(tweet));
}

// Initial scan with delay to ensure Twitter loads
setTimeout(scanForTweets, 2000);

// Set up observer for dynamically loaded tweets
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      scanForTweets();
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});