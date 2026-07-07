const axios = require('axios');
const crypto = require('crypto');
const { apiKey, baseUrl } = require('../config/env');
const LumeSchema = require('../models/lumeSchema');

const forwardRequest = async ({ method, path, body, query }) => {
    try {
        // Se non contiene la struttura classica dei messaggi di Anthropic, andiamo in pass-through diretto
        if (!body?.messages?.[0]?.content) {
            return await executeAnthropicCall({ method, path, body, query });
        }

        const contentText = body.messages[0].content;
        // Isoliamo l'array JSON [ ... ] dei risultati all'interno del prompt testo
        const jsonPartMatch = contentText.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (!jsonPartMatch) {
            return await executeAnthropicCall({ method, path, body, query });
        }

        const arrayRisultati = JSON.parse(jsonPartMatch[0]);
        if (!Array.isArray(arrayRisultati) || arrayRisultati.length === 0) {
            return await executeAnthropicCall({ method, path, body, query });
        }

        console.log(`[ProxyService] Ricevuti ${arrayRisultati.length} record da verificare tramite URL.`);

        const risultatiDaInviare = [];
        const risposteFinali = [];

        // 1. VERIFICA DEI SINGOLI URL SU MONGODB
        for (const item of arrayRisultati) {
            // Predilige il link completo 'url', altrimenti usa il 'domain' come fallback
            const urlIdentificatore = item.url || item.domain || "unknown_source";
            const urlClean = urlIdentificatore.toLowerCase().trim().replace(/\/$/, "");
            
            // Generiamo l'hash MD5 dell'URL da usare come search_key indicizzata
            const urlHash = crypto.createHash('md5').update(urlClean).digest('hex');

            // Cerchiamo se questo specifico URL è già stato elaborato in precedenza
            const cacheDoc = await LumeSchema.findOne({ search_key: urlHash });

            if (cacheDoc) {
                // Cache HIT: Recuperiamo l'output salvato
                risposteFinali.push(cacheDoc.ai_elab_output);
            } else {
                // Cache MISS: Questo elemento dovrà essere inviato ad Anthropic
                item._urlHash = urlHash; // Iniettiamo l'hash temporaneo per riprenderlo dopo
                risultatiDaInviare.push(item);
            }
        }

        console.log(`[ProxyService] Cache URL Stats -> HIT: ${risposteFinali.length} | MISS (Nuovi): ${risultatiDaInviare.length}`);

        // 2. SE CI SONO ELEMENTI NUOVI, CHIAMIAMO ANTHROPIC SOLO PER LORO
        if (risultatiDaInviare.length > 0) {
            const modifiedBody = JSON.parse(JSON.stringify(body));
            
            // Ripuliamo l'array dalla proprietà di servizio _urlHash prima di mandarla al prompt di Anthropic
            const payloadPulitoPerAnthropic = risultatiDaInviare.map(({ _urlHash, ...rest }) => rest);
            
            // Aggiorniamo il prompt modificando solo i record mancanti
            modifiedBody.messages[0].content = `Analizza questi risultati di ricerca:\n${JSON.stringify(payloadPulitoPerAnthropic, null, 2)}`;

            console.log(`[ProxyService] Inoltro richiesta parziale a Anthropic per ${risultatiDaInviare.length} elementi.`);
            const anthropicRes = await executeAnthropicCall({ method, path, body: modifiedBody, query });

            if (anthropicRes.status === 200 && Array.isArray(anthropicRes.data)) {
                // 3. SALVIAMO I NUOVI RECORD ANALIZZATI ASSOCIALI ALL'HASH DEL LORO URL
                for (let i = 0; i < anthropicRes.data.length; i++) {
                    const aiOutput = anthropicRes.data[i];
                    const urlHashOriginale = risultatiDaInviare[i]._urlHash;

                    await LumeSchema.findOneAndUpdate(
                        { search_key: urlHashOriginale },
                        {
                            $set: {
                                search_key: urlHashOriginale,
                                query_originale: "url_gran_cache",
                                ai_elab_output: aiOutput,
                                status_response: 200,
                                timestamp: new Date()
                            }
                        },
                        { upsert: true, returnDocument: 'after', strict: false }
                    )
                    .catch(err => console.error(`[ProxyService] Errore upsert record URL:`, err.message));

                    // Iniettiamo i nuovi dati elaborati nel set finale delle risposte
                    risposteFinali.push(aiOutput);
                }
                console.log("[ProxyService] Nuovi log salvati con successo su MongoDB Atlas");
            } else {
                return anthropicRes; // Inoltra l'errore se la chiamata fallisce
            }
        }

        // 4. RESTITUIAMO TUTTI I RECORD COMPLETI (UNIONE DI CACHE HIT + CACHE MISS RICEVUTI)
        return {
            status: 200,
            data: risposteFinali
        };

    } catch (error) {
        console.error('[ProxyService] Errore generale infrastruttura cache:', error.message);
        return {
            status: 500,
            data: { error: error.message }
        };
    }
};

// Funzione di isolamento per la chiamata API di Anthropic ad Axios
const executeAnthropicCall = async ({ method, path, body, query }) => {
    const url = path ? `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : baseUrl;
    
    const response = await axios({
        method,
        url,
        data: body,
        params: query,
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        }
    });

    let parsed = null;
    if (response.data?.content && Array.isArray(response.data.content) && response.data.content[0]?.text) {
        const text = response.data.content[0].text;
        let clean = text.replace(/```json|```/g, '').trim();

        if (!clean.endsWith(']')) {
            const lastObjClose = clean.lastIndexOf('}');
            if (lastObjClose !== -1) {
                clean = clean.substring(0, lastObjClose + 1) + '\n]';
            }
        }

        try {
            parsed = JSON.parse(clean);
        } catch (e) {
            console.error('[ProxyService] Errore parsing JSON Anthropic:', e, '| Raw:', text);
        }
    }

    return {
        status: response.status,
        data: parsed !== null ? parsed : response.data
    };
};

module.exports = {
    forwardRequest
};