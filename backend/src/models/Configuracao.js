const mongoose = require('mongoose');

const ConfiguracaoSchema = new mongoose.Schema({
    // Vídeos e Transmissões
    transmissao_ao_vivo: {
        titulo: { type: String, default: 'Transmissão ao vivo' },
        link: { type: String, default: 'https://www.youtube.com/embed/live_stream?channel=UCYOURCHANNELID' },
        ativo: { type: Boolean, default: true }
    },
    videos_arquivo: [{
        titulo: { type: String, default: '' },
        link: { type: String, default: '' },
        thumbnail: { type: String, default: '' },
        descricao: { type: String, default: '' },
        ordem: { type: Number, default: 0 }
    }],
    
    // Redes Sociais
    redes_sociais: {
        facebook: { type: String, default: 'https://facebook.com/ifpn' },
        instagram: { type: String, default: 'https://instagram.com/ifpn' },
        youtube: { type: String, default: 'https://youtube.com/@ifpn' },
        linkedin: { type: String, default: 'https://linkedin.com/company/ifpn' },
        twitter: { type: String, default: '' }
    },
    
    // Contactos
    contactos: {
        email: { type: String, default: 'geral@ifpn.pt' },
        telefone: { type: String, default: '+351 123 456 789' },
        morada: { type: String, default: 'Quinta do Serrado do Pinheiro, Largo do Figueiredo, 6230-045 Aldeia de Joanes, Fundão, Portugal' }
    },
    
    // Informações da Associação
    informacoes_gerais: {
        nome_associacao: { type: String, default: 'IFPN - Instituto Fernando Paulouro Neves' },
        nif: { type: String, default: '519153537' },
        ano_constituicao: { type: Number, default: 2026 },
        valor_quota_anual: { type: Number, default: 50 }
    },
    
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Configuracao', ConfiguracaoSchema);