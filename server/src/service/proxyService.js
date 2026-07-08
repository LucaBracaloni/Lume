const axios = require('axios');
const crypto = require('node:crypto');
const { apiKey, apiKeyGem, baseUrl, baseUrlGem, llmModel } = require('../config/env');
const LumeSchema = require('../models/lumeSchema');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(apiKeyGem);

const forwardRequest = async ({ method, path, body, query }) => {
    try {
        // check if content is a valid structure
        if (!body?.messages?.[0]?.content) {
            return await executeGeminiCall({ body });
        }

        // extraction content test
        const contentText = body.messages[0].content;
        const jsonPartMatch = contentText.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (!jsonPartMatch) {
            return await executeGeminiCall({ body });
        }

        const arrayRisultati = JSON.parse(jsonPartMatch[0]);
        if (!Array.isArray(arrayRisultati) || arrayRisultati.length === 0) {
            return await executeGeminiCall({ body });
        }

        console.log(`[ProxyService] Ricevuti ${arrayRisultati.length} record da verificare.`);

        // Cache logic to check data before elab
        const risultatiDaInviare = [];
        const risposteFinali = [];

        for (const item of arrayRisultati) {
            const urlIdentificatore = item.url || item.domain || "unknown_source";
            const urlClean = urlIdentificatore.toLowerCase().trim().replace(/\/$/, "");
            const urlHash = crypto.createHash('md5').update(urlClean).digest('hex');
            const cacheDoc = await LumeSchema.findOne({ search_key: urlHash });

            if (cacheDoc) {
                risposteFinali.push(cacheDoc.ai_elab_output);
            } else {
                item._urlHash = urlHash; 
                risultatiDaInviare.push(item);
            }
        }

        console.log(`[ProxyService] Cache Stats -> CACJED: ${risposteFinali.length} | SAVED: ${risultatiDaInviare.length}`);

        // New record call Gemini api to elaborate data
        if (risultatiDaInviare.length > 0) {
            const modifiedBody = structuredClone(body);
            const payloadPulito = risultatiDaInviare.map(({ _urlHash, ...rest }) => rest);
            
            modifiedBody.messages[0].content = `Analizza questi risultati di ricerca:\n${JSON.stringify(payloadPulito, null, 2)}`;
            console.log(`[ProxyService] Inoltro richiesta a Gemini per ${risultatiDaInviare.length} elementi.`);
            
            const geminiRes = await executeGeminiCall({ body: modifiedBody });

            if (geminiRes.status === 200 && Array.isArray(geminiRes.data)) {
                for (let i = 0; i < geminiRes.data.length; i++) {
                    const aiOutput = geminiRes.data[i];
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
                        { upsert: true }
                    ).catch(err => console.error(`[ProxyService] Errore upsert:`, err.message));
                    risposteFinali.push(aiOutput);
                }
                console.log("[ProxyService] Nuovi log salvati su MongoDB Atlas");
            } else {
                return geminiRes;
            }
        }

        return { status: 200, data: risposteFinali };
    } catch (error) {
        console.error('[ProxyService] Errore generale:', error.message);
        return { status: 500, data: { error: error.message } };
    }
};

const executeGeminiCall = async ({ body }) => {
    try {
        console.log("[ProxyService] Elaborazione in corso...");

        // extraction payload send to gemini from background.js
        const systemPrompt = body.system;
        const userPrompt = body.messages?.[0] ? body.messages[0].content : "";
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        // Model configuration
        const model = genAI.getGenerativeModel({ 
            model: llmModel,
            generationConfig: { 
                responseMimeType: "application/json" 
            } 
        });

        // API call
        console.log("[ProxyService] Invio a Gemini...");
        const result = await model.generateContent(fullPrompt);
        let jsonText = result.response.text().trim();
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
        
        if (jsonText.startsWith('[')) {
            const match = jsonText.match(/\[[\s\S]*\]/);
            jsonText = match ? match[0] : jsonText;
        } 
        else if (jsonText.startsWith('{')) {
            const match = jsonText.match(/\{[\s\S]*\}/);
            jsonText = match ? match[0] : jsonText;
        }

        console.log("[ProxyService] Risposta ricevuta e parsata.");
        return {
            status: 200,
            data: JSON.parse(jsonText)
        };
    } catch (e) {
        console.error('[ProxyService] Errore critico:', e);
        return { 
            status: 500, 
            data: { error: e.message } 
        };
    }
};

module.exports = {
    forwardRequest
};