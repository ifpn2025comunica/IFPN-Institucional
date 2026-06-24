const mongoose = require('mongoose');

const NewsletterSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    nome: {
        type: String,
        trim: true
    },
    categorias: {
        type: [String],
        enum: ['projetos', 'eventos', 'noticias', 'todos'],
        default: ['todos']
    },
    data_subscricao: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Newsletter', NewsletterSchema);