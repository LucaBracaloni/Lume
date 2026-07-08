const enableToggle = document.getElementById('enableToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const catChecks = document.querySelectorAll('.cat-check');
const ALL_CATS = ['expert', 'news', 'community', 'commercial', 'ads', 'lowquality'];

// Load saved settings
chrome.storage.local.get(
  ['filterEnabled', 'hiddenCategories'],
  ({ filterEnabled = true, hiddenCategories = [] }) => {

    enableToggle.checked = filterEnabled;

    setStatus(
      filterEnabled,
      filterEnabled
        ? 'Estensione attiva'
        : 'Estensione disabilitata'
    );

    catChecks.forEach(cb => {
      const enabled = !hiddenCategories.includes(cb.dataset.cat);

      cb.checked = enabled;
      cb.closest('.filter-toggle').classList.toggle(
        'disabled',
        !enabled
      );
    });
  }
);

function notifyActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;

    chrome.tabs.sendMessage(tabs[0].id, message, () => {
      if (chrome.runtime.lastError) {
        // console.log('[Lume]', chrome.runtime.lastError.message);
      }
    });
  });
}

//set ui status dot
function setStatus(active, message) {
  statusDot.className = 'status-dot' + (active ? ' active' : '');
  statusText.textContent = message;
}

//enable/disable extension handler
enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;

  chrome.storage.local.set({
    filterEnabled: enabled
  });

  setStatus(
    enabled,
    enabled ? 'Estensione attiva' : 'Estensione disabilitata'
  );

  notifyActiveTab({
    type: 'TOGGLE_EXTENSION',
    enabled
  });
});

// handle category filter changes
catChecks.forEach(cb => {
  cb.addEventListener('change', () => {

    cb.closest('.filter-toggle').classList.toggle(
      'disabled',
      !cb.checked
    );

    const hidden = [...catChecks]
      .filter(c => !c.checked)
      .map(c => c.dataset.cat);

    chrome.storage.local.set({
      hiddenCategories: hidden
    });

    notifyActiveTab({
      type: 'APPLY_FILTERS',
      hiddenCategories: hidden
    });
  });
});
