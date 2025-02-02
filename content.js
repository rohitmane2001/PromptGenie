let promptGenieButton = null;
let targetElement = null;

function isChromeContextValid() {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' && 
         chrome.runtime?.id !== undefined;
}

function getSyncSettings() {
  return new Promise((resolve, reject) => {
    if (!isChromeContextValid()) {
      return reject(new Error('Extension context invalidated'));
    }

    try {
      chrome.storage.sync.get(['platform', 'apiKey'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    } catch (error) {
      reject(new Error('Failed to access Chrome storage'));
    }
  });
}

// Initialize the extension
function initializeExtension() {
  if (!isChromeContextValid()) {
    console.warn('Chrome extension context not available');
    return;
  }

  getSyncSettings()
    .then(result => {
      if (result.apiKey) {
        initializePromptGenie();
      }
    })
    .catch(error => {
      console.error('Error initializing extension:', error);
    });
}

function initializePromptGenie() {
  if (!isChromeContextValid()) return;

  // Create the floating button
  promptGenieButton = document.createElement('div');
  promptGenieButton.className = 'prompt-genie-button';
  document.body.appendChild(promptGenieButton);
  
  // Hide the button initially
  promptGenieButton.style.display = 'none';
  
  // Track text input elements
  const possiblePromptElements = [
    'textarea',
    'input[type="text"]',
    '.prompt-textarea',
    '[role="textbox"]',
    '[contenteditable="true"]',
    '.monaco-editor .view-line',
    '.cm-content',
    '.ace_text-input'
  ];

  const handleMouseOver = function(e) {
    if (!isChromeContextValid()) {
      cleanup();
      return;
    }
    
    const element = e.target.closest(possiblePromptElements.join(','));
    
    if (element) {
      targetElement = element;
      const rect = element.getBoundingClientRect();
      
      promptGenieButton.style.top = `${rect.top + window.scrollY + 5}px`;
      promptGenieButton.style.left = `${rect.right + window.scrollX - 30}px`;
      promptGenieButton.style.display = 'flex';
    }
  };

  const handleMouseOut = function(e) {
    if (!isChromeContextValid()) {
      cleanup();
      return;
    }
    
    if (!e.relatedTarget?.closest('.prompt-genie-button')) {
      promptGenieButton.style.display = 'none';
    }
  };
  
  const handleButtonClick = async function() {
    if (!targetElement || !isChromeContextValid()) {
      cleanup();
      return;
    }

    const promptText = targetElement.value || targetElement.textContent;
    
    try {
      const settings = await getSyncSettings();
      
      if (!settings?.apiKey) {
        showNotification('Please set your API key in the extension settings first!');
        return;
      }
      
      targetElement.classList.add('prompt-genie-loading');
      
      const optimizedPrompt = await optimizePrompt(
        promptText, 
        settings.platform || 'openai', 
        settings.apiKey
      );
      
      if (targetElement.value !== undefined) {
        targetElement.value = optimizedPrompt;
      } else {
        targetElement.textContent = optimizedPrompt;
      }
      
      showNotification('Prompt optimized successfully!');
      
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Extension context invalidated')) {
        cleanup();
        showNotification('Extension needs to be reloaded. Please refresh the page.');
      } else {
        showNotification('Error optimizing prompt. Please check your API key and try again.');
      }
    } finally {
      targetElement?.classList.remove('prompt-genie-loading');
    }
  };
  
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  promptGenieButton.addEventListener('click', handleButtonClick);

  // Store event listeners for cleanup
  promptGenieButton.dataset.initialized = 'true';
  window._promptGenieListeners = {
    mouseover: handleMouseOver,
    mouseout: handleMouseOut,
    click: handleButtonClick
  };
}

function cleanup() {
  if (window._promptGenieListeners) {
    document.removeEventListener('mouseover', window._promptGenieListeners.mouseover);
    document.removeEventListener('mouseout', window._promptGenieListeners.mouseout);
    if (promptGenieButton) {
      promptGenieButton.removeEventListener('click', window._promptGenieListeners.click);
      promptGenieButton.remove();
    }
    promptGenieButton = null;
    targetElement = null;
    delete window._promptGenieListeners;
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'prompt-genie-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}


async function optimizePrompt(prompt, platform, apiKey) {
  if (!isChromeContextValid()) {
    throw new Error('Extension context invalidated');
  }

  if (!apiKey) {
    throw new Error('API key is missing');
  }

  try {
    let endpoint;
    let requestBody;
    let headers = {
      'Content-Type': 'application/json'
    };
    
    switch(platform) {
      case 'gemini':
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
        requestBody = {
          contents: {
            role: "user",
            parts: [{
              text: `<system_prompt>  
YOU ARE A HIGHLY ADVANCED PROMPT OPTIMIZER DESIGNED TO REFINE AND ENHANCE USER INPUT FOR MAXIMUM CLARITY, RELEVANCE, AND EFFECTIVENESS. YOUR TASK IS TO ANALYZE THE USER’S INPUT PROMPT, IDENTIFY ITS CONTEXT, AND RETURN ONLY THE OPTIMIZED VERSION OF THE PROMPT WITHOUT ANY ADDITIONAL EXPLANATION OR OUTPUT.

${prompt}

###INSTRUCTIONS###  

1. **UNDERSTAND THE CONTEXT**:  
   - DETECT THE INTENDED PURPOSE OF THE INPUT PROMPT.  
   - CLASSIFY THE PROMPT INTO A RELEVANT CATEGORY (E.G., CODE GENERATION, CONTENT CREATION, QUESTION-ANSWERING).  
   - IDENTIFY ANY AMBIGUITIES OR UNNECESSARY COMPLEXITIES.  

2. **OPTIMIZE THE PROMPT**:  
   - RESTRUCTURE THE PROMPT TO BE MORE PRECISE AND SPECIFIC.  
   - REMOVE REDUNDANT OR VAGUE TERMS TO ENHANCE CLARITY.  
   - ADD MISSING CONTEXT OR DETAILS IF NECESSARY TO IMPROVE OUTPUT ACCURACY.  
   - FORMAT THE PROMPT TO ENSURE THE AI UNDERSTANDS IT CORRECTLY.  

3. **RETURN ONLY THE OPTIMIZED PROMPT**:  
   - OUTPUT THE FINAL, REFINED PROMPT WITHOUT ANY ADDITIONAL EXPLANATION.  
   - MAINTAIN THE CORE INTENT WHILE MAXIMIZING THE EFFECTIVENESS OF THE OUTPUT.  

###WHAT NOT TO DO###  
- **DO NOT** RETURN EXPLANATIONS OR JUSTIFICATIONS FOR THE OPTIMIZED PROMPT.  
- **DO NOT** ALTER THE INTENDED MEANING OF THE USER'S INPUT.  
- **DO NOT** INCLUDE ANY INTRODUCTORY OR CLOSING STATEMENTS—RETURN ONLY THE FINAL PROMPT.  
- **DO NOT** ADD UNNECESSARY DETAILS THAT CHANGE THE PROMPT’S PURPOSE.  

###EXAMPLES###  

**Input Prompt:**  
*"Write a Python script to scrape a website."*  

**Optimized Output:**  
*"Generate a Python script using requests and BeautifulSoup to scrape data from a given website, extract relevant information, and format it in JSON."*  

---  

**Input Prompt:**  
*"Tell me about AI."*  

**Optimized Output:**  
*"Provide a detailed explanation of artificial intelligence, including its definition, types (narrow AI vs. general AI), key applications, and recent advancements."*  

</system_prompt>  `
            }]
          }
        };
        break;
        
      case 'openai':
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        requestBody = {
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are an expert at optimizing prompts to get better results. Maintain the original intent while making the prompt more effective."
          }, {
            role: "user",
            content: prompt
          }]
        };
        break;
        
      case 'claude':
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers['anthropic-version'] = '2023-06-01';
        headers['x-api-key'] = apiKey;
        requestBody = {
          model: "claude-3-opus-20240229",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Please optimize this prompt for better results while maintaining its original intent: ${prompt}`
          }]
        };
        break;
        
      default:
        throw new Error(`Unsupported AI platform: ${platform}`);
    }
    
    console.log(`Making request to ${platform} API...`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details available');
        console.error(`API Error Response:`, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        throw new Error(
          `API request failed (${response.status} ${response.statusText}): ${errorText}`
        );
      }
      
      const data = await response.json();
      
      // Validate response data
      if (!data) {
        throw new Error('Empty response from API');
      }
      
      let optimizedPrompt;
      if (platform === 'gemini') {
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.error('Unexpected Gemini API response:', data);
          throw new Error('Unexpected Gemini API response format');
        }
        optimizedPrompt = data.candidates[0].content.parts[0].text;
      } else if (platform === 'openai') {
        if (!data.choices?.[0]?.message?.content) {
          console.error('Unexpected OpenAI API response:', data);
          throw new Error('Unexpected OpenAI API response format');
        }
        optimizedPrompt = data.choices[0].message.content;
      } else if (platform === 'claude') {
        if (!data.content?.[0]?.text) {
          console.error('Unexpected Claude API response:', data);
          throw new Error('Unexpected Claude API response format');
        }
        optimizedPrompt = data.content[0].text;
      }
      
      if (!optimizedPrompt) {
        throw new Error('Failed to extract optimized prompt from API response');
      }
      
      return optimizedPrompt;
      
    } catch (fetchError) {
      // Handle network errors
      if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
        throw new Error(`Unable to connect to ${platform} API. Please check your internet connection.`);
      }
      throw fetchError;
    }
    
  } catch (error) {
    // Log detailed error information
    console.error('Error in optimizePrompt:', error);
    
    // Convert technical errors into user-friendly messages
    if (error.message.includes('401')) {
      throw new Error(`Invalid API key for ${platform}. Please check your API key in the extension settings.`);
    } else if (error.message.includes('403')) {
      throw new Error(`Access denied to ${platform} API. Please verify your API key has the correct permissions.`);
    } else if (error.message.includes('429')) {
      throw new Error(`Rate limit exceeded for ${platform} API. Please try again later.`);
    } else if (error.message.includes('500')) {
      throw new Error(`${platform} API server error. Please try again later.`);
    }
    
    throw error;
  }
}


// Update the handleButtonClick function to show more specific errors
const handleButtonClick = async function() {
  if (!targetElement || !isChromeContextValid()) {
    cleanup();
    return;
  }

  const promptText = targetElement.value || targetElement.textContent;
  
  try {
    const settings = await getSyncSettings();
    
    if (!settings?.apiKey) {
      showNotification('Please set your API key in the extension settings first!');
      return;
    }
    
    targetElement.classList.add('prompt-genie-loading');
    
    const optimizedPrompt = await optimizePrompt(
      promptText, 
      settings.platform || 'openai', 
      settings.apiKey
    );
    
    if (targetElement.value !== undefined) {
      targetElement.value = optimizedPrompt;
    } else {
      targetElement.textContent = optimizedPrompt;
    }
    
    showNotification('Prompt optimized successfully!');
    
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('Extension context invalidated')) {
      cleanup();
      showNotification('Extension needs to be reloaded. Please refresh the page.');
    } else {
      showNotification(error.message || 'Error optimizing prompt. Please check your API key and try again.');
    }
  } finally {
    targetElement?.classList.remove('prompt-genie-loading');
  }
};



// Initialize on load
initializeExtension();

// Cleanup on unload
window.addEventListener('unload', cleanup);