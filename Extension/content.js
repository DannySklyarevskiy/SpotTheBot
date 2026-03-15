// Detect platform
const isReddit = window.location.hostname.includes('reddit.com');

// Function to fetch random number via background script
async function fetchRandomNumber() {
  return new Promise((resolve) => {
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
function showResultPopup(text, positionElement, usedFallback = false) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.random-number-popup');
  if (existingPopup) existingPopup.remove();

  // Escape HTML to safely display user content
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'random-number-popup';

  popup.innerHTML = `
    <div class="popup-content${usedFallback ? ' fallback' : ''}">
      <div class="popup-header">
        <span>${isReddit ? 'Comment' : 'Tweet'}</span>
        <button class="popup-close">×</button>
      </div>
      <div class="popup-text">${escapedText || '(no text found)'}</div>
      ${usedFallback ? '<div style="font-size: 11px; padding: 4px 16px 12px; color: #888; text-align: center;">⚡ API unavailable - used local generation</div>' : ''}
    </div>
  `;

  // Position popup: below the button on Reddit, near the element on Twitter
  const rect = positionElement.getBoundingClientRect();
  if (isReddit) {
    popup.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
  } else {
    popup.style.top = `${window.scrollY + rect.top - 10}px`;
    popup.style.left = `${window.scrollX + rect.right - 320}px`;
  }

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
  button.setAttribute('aria-label', 'Check bot chance');
  button.innerHTML = '🤖';

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Show loading state
    button.innerHTML = '⏳';
    button.disabled = true;

    // Extract tweet text
    const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.innerText || '';

    // Fetch random number via background script
    const number = await fetchRandomNumber();

    // Check if we used fallback
    const usedFallback = number === Math.floor(Math.random() * 100) + 1;

    // Show result popup
    showResultPopup(tweetText, tweet, usedFallback);

    // Reset button
    button.innerHTML = '🤖';
    button.disabled = false;
  });

  buttonContainer.appendChild(button);
  actionsBar.appendChild(buttonContainer);
}

// Function to add button to a Reddit comment
function addButtonToRedditComment(comment) {
  // Check if button already exists
  if (comment.querySelector('.random-number-btn')) {
    return;
  }

  // Find the action row in the Reddit comment (new Reddit uses slot="actionRow")
  const actionsBar = comment.querySelector('[slot="actionRow"]');
  if (!actionsBar) return;

  // Create button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'random-number-btn-container';

  const button = document.createElement('button');
  button.className = 'random-number-btn';
  button.setAttribute('aria-label', 'Check bot chance');
  button.innerHTML = '🤖';

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    button.innerHTML = '⏳';
    button.disabled = true;

    // Extract comment text — try multiple selectors for Reddit's varying DOM structures
    const commentText = (
      comment.querySelector('[slot="text-body"]') ||
      comment.querySelector('.RichTextJSON-root') ||
      comment.querySelector('[id$="-post-rtjson-content"]') ||
      comment.querySelector('p')
    )?.innerText || '';

    showResultPopup(commentText, button);

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

// Function to scan for Reddit comments
function scanForRedditComments() {
  const comments = document.querySelectorAll('shreddit-comment');
  comments.forEach(comment => addButtonToRedditComment(comment));
}

// Initial scan with delay to ensure page loads
if (isReddit) {
  setTimeout(scanForRedditComments, 2000);
} else {
  setTimeout(scanForTweets, 2000);
}

// Set up observer for dynamically loaded content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      if (isReddit) {
        scanForRedditComments();
      } else {
        scanForTweets();
      }
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
