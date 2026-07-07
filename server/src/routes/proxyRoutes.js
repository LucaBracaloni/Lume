const express = require('express');
const router = express.Router();
const { forwardRequest } = require('../service/proxyService');

// Catch-all
router.all('/:path(.*)?', async (req, res) => {
    try {
        const path = req.params.path || '';
        console.log('[Proxy] /api/proxy/:path route');
        console.log('method:', req.method);
        console.log('path:', path);
        console.log('body:', req.body);
        console.log('query:', req.query);
        const result = await forwardRequest({
            method: req.method,
            path,
            body: req.body,
            query: req.query
        });
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Internal Proxy Error' });
    }
});

module.exports = router;