const mongoose = require('mongoose');

const LumeSchema = new mongoose.Schema({
    timestamp: {type: Date, default: Date.now},
    search_key: { type: String, unique: true, sparse: true }, //search unique key built by url
    dati_ser_raw: mongoose.Schema.Types.Mixed, //google data returned from user research
    ai_elab_output: mongoose.Schema.Types.Mixed, //data ai elaborated with classification
    status_response: { type: Number }
})

module.exports = mongoose.model('LumeSchema', LumeSchema)