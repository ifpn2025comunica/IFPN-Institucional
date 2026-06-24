const mongoose = require('mongoose');

const NoticiaSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, 'Título é obrigatório'],
        trim: true,
        maxlength: [200, 'Título não pode ter mais de 200 caracteres']
    },
    subtitulo: {
        type: String,
        trim: true,
        maxlength: [300, 'Subtítulo não pode ter mais de 300 caracteres']
    },
    conteudo: {
        type: String,
        required: [true, 'Conteúdo é obrigatório']
    },
    imagem_destaque: {
        type: String,
        default: ''
    },
    categorias: [{
        type: String,
        enum: ['noticia', 'evento', 'comunicado', 'publicacao'],
        default: 'noticia'
    }],
    tags: [String],
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado'
    },
    data_publicacao: {
        type: Date,
        default: Date.now
    },
    destaque: {
        type: Boolean,
        default: false
    },
    estado: {
        type: String,
        enum: ['publicada', 'rascunho', 'agendada'],
        default: 'publicada'
    },
    visualizacoes: {
        type: Number,
        default: 0
    },
    multimedia: {
        tipo: {
            type: String,
            enum: ['nenhum', 'audio', 'video', 'link'],
            default: 'nenhum'
        },
        url: {
            type: String,
            default: ''
        },
        titulo: {
            type: String,
            default: ''
        },
        descricao: {
            type: String,
            default: ''
        },
        // Para vídeos (YouTube, Vimeo) - guardar o ID
        embed_code: {
            type: String,
            default: ''
        }
    },
    slug: {
        type: String,
        unique: true,
        sparse: true
    }

}, {
    timestamps: true
});

// Criar slug automático a partir do título
NoticiaSchema.pre('save', function(next) {
    if (this.titulo && !this.slug) {
        this.slug = this.titulo
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

// Índices para pesquisa
NoticiaSchema.index({ titulo: 'text', conteudo: 'text' });

module.exports = mongoose.model('Noticia', NoticiaSchema);