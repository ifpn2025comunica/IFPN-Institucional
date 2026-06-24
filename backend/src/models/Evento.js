const mongoose = require('mongoose');

const EventoSchema = new mongoose.Schema({
    // Relação com o projeto
    projeto_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Projeto',
        required: false 
    },
    
    titulo: {
        type: String,
        required: [true, 'Título é obrigatório'],
        trim: true
    },
    
    descricao: {
        type: String,
        required: [true, 'Descrição é obrigatória']
    },
    
    tipo: {
        type: String,
        enum: ['workshop', 'conferencia', 'reuniao', 'cultural', 'outro'],
        default: 'outro'
    },
    
    data_inicio: {
        type: Date,
        required: [true, 'Data de início é obrigatória']
    },
    
    data_fim: Date,
    
    local: {
        nome: String,
        morada: String,
        online: { type: Boolean, default: false },
        link: String
    },
    
    imagem: String,
    
    capacidade: {
        type: Number,
        default: 0
    },
    
    organizadores: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado'
    }],
    
    inscritos: [{
        associado_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Associado'
        },
        data_inscricao: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['confirmado', 'pendente', 'cancelado'],
            default: 'confirmado'
        }
    }],
    
    visivel: {
        type: Boolean,
        default: true
    },
    
    ordem: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices
EventoSchema.index({ projeto_id: 1, data_inicio: -1 });

module.exports = mongoose.model('Evento', EventoSchema);