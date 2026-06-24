const mongoose = require('mongoose');

const ProdutoSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, 'Título do produto é obrigatório'],
        trim: true
    },
    descricao: {
        type: String,
        default: ''
    },
    capa: {
        type: String,   // URL da imagem
        default: ''
    },
    preco: {
        type: Number,
        required: true,
        min: 0
    },
    link_compra: {
        type: String,
        required: [true, 'Link de compra é obrigatório'],
        trim: true
    },
    ordem: {
        type: Number,
        default: 0
    }
}, { _id: true, timestamps: false });

const ProjetoSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, 'Título é obrigatório'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        sparse: true
    },
    descricao_curta: {
        type: String,
        maxlength: [300, 'Descrição curta não pode ter mais de 300 caracteres']
    },
    descricao_completa: {
        type: String,
        required: [true, 'Descrição completa é obrigatória']
    },
    imagem_principal: {
        type: String,
        default: ''
    },
    galeria: [String],
    // estado removido
    data_inicio: Date,
    data_fim: Date,
    responsaveis: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado'
    }],
    parceiros: [{
        nome: String,
        logo: String,
        website: String
    }],
    financiamento: {
        valor_total: Number,
        fontes: [{
            nome: String,
            valor: Number
        }]
    },
    visivel: {
        type: Boolean,
        default: true
    },
    // 👇 Novo array de produtos (livraria)
    produtos: [ProdutoSchema]
}, {
    timestamps: true
});

// Criar slug automático
ProjetoSchema.pre('save', function(next) {
    if (this.titulo && !this.slug) {
        this.slug = this.titulo
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

module.exports = mongoose.model('Projeto', ProjetoSchema);