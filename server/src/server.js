const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const logger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const proxyRoutes = require('./routes/proxyRoutes');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();

const dbUri = process.env.DB_CONNECTION_URL;

if(!dbUri){
    console.error("DB_CONNECTION_URL non è definita nelle variabili d'ambiente");
    process.exit(1);
}

// Connection to Atlas MongoDB
mongoose.connect(dbUri)
    .then(() => console.log("Connessione Effettuata a MongoDB Atlas"))
    .catch(err => console.error("Errore durante la connessione a MongoDB Atlas", err))

// Middlewar
app.use(cors({
    origin: function (origin, callback) {
        // consent request from chrome extension and localhost
        if (!origin || origin.startsWith('chrome-extension://') || origin === 'http://localhost:4200') {
        callback(null, true);
        } else {
        callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(logger);
app.use(rateLimiter);
app.use('/api/proxy', proxyRoutes);

// check
app.get('/', (req, res) => {
    res.send('Proxy server attivo');
});

// Start server
app.listen(config, () => {
    console.log(`Server in esecuzione su http://localhost:${config.port}`);
});