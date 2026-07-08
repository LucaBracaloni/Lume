require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    apiKey: process.env.API_KEY,
    apiKeyGem: process.env.API_KEY_GEM,
    llmModel: process.env.LLM_MODEL,
    baseUrl: process.env.API_BASE_URL,
    baseUrlGem: process.env.API_BASE_URL_GEM,
    dbConnection: process.env.DB_CONNECTION_URL
};