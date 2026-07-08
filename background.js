const IS_PRODUCTION = true;
const API_BASE = IS_PRODUCTION 
  ? 'https://lume-proxy-server.onrender.com/api/proxy' 
  : 'http://127.0.0.1:3000/api/proxy';

//set default settings on install
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({ //use local to not sync sensitive API key
      filterEnabled: true  //default enabled
    });
  }
});

async function callProxy(path, options = {}) {
  let realPath = path;
  let realOptions = options;
  if (typeof path === 'object' && path.path) {
    realPath = path.path;
    realOptions = path;
  }

  const response = await fetch(`${API_BASE}/${realPath}`, {
    method: realOptions.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':'POST,PATCH,OPTIONS',
      'X-Lume-Client': 'extension-v1.0'
    },
    body: realOptions.body ? JSON.stringify(realOptions.body) : undefined
  });

  if (!response.ok) {
    throw new Error('Errore nella richiesta');
  }

  return response.json();
}

// Listen for messages from content scripts and handle API calls
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Lume] Messaggio ricevuto:', message);
  // check message type and call proxy accordingly
  if (message.type === 'CALL_API') {
    console.log('[Lume] CALL_API ricevuto con payload:', message.payload);
    callProxy(message.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }
    if (message.type === 'ANALYZE_RESULTS') {
      const { searchPayload } = message;
      console.log('[Lume] searchPayload ricevuto dal content script:', searchPayload);

      callProxy({
        path: 'messages',
        method: 'POST',
        body: {
          model: 'gemini',
          //prompt 
          system: `Sei un analizzatore esperto di qualità delle fonti web (ecosistema editoriale italiano/internazionale).

        ## OBIETTIVO
        Classificare risultati di ricerca per distinguere contenuti autorevoli da spam, pubblicità e bassa qualità. Sii severo e coerente.

        ## REGOLE DI VALUTAZIONE
        1. **Dominio**: Valuta l'autorevolezza del publisher. Un TLD .edu/.gov non salva un contenuto palesemente commerciale ospitato lì.
        2. **Title/Snippet**: Cerca dati verificabili, citazioni, date vs clickbait, superlativi vuoti, linguaggio vago o riassunti automatici.
        3. **Cautela**: In caso di segnali in conflitto, applica la categoria/score più basso tra le due plausibili.
        4. **Dati mancanti**: Se title o snippet sono assenti, valuta solo sul dominio riducendo lo score, ma classifica sempre.

        ## CATEGORIE E SCORE TIPICI
        - "expert" (7-10): Fonti primarie, università, enti di ricerca/governativi, ospedali, paper peer-reviewed.
        - "news" (5-8): Quotidiani, riviste nazionali/settore, blog con autore identificabile.
        - "community" (4-7): Reddit, forum specializzati, Stack Overflow, Wikipedia.
        - "commercial" (3-6): E-commerce, SaaS, servizi, blog aziendali onesti con finalità di vendita.
        - "ads" (1-4): Pubblicità mascherata, SEO spam, clickbait aggressivo, recensioni affiliate.
        - "lowquality" (1-3): Content farm, aggregatori, testo generato da AI o tradotto male, pubblicità invasiva.

        ## OUTPUT OBBLIGATORIO
        Rispondi ESCLUSIVAMENTE con un array JSON valido, senza markdown (NO \`\`\`json), senza testo prima o dopo. Sii sintetico nel campo "details" (massimo 2 frasi).

        Formato:
        [
          {
            "url": "example.com"
            "category": "expert|news|community|commercial|ads|lowquality",
            "score": 1-10,
            "confidence": 0-1,
            "reason": {
              "summary": "Breve sintesi",
              "details": "Spiegazione sintetica dei segnali (max 2 frasi)",
              "positiveSignals": [],
              "negativeSignals": []
            },
            "signals": {
              "authority": 0-10,
              "contentQuality": 0-10,
              "transparency": 0-10,
              "commercialIntent": 0-10,
              "spamRisk": 0-10
            },
            "source": {
              "type": "government|academic|media|community|company|unknown",
              "publisher": "Nome o null",
              "recognized": true|false
            },
            "analysis": {
              "domainMatch": "strong|medium|weak|unknown",
              "titleQuality": "neutral|technical|clickbait|unknown",
              "snippetQuality": "high|medium|low|unknown",
              "riskFactors": []
            }
          }
        ]`,
          messages: [{
            role: 'user',
            content: `Analizza questi risultati di ricerca:\n${JSON.stringify(searchPayload, null, 2)}`
          }]
        }

      })
        .then(data => sendResponse({ ok: true, analyses: data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }
});