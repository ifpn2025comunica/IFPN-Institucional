const express = require('express');
const Quota = require('../models/Quota');
const Associado = require('../models/Associado');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { executarGeracaoQuotasAnuais } = require('../jobs/gerarQuotasJob');

const router = express.Router();

router.post('/admin/cron/gerar-anuais', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ano } = req.body;
        const resultado = await executarGeracaoQuotasAnuais(
            ano ? parseInt(ano) : undefined
        );
        res.json({
            message: 'Geração de quotas executada com sucesso',
            ...resultado
        });
    } catch (error) {
        console.error('Erro ao executar cron manualmente:', error);
        res.status(500).json({ error: 'Erro ao executar geração de quotas' });
    }
});

// Minhas quotas (associado logado)
router.get('/minhas', authMiddleware, async (req, res) => {
    try {
        const quotas = await Quota.find({ associado_id: req.associado._id })
            .sort({ ano: -1 });

        // Estatísticas para quotas ANUAIS
        const estatisticas = {
            total: quotas.length,
            pagas: quotas.filter(q => q.estado === 'pago').length,
            pendentes: quotas.filter(q => q.estado === 'pendente').length,
            valor_total_pago: quotas
                .filter(q => q.estado === 'pago')
                .reduce((sum, q) => sum + q.valor, 0),
            valor_pendente: quotas
                .filter(q => q.estado === 'pendente')
                .reduce((sum, q) => sum + q.valor, 0),
            ultima_quota_paga: quotas
                .filter(q => q.estado === 'pago')
                .sort((a, b) => b.data_pagamento - a.data_pagamento)[0],
            proxima_quota: quotas
                .filter(q => q.estado === 'pendente')
                .sort((a, b) => a.data_vencimento - b.data_vencimento)[0],
            por_ano: quotas.reduce((acc, q) => {
                if (!acc[q.ano]) {
                    acc[q.ano] = { ano: q.ano, estado: q.estado, valor: q.valor };
                }
                return acc;
            }, {})
        };

        res.json({ quotas, estatisticas });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar quotas' });
    }
});

// Histórico detalhado
router.get('/historico', authMiddleware, async (req, res) => {
    try {
        const { ano } = req.query;
        let query = { associado_id: req.associado._id };
        
        if (ano) {
            query.ano = parseInt(ano);
        }

        const historico = await Quota.find(query)
            .sort({ ano: -1, mes: -1 });

        // Agrupar por ano
        const porAno = historico.reduce((acc, quota) => {
            if (!acc[quota.ano]) {
                acc[quota.ano] = {
                    ano: quota.ano,
                    quotas: [],
                    total_pago: 0,
                    total_pendente: 0
                };
            }
            acc[quota.ano].quotas.push(quota);
            if (quota.estado === 'pago') {
                acc[quota.ano].total_pago += quota.valor;
            } else {
                acc[quota.ano].total_pendente += quota.valor;
            }
            return acc;
        }, {});

        res.json({
            historico: Object.values(porAno),
            total_registos: historico.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// ============= ADMIN: SPECIFIC ROUTES (must come BEFORE generic /:quotaId) =============

// ADMIN: Listar todas quotas com filtros
router.get('/admin/todas', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { estado, ano, mes, associado_id } = req.query;
        let query = {};

        if (estado) query.estado = estado;
        if (ano) query.ano = parseInt(ano);
        if (mes) query.mes = parseInt(mes);
        if (associado_id) query.associado_id = associado_id;

        const quotas = await Quota.find(query)
            .populate({
                path: 'associado_id',
                select: 'nome email numero_socio',
                strictPopulate: false
            })
            .sort({ ano: -1, mes: -1 });

        res.json(quotas);
    } catch (error) {
        console.error('Erro ao listar quotas:', error);
        res.status(500).json({ error: 'Erro ao listar quotas', details: error.message });
    }
});

// ADMIN: Gerar quotas ANUAIS para todos os associados
router.post('/admin/gerar-anuais', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ano, valor } = req.body;

        if (!ano || !valor) {
            return res.status(400).json({ error: 'Ano e valor são obrigatórios' });
        }

        const associados = await Associado.find({
            ativo: true,
            tipo: 'efetivo'
        });

        let quotasCriadas = 0;
        let quotasIgnoradas = 0;

        for (const associado of associados) {
            // Verificar se já existe quota para este ano
            const quotaExistente = await Quota.findOne({
                associado_id: associado._id,
                ano: parseInt(ano),
                tipo: 'anual'  // ← Verificar quota anual
            });

            if (!quotaExistente) {
                await Quota.gerarQuotaAnual(associado._id, parseInt(ano), parseFloat(valor));
                quotasCriadas++;
            } else {
                quotasIgnoradas++;
            }
        }

        res.json({
            message: `Quotas anuais geradas com sucesso`,
            resumo: {
                total_associados: associados.length,
                quotas_criadas: quotasCriadas,
                quotas_ignoradas: quotasIgnoradas
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar quotas' });
    }
});

// ============= ADMIN: Registrar pagamento em lote (várias quotas de uma vez) =============
router.post('/admin/pagamento-lote', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { quotasIds, metodo_pagamento, referencia_pagamento } = req.body;

        if (!quotasIds || quotasIds.length === 0) {
            return res.status(400).json({ error: 'Nenhuma quota selecionada' });
        }

        const resultados = [];

        for (const quotaId of quotasIds) {
            const quota = await Quota.findById(quotaId);

            if (quota && quota.estado !== 'pago') {
                quota.estado = 'pago';
                quota.data_pagamento = new Date();
                quota.metodo_pagamento = metodo_pagamento || 'transferencia';
                quota.referencia_pagamento = referencia_pagamento || `LOTE-${Date.now()}`;
                quota.processado_por = req.associado._id;
                await quota.save();
                resultados.push({ id: quotaId, sucesso: true });
            } else {
                resultados.push({ id: quotaId, sucesso: false, motivo: 'Já paga ou não encontrada' });
            }
        }

        res.json({
            message: `${resultados.filter(r => r.sucesso).length} quotas pagas com sucesso!`,
            resultados
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao processar pagamento em lote' });
    }
});

// ============= ADMIN: Listar quotas pendentes de um associado =============
router.get('/admin/associado/:associadoId/quotas-pendentes', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const quotas = await Quota.find({
            associado_id: req.params.associadoId,
            estado: 'pendente'
        }).sort({ ano: 1, mes: 1 });

        res.json(quotas);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar quotas pendentes' });
    }
});

// ADMIN: Buscar quotas de um associado específico
router.get('/admin/associado/:associadoId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const quotas = await Quota.find({ associado_id: req.params.associadoId })
            .sort({ ano: -1, mes: -1 });

        const estatisticas = {
            total: quotas.length,
            pagas: quotas.filter(q => q.estado === 'pago').length,
            pendentes: quotas.filter(q => q.estado === 'pendente').length,
            valor_pendente: quotas
                .filter(q => q.estado === 'pendente')
                .reduce((sum, q) => sum + q.valor, 0)
        };

        res.json({ quotas, estatisticas });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar quotas' });
    }
});

// ============= ADMIN: GENERIC ROUTES (must come AFTER specific ones) =============

// ============= ADMIN: Registar pagamento de quota =============
router.post('/admin/:quotaId/pagar', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { metodo_pagamento, referencia_pagamento, observacoes } = req.body;

        const quota = await Quota.findById(req.params.quotaId);

        if (!quota) {
            return res.status(404).json({ error: 'Quota não encontrada' });
        }

        if (quota.estado === 'pago') {
            return res.status(400).json({ error: 'Esta quota já foi paga' });
        }

        // Registrar pagamento
        quota.estado = 'pago';
        quota.data_pagamento = new Date();
        quota.metodo_pagamento = metodo_pagamento || 'transferencia';
        quota.referencia_pagamento = referencia_pagamento || `PAG-${Date.now()}`;
        quota.observacoes = observacoes || '';
        quota.processado_por = req.associado._id;

        await quota.save();

        // Buscar dados do associado para resposta
        const associado = await Associado.findById(quota.associado_id).select('nome email');

        res.json({
            message: 'Pagamento registado com sucesso!',
            quota,
            associado: associado
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registar pagamento' });
    }
});

// ============= ADMIN: Criar nova quota manualmente =============
router.post('/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { associado_id, ano, valor, data_vencimento, estado, observacoes } = req.body;

        if (!associado_id || !ano || !valor || !data_vencimento) {
            return res.status(400).json({ error: 'Campos obrigatórios: associado_id, ano, valor, data_vencimento' });
        }

        const quota = new Quota({
            associado_id,
            ano: parseInt(ano),
            mes: 0,  // Quota anual
            valor: parseFloat(valor),
            data_vencimento: new Date(data_vencimento),
            estado: estado || 'pendente',
            observacoes: observacoes || '',
            processado_por: req.associado._id
        });

        await quota.save();

        const quotaPopulated = await quota.populate({
            path: 'associado_id',
            select: 'nome email numero_socio',
            strictPopulate: false
        });

        res.status(201).json({
            message: 'Quota criada com sucesso',
            quota: quotaPopulated
        });
    } catch (error) {
        console.error('Erro ao criar quota:', error);
        res.status(500).json({ error: 'Erro ao criar quota', details: error.message });
    }
});

// ADMIN: Obter quota específica
router.get('/admin/:quotaId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const quota = await Quota.findById(req.params.quotaId)
            .populate({
                path: 'associado_id',
                select: 'nome email numero_socio',
                strictPopulate: false
            })
            .populate({
                path: 'processado_por',
                select: 'nome',
                strictPopulate: false
            });

        if (!quota) {
            return res.status(404).json({ error: 'Quota não encontrada' });
        }

        res.json(quota);
    } catch (error) {
        console.error('Erro ao obter quota:', error);
        res.status(500).json({ error: 'Erro ao obter quota', details: error.message });
    }
});

// ADMIN: Atualizar quota
router.put('/admin/:quotaId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { estado, data_pagamento, data_vencimento, valor, observacoes } = req.body;

        const quota = await Quota.findById(req.params.quotaId);
        if (!quota) {
            return res.status(404).json({ error: 'Quota não encontrada' });
        }

        // Atualizar campos
        if (estado) {
            quota.estado = estado;
            if (estado === 'pago' && !quota.data_pagamento) {
                quota.data_pagamento = data_pagamento || new Date();
            }
        }
        if (data_pagamento) quota.data_pagamento = new Date(data_pagamento);
        if (data_vencimento) quota.data_vencimento = new Date(data_vencimento);
        if (valor) quota.valor = parseFloat(valor);
        if (observacoes !== undefined) quota.observacoes = observacoes;

        await quota.save();

        const quotaPopulated = await quota.populate({
            path: 'associado_id',
            select: 'nome email numero_socio',
            strictPopulate: false
        });

        res.json({
            message: 'Quota atualizada com sucesso',
            quota: quotaPopulated
        });
    } catch (error) {
        console.error('Erro ao atualizar quota:', error);
        res.status(500).json({ error: 'Erro ao atualizar quota', details: error.message });
    }
});

// ADMIN: Apagar quota
router.delete('/admin/:quotaId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const quota = await Quota.findById(req.params.quotaId);

        if (!quota) {
            return res.status(404).json({ error: 'Quota não encontrada' });
        }

        await Quota.findByIdAndDelete(req.params.quotaId);

        res.json({ message: 'Quota eliminada com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao eliminar quota' });
    }
});

module.exports = router;