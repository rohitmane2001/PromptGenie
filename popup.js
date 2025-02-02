document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get(['platform', 'apiKey'], function(result) {
    if (result.platform) {
      document.getElementById('platformSelect').value = result.platform;
    }
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });

  // Save settings
  document.getElementById('saveButton').addEventListener('click', function() {
    const platform = document.getElementById('platformSelect').value;
    const apiKey = document.getElementById('apiKey').value;

    chrome.storage.sync.set({
      platform: platform,
      apiKey: apiKey
    }, function() {
      alert('Settings saved successfully!');
    });
  });
});
