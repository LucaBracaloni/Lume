const SF_BADGE_STYLES = `
  :host {
    display: block;
    margin: 0 0 10px 0;
    all: initial;
  }
  * { box-sizing: border-box; }
  .sf-badge {
    display: flex;
    align-items: stretch;
    width: fit-content;
    max-width: 480px;
    border-radius: 8px;
    font-family: -apple-system, 'Google Sans', 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 12px;
    line-height: 1;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06);
    cursor: default;
    user-select: none;
    direction: ltr;
    writing-mode: horizontal-tb;
    text-align: left;
  }
  .sf-badge.sf-loading {
    background: #f1f3f4;
    padding: 7px 13px;
    align-items: center;
    gap: 8px;
    color: #5f6368;
    box-shadow: none;
    border: 1px solid #dadce0;
  }
  .sf-spinner {
    width: 11px; height: 11px;
    border: 2px solid #dadce0;
    border-top-color: #4285f4;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sf-cat {
    display: flex; align-items: center;
    padding: 7px 11px;
    font-weight: 600; font-size: 12px;
    white-space: nowrap; flex-shrink: 0; color: #fff;
  }
  .sf-label { font-weight: 600; }
  .sf-reason {
    display: flex; align-items: center;
    padding: 7px 11px;
    color: #3c4043; font-size: 11.5px; font-weight: 400;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 280px;
    border-left: 1px solid rgba(0,0,0,0.09);
  }
  .sf-score {
    display: flex; align-items: center;
    padding: 7px 10px;
    font-weight: 700; font-size: 11px; color: #3c4043;
    white-space: nowrap; flex-shrink: 0;
    border-left: 1px solid rgba(0,0,0,0.09);
    background: rgba(0,0,0,0.05);
  }
  .sf-badge.sf-expert            { background: #e6f4ea; }
  .sf-badge.sf-expert .sf-cat    { background: #137333; }
  .sf-badge.sf-news              { background: #e8f0fe; }
  .sf-badge.sf-news .sf-cat      { background: #1a73e8; }
  .sf-badge.sf-community         { background: #f3e5f5; }
  .sf-badge.sf-community .sf-cat { background: #7b1fa2; }
  .sf-badge.sf-commercial            { background: #fff3e0; }
  .sf-badge.sf-commercial .sf-cat    { background: #e65100; }
  .sf-badge.sf-ads               { background: #fce8e6; }
  .sf-badge.sf-ads .sf-cat       { background: #c62828; }
  .sf-badge.sf-lowquality            { background: #f5f0ef; }
  .sf-badge.sf-lowquality .sf-cat    { background: #6d4c41; }
`;

// Creates a Shadow DOM host and inserts it at `container` level, right before
// the direct child of `container` that wraps the h3.
// This guarantees the host is OUTSIDE any nested transformed divs (which flip text).
function createShadowBadge(container, h3) {
  const host = document.createElement('div');
  host.className = 'sf-badge-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = SF_BADGE_STYLES;
  shadow.appendChild(styleEl);
  const badge = document.createElement('div');
  badge.className = 'sf-badge sf-loading';
  badge.innerHTML = `<span class="sf-spinner"></span><span>Analisi in corso...</span>`;
  shadow.appendChild(badge);

  // Walk up from h3 to find the direct child of `container`.
  // We insert the host before that child — keeping us at the container level
  // where there are no nested CSS transforms.
  let titleBlock = h3;
  while (titleBlock.parentElement && titleBlock.parentElement !== container) {
    titleBlock = titleBlock.parentElement;
  }
  if (titleBlock.parentElement === container) {
    titleBlock.before(host);
  } else {
    // Fallback: prepend to container
    container.prepend(host);
  }

  return { host, badge, shadow };
}

(async () => {
  // console.log('[Lume] Content script avviato');

  const { apiKey, filterEnabled, hiddenCategories } = await chrome.storage.local.get(['apiKey', 'filterEnabled', 'hiddenCategories']);
  
  // console.log('[Lume] filterEnabled:', filterEnabled, '| apiKey presente:', !!apiKey);

  if (!apiKey) {
    console.warn('[Lume] Nessuna API key trovata. Configurala nel popup.');
    return;
  }
  if (filterEnabled === false) {
    console.warn('[Lume] Estensione disattivata dal popup.');
    return;
  }

  // Google changes its DOM class names frequently. Instead of relying on
  // class-based selectors (which break silently), we locate <h3> elements
  // (result titles — stable across Google versions) and walk up to find the
  // nearest ancestor that contains both a link and a snippet. This approach
  // is robust against Google DOM refactors.
  const findResultContainers = () => {
    // All <h3> elements inside the main search area
    const searchRoot = document.querySelector('#search, #rso, #main, [id="search"]') || document.body;
    const h3s = [...searchRoot.querySelectorAll('h3')];

    const containers = [];
    const seen = new Set();

    for (const h3 of h3s) {
      // The link is typically the immediate parent <a> of the <h3>, or a sibling
      const linkEl = h3.closest('a[href]') || h3.querySelector('a[href]') || h3.parentElement?.querySelector('a[href]');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href') || '';
      if (!href.startsWith('http')) continue;

      // Walk up from the h3 to find the result card container.
      // Rules:
      //  1. Never stop inside an <a> tag (would cause invalid HTML on prepend).
      //  2. Walk at least 3 levels so we clear the link wrapper divs.
      //  3. Stop when innerText is long enough to represent a full result card
      let container = h3.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!container || container === searchRoot || container === document.body) break;
        // Never accept an <a> as the badge container (invalid block-in-inline HTML)
        const isAnchor = container.tagName === 'A';
        const hasEnoughContent = container.innerText.length > 150;
        if (!isAnchor && i >= 2 && hasEnoughContent) {
          break;
        }
        container = container.parentElement;
      }

      // Defensive: skip if we ended up on an anchor or the root
      if (!container || container.tagName === 'A' || container === searchRoot || container === document.body) continue;
      if (seen.has(container)) continue;
      seen.add(container);

      containers.push({ container, h3, linkEl, href });
    }

    return containers;
  };

  // Wait for results to appear (Google loads them async)
  const waitForResults = () => new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const results = findResultContainers();
      if (results.length > 0) {
        // console.log(`[Lume] Trovati ${results.length} risultati tramite h3-scan`);
        resolve(results);
        return;
      }
      attempts++;
      if (attempts > 30) {
        reject(new Error('Timeout: nessun risultato trovato dopo 9 secondi'));
        return;
      }
      setTimeout(check, 300);
    };
    check();
  });

  let resultContainers;
  try {
    resultContainers = await waitForResults();
  } catch (e) {
    console.error('[Lume]', e.message);
    return;
  }

  // Extract data from each result
  const resultData = [];
  resultContainers.forEach(({ container, h3, linkEl, href }, index) => {
    // Skip already-analyzed elements
    if (container._sfBadgeHost) return;

    const snippetEl = container.querySelector('.VwiC3b, [data-sncf], .s3v9rd, .IsZvec, [data-content-feature]');
    // Fallback: grab any paragraph-like text in the container, excluding the title
    const snippetText = snippetEl
      ? snippetEl.innerText.substring(0, 200)
      : container.innerText.replace(h3.innerText, '').substring(0, 200).trim();

    let domain = '';
    try { domain = new URL(href).hostname.replace('www.', ''); } catch {}

    resultData.push({
      index,
      element: container,
      h3,
      title:   h3.innerText.trim(),
      url:     href,
      domain,
      snippet: snippetText
    });
  });

  // console.log(`[Lume] Risultati validi estratti: ${resultData.length}`);
  if (resultData.length === 0) {
    console.warn('[Lume] Nessun risultato valido estratto. Il DOM di Google potrebbe essere cambiato.');
    return;
  }

  // Insert loading badges at container level (outside any inner transformed divs)
  resultData.forEach(({ element, h3 }) => {
    const { host } = createShadowBadge(element, h3);
    // Store the host reference directly on the resultData item
    element._sfBadgeHost = host;
  });

  // Call API via background service worker (avoids CORS in MV3)
  try {
    const batchPayload = resultData.map(r => ({
      title: r.title,
      domain: r.domain,
      snippet: r.snippet
    }));

    // console.log('[Lume] Invio richiesta al background worker...');
    const result = await chrome.runtime.sendMessage({
      type: 'ANALYZE_RESULTS',
      apiKey,
      batchPayload
    });

    // console.log('[Lume] Risposta ricevuta:', result?.ok, '| analisi:', result?.analyses?.length);

    if (!result?.ok) {
      throw new Error(result?.error || 'Unknown error from background');
    }

    const analyses = result.analyses || [];

    // Apply badges and tag each element with its category via data attribute
    resultData.forEach(({ element }, i) => {
      const host = element._sfBadgeHost;
      const badge = host?.shadowRoot?.querySelector('.sf-badge');
      if (!badge) return;

      const analysis = analyses[i];
      if (!analysis) {
        host.remove();
        return;
      }

      const config = getCategoryConfig(analysis.category);
      badge.className = `sf-badge sf-${analysis.category}`;
      badge.innerHTML = `
        <span class="sf-cat"><span class="sf-label">${config.label}</span></span>
        <span class="sf-reason">${analysis.reason}</span>
        <span class="sf-score" title="Punteggio qualità">${analysis.score}/10</span>
      `;

      // Tag the container — this is the single source of truth for filtering
      element.dataset.sfCategory = analysis.category;
      // Default dim for noisy categories
      if (['ads', 'lowquality'].includes(analysis.category)) {
        element.classList.add('sf-dimmed');
      }
    });

    // Re-read hiddenCategories to get the latest value in case it was changed while we were waiting for the API response
    const { hiddenCategories: latestHidden } = await chrome.storage.local.get(['hiddenCategories']);
    applyFilters(latestHidden || []);

  } catch (err) {
    console.error('[Lume] Errore:', err.message);
    document.querySelectorAll('.sf-badge-host').forEach(h => h.remove());
  }
})();

// Uses data-sf-category attribute — works even if called before or after analysis
function applyFilters(hiddenCategories) {
  const hidden = Array.isArray(hiddenCategories) ? hiddenCategories : [];
  // console.log('[Lume] applyFilters chiamato. Nascosti:', hidden);

  // All result containers that have been analyzed
  document.querySelectorAll('[data-sf-category]').forEach(el => {
    const cat = el.dataset.sfCategory;
    if (hidden.includes(cat)) {
      el.style.setProperty('display', 'none', 'important');
    } else {
      el.style.removeProperty('display');
      if (['ads', 'lowquality'].includes(cat)) {
        el.classList.add('sf-dimmed');
      } else {
        // Ensure authoritative/quality sources are never accidentally dimmed
        el.classList.remove('sf-dimmed');
      }
    }
  });
}

// Listen for filter updates from popup (via message)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'APPLY_FILTERS') {
    applyFilters(message.hiddenCategories || []);
    sendResponse({ ok: true });
  }
});

// Listen for storage changes (more reliable fallback for filter updates)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.hiddenCategories) {
    applyFilters(changes.hiddenCategories.newValue || []);
  }
});

// category config
function getCategoryConfig(category) {
  const configs = {
    expert:     { label: 'Fonte Autorevole' },
    news:       { label: 'Media / Notizie' },
    community:  { label: 'Community' },
    commercial: { label: 'Shop / Commerciale' },
    ads:        { label: 'Pubblicità / SEO Spam' },
    lowquality: { label: 'Bassa Qualità' }
  };
  return configs[category] || { label: 'Non classificato' };
}
