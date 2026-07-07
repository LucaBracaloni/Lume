require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    apiKey: process.env.API_KEY,
    baseUrl: process.env.API_BASE_URL,
    dbConnection: process.env.DB_CONNECTION_URL
};