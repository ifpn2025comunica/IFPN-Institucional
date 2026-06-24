const mongoose = require('mongoose');

const QuotaSchema = new mongoose.Schema({
    associado_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado',
        required: true
    },
    ano: {
        type: Number,
        required: true,
        min: 2020,
        max: 2100
    },
    mes: {
        type: Number,
        required: true,
        min: 0,
        max: 12
    },
    valor: {
        type: Number,
        required: true,
        min: 0
    },
    estado: {
        type: String,
        enum: ['pago', 'pendente', 'isento', 'cancelado'],
        default: 'pendente'
    },
    data_vencimento: {
        type: Date,
        required: true
    },
    data_pagamento: Date,
    metodo_pagamento: {
        type: String,
        enum: ['dinheiro', 'transferencia', 'mbway', 'multibanco', 'cheque']
    },
    referencia_pagamento: String,
    observacoes: String,
    comprovativo_url: String,
    processado_por: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Associado'
    }
}, {
    timestamps: true
});

// Índices para performance
QuotaSchema.index({ associado_id: 1, ano: 1, mes: 1 }, { unique: true });
QuotaSchema.index({ estado: 1, data_vencimento: 1 });
QuotaSchema.index({ ano: 1, mes: 1 });

// Método estático para gerar quotas de um ano
QuotaSchema.statics.gerarQuotaAnual = async function(associado_id, ano, valor) {
    const quota = {
        associado_id,
        ano,
        mes: 0,  // 0 representa quota anual (ou podes criar campo 'tipo')
        valor,
        estado: 'pendente',
        data_vencimento: new Date(ano, 0, 31) // 31 de Janeiro de cada ano
    };

    return await this.create(quota);
};

module.exports = mongoose.model('Quota', QuotaSchema);