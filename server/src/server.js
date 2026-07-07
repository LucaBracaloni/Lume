const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const logger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const proxyRoutes = require('./routes/proxyRoutes');
const mongoose = require('mongoose');
const app = express();

// Connection to Atlas MongoDB
mongoose.connect(process.env.DB_CONNECTION_URL)
    .then(() => console.log("Connessione Effettuata a MongoDB Atlas"))
    .catch(err => console.error("Errore durante la connessione a MongoDB Atlas", err))

// Middleware base
app.use(cors({
    origin: function (origin, callback) {
        // Consenti richieste da estensioni Chrome e localhost:4200
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

// Routes
app.use('/api/proxy', proxyRoutes);

// Health check
app.get('/', (req, res) => {
    res.send('Proxy server attivo');
});

// Start server
app.listen(config, () => {
    console.log(`Server in esecuzione su http://localhost:${config.port}`);
});