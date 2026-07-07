const enableToggle = document.getElementById('enableToggle');
const saveBtn = document.getElementById('saveBtn');
const savedMsg = document.getElementById('savedMsg');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const catChecks = document.querySelectorAll('.cat-check');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleVis = document.getElementById('toggleVis');
const ALL_CATS = ['expert', 'news', 'community', 'commercial', 'ads', 'lowquality'];

// Load saved settings
chrome.storage.local.get(['apiKey', 'filterEnabled', 'hiddenCategories'], ({ apiKey, filterEnabled, hiddenCategories }) => {
  if (apiKey) {
    apiKeyInput.value = apiKey;
    setStatus(true, 'Estensione configurata e attiva');
  }
  enableToggle.checked = filterEnabled !== false;

  // Set initial status
  setStatus(enableToggle.checked, enableToggle.checked ? 'Estensione attiva' : 'Estensione disabilitata');
  const hidden = hiddenCategories || []; // hidden categories
  
  // Sync category checkboxes with storage
  catChecks.forEach(cb => {
    const cat = cb.dataset.cat;
    cb.checked = !hidden.includes(cat);
    cb.closest('.filter-toggle').classList.toggle('disabled', !cb.checked);
  });
});

//toogle view api key input pwd
toggleVis.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

//set ui status dot
function setStatus(active, message) {
  statusDot.className = 'status-dot' + (active ? ' active' : '');
  statusText.textContent = message;
}

//enable/disable extension handler
enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;
  chrome.storage.local.set({ filterEnabled: enabled });

  setStatus(enabled, enabled ? 'Estensione attiva' : 'Estensione disabilitata');
});

//save settings handler
saveBtn.addEventListener('click', () => {
  const enabled = enableToggle.checked;
  const apiKey = apiKeyInput.value.trim();

  chrome.storage.local.set({
    filterEnabled: enabled,
    apiKey
  }, () => {

    setStatus(enabled, enabled ? 'Estensione attiva' : 'Estensione disabilitata' );

    savedMsg.classList.add('show');
    //hidden msg after 2.5s
    setTimeout(() => {
      if (savedMsg) savedMsg.classList.remove('show');
    }, 2500);

    //send message to content script to background server with api call details and prompt
    chrome.runtime.sendMessage(
      {
        type: 'CALL_API',
        payload: {},
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Messaging error:', chrome.runtime.lastError.message);
          return;
        }
        console.log(response?.success ? response.data : response?.error);
      }
    );
  });
});

// handle category filter changes
catChecks.forEach(cb => {
  cb.addEventListener('change', () => {
    cb.closest('.filter-toggle').classList.toggle('disabled', !cb.checked);

    const hidden = ALL_CATS.filter(cat => {
      const el = document.querySelector(`.cat-check[data-cat="${cat}"]`);
      return el && !el.checked;
    });

    // Persist filter preferences
    chrome.storage.local.set({ hiddenCategories: hidden });

    // Notify the active search tab immediately
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: 'APPLY_FILTERS', hiddenCategories: hidden },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log('[Lume Popup] Tab non supportata:', chrome.runtime.lastError.message);
            return;
          }
          console.log('[Lume Popup] Filtri applicati:', response);
        }
      );
    });
  });
});
