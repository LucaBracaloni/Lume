const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100,
    message: {
        error: 'Troppe richieste, riprova più tardi'
    }
});

module.exports = limiter;