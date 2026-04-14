// Lume - Background Service Worker
// Handles extension lifecycle events

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Open options page on first install
    //chrome.tabs.create({ url: 'popup.html' });
    // Set defaults
    chrome.storage.local.set({ //use local to not sync sensitive API key
      filterEnabled: true 
    });
  }
});

// Handle API calls from content scripts (avoids CORS issues in MV3)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'ANALYZE_RESULTS') return false;

  const { apiKey, batchPayload } = message;

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      // The prompt instructs the AI to classify search results into quality categories
      system: `Sei un analizzatore esperto di qualità delle fonti web con conoscenza approfondita dell'ecosistema internet italiano e internazionale.
        ## OBIETTIVO
        Classificare risultati di ricerca per aiutare gli utenti a distinguere contenuti autorevoli da spam, pubblicità e bassa qualità.

        ## CATEGORIE (scegli UNA sola per risultato)

        ### Contenuto di valore
        - **"expert"** — Fonte primaria autorevole: università, istituti di ricerca, enti governativi, ospedali, esperti con credenziali verificabili, giornalismo investigativo premiato, organizzazioni internazionali (WHO, NASA, ISTAT...). Score tipico: 7-10.
        - **"news"** — Media e giornalismo: quotidiani nazionali/internazionali, riviste di settore, blog con autori identificabili e fonti citate, podcast informativi. Score tipico: 5-8.
        - **"community"** — Contenuto generato da utenti: Reddit, forum specializzati, Stack Overflow, discussioni con esperti verificabili. Valore dipende dalla qualità della comunità. Score tipico: 4-7.

        ### Contenuto commerciale (neutro)
        - **"commercial"** — Sito con intento commerciale primario ma legittimo: e-commerce, SaaS, servizi professionali, landing page di prodotto. Non è necessariamente negativo. Score tipico: 3-6.

        ### Contenuto da evitare
        - **"ads"** — Pubblicità mascherata, SEO spam, clickbait aggressivo, articoli "sponsored" non dichiarati, siti creati solo per monetizzare traffico, comparatori affiliati senza valore editoriale, titoli sensazionalistici senza sostanza. Score tipico: 1-4.
        - **"lowquality"** — Aggregatori di contenuti altrui, siti-specchio, contenuto auto-generato da AI senza revisione, traduzioni automatiche di scarsa qualità, siti con pubblicità invasiva e contenuto minimo. Score tipico: 1-3.

        ## SEGNALI DA VALUTARE
        **Domain:** TLD accademici (.edu, .ac.it), governativi (.gov, .europa.eu), organizzazioni (.org), vs domini commerciali generici o TLD sospetti.
        **Title:** Presenza di clickbait ("Non crederai mai...", "I X migliori..."), linguaggio neutro/tecnico vs emotivo/sensazionalistico.
        **Snippet:** Cita fonti? Ha autori? Contiene dati/numeri specifici? O è vago e generico?
        **Dominio noto:** Riconosci il brand come fonte affidabile nel settore?

        ## OUTPUT
        Rispondi ESCLUSIVAMENTE con un array JSON valido. Zero testo prima o dopo. Stesso numero di oggetti dell'input, nello stesso ordine.

        Formato: [{"category":"expert","reason":"Istituto nazionale di ricerca medica","score":9}, ...]

        Regole:
        - "reason": max 7 parole, in italiano, specifica (NON generica come "fonte affidabile")
        - "score": intero 1-10 basato su autorevolezza, accuratezza attesa, trasparenza editoriale
        - In caso di ambiguità tra due categorie, scegli quella con score più basso (principio di cautela)`,
      messages: [{
        role: 'user',
        content: `Analizza questi risultati di ricerca:\n${JSON.stringify(batchPayload, null, 2)}`
      }]
    })
  })
    .then(res => res.json())
    .then(data => {
      // console.log('[Lume BG] Risposta API completa:', JSON.stringify(data).substring(0, 500));

      // Check for API-level errors
      if (data.error) {
        console.error('[Lume BG] Errore API:', data.error.type, data.error.message);
        sendResponse({ ok: false, error: `API error: ${data.error.type} - ${data.error.message}` });
        return;
      }

      const text = data.content?.[0]?.text;
      if (!text) {
        console.error('[Lume BG] Nessun testo nella risposta:', JSON.stringify(data));
        sendResponse({ ok: false, error: 'No text in API response', raw: JSON.stringify(data) });
        return;
      }

      // console.log('[Lume BG] Testo risposta:', text.substring(0, 300));
      try {
        const clean = text.replaceAll(/```json|```/g, '').trim();
        const analyses = JSON.parse(clean);
        // console.log('[Lume BG] Analisi parsate:', analyses.length);
        sendResponse({ ok: true, analyses });
      } catch (e) {
        console.error('[Lume BG] Errore parsing JSON:', e.message, '| Raw:', text.substring(0, 200));
        sendResponse({ ok: false, error: 'JSON parse error: ' + e.message, raw: text });
      }
    })
    .catch(err => {
      console.error('[Lume BG] Fetch error:', err.message);
      sendResponse({ ok: false, error: err.message });
    });

  return true; // keep message channel open for async response
});
