// Lume - Popup Logic

const apiKeyInput = document.getElementById('apiKeyInput');
const enableToggle = document.getElementById('enableToggle');
const saveBtn = document.getElementById('saveBtn');
const savedMsg = document.getElementById('savedMsg');
const toggleVis = document.getElementById('toggleVis');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const catChecks = document.querySelectorAll('.cat-check');

const ALL_CATS = ['expert', 'news', 'community', 'commercial', 'ads', 'lowquality'];

// Load saved settings
chrome.storage.local.get(['apiKey', 'filterEnabled', 'hiddenCategories'], ({ apiKey, filterEnabled, hiddenCategories }) => {
  if (apiKey) {
    apiKeyInput.value = apiKey;
    setStatus(true, 'Estensione configurata e attiva');
  }
  enableToggle.checked = filterEnabled !== false;

  const hidden = hiddenCategories || [];
  catChecks.forEach(cb => {
    const cat = cb.dataset.cat;
    cb.checked = !hidden.includes(cat);
    cb.closest('.filter-toggle').classList.toggle('disabled', !cb.checked);
  });
});

// Toggle visibility of API key
toggleVis.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

// Save settings
saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  const enabled = enableToggle.checked;

  if (!key) {
    setStatus(false, 'Inserisci una chiave API valida');
    return;
  }

  if (!key.startsWith('sk-ant-')) {
    setStatus(false, 'Formato chiave non valido (deve iniziare con sk-ant-)');
    return;
  }

  await chrome.storage.local.set({ apiKey: key, filterEnabled: enabled });
  
  setStatus(enabled, enabled ? 'Estensione configurata e attiva' : 'Estensione disabilitata');
  
  savedMsg.classList.add('show');
  setTimeout(() => savedMsg.classList.remove('show'), 2500);
});

// Update status indicator
function setStatus(active, message) {
  statusDot.className = 'status-dot' + (active ? ' active' : '');
  statusText.textContent = message;
}

// Handle main toggle change
enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;
  chrome.storage.local.set({ filterEnabled: enabled });
  setStatus(enabled && !!apiKeyInput.value.trim(),
    enabled ? 'Estensione attiva' : 'Estensione disabilitata');
});

// Handle category filter changes
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
      chrome.tabs.sendMessage(tabs[0].id, { type: 'APPLY_FILTERS', hiddenCategories: hidden })
        .then(response => {
          // console.log('[Lume Popup] Filtri applicati:', response);
        })
        .catch(err => {
          // Content script non presente in questa tab — normale se non è una pagina di ricerca
          // console.log('[Lume Popup] Tab non supportata:', err.message);
        });
    });
  });
});
