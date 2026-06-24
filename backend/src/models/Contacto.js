const mongoose = require('mongoose');

const ContactoSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        lowercase: true,
        trim: true
    },
    telefone: {
        type: String,
        trim: true
    },
    assunto: {
        type: String,
        required: true,
        enum: ['informacoes', 'associar', 'voluntariado', 'parceria', 'evento', 'outro'],
        default: 'outro'
    },
    mensagem: {
        type: String,
        required: [true, 'Mensagem é obrigatória']
    },
    status: {
        type: String,
        enum: ['nao_lida', 'lida', 'respondida', 'arquivada'],
        default: 'nao_lida'
    },
    lida_em: Date,
    respondida_em: Date,
    resposta: {
        texto: String,
        enviada_por: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Associado'
        }
    },
    ip: String,
    userAgent: String
}, {
    timestamps: true
});

// Índices para pesquisa
ContactoSchema.index({ nome: 'text', email: 'text', mensagem: 'text' });

module.exports = mongoose.model('Contacto', ContactoSchema);