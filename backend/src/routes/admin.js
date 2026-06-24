const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Associado = require('../models/Associado');
const Quota = require('../models/Quota');
const Noticia = require('../models/Noticia');
const Evento = require('../models/Evento');
const Projeto = require('../models/Projeto');
const mongoose = require('mongoose');

// ============= DASHBOARD =============
router.get('/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Estatísticas gerais
        const totalAssociados = await Associado.countDocuments({ ativo: true });
        const novosAssociadosMes = await Associado.countDocuments({
            data_adesao: { $gte: inicioMes }
        });
        
        // Estatísticas de quotas
        const quotasPendentes = await Quota.countDocuments({
            estado: 'pendente',
            data_vencimento: { $lt: now }
        });
        
        const quotasPagasMes = await Quota.countDocuments({
            estado: 'pago',
            data_pagamento: { $gte: inicioMes }
        });
        
        const valorTotalQuotas = await Quota.aggregate([
            { $match: { estado: 'pago' } },
            { $group: { _id: null, total: { $sum: '$valor' } } }
        ]);
        
        // Total de conteúdos
        const totalNoticias = await Noticia.countDocuments();
        const totalEventos = await Evento.countDocuments({ data_inicio: { $gte: now } });
        const totalProjetos = await Projeto.countDocuments();

        // Quotas por ANO (para gráfico) - quotas são ANUAIS
        const quotasPorAno = await Quota.aggregate([
            {
                $match: {
                    ano: { $gte: 2020 },  // Mostrar desde 2020
                    mes: 0  // Filtrar apenas quotas anuais
                }
            },
            {
                $group: {
                    _id: {
                        ano: '$ano'
                    },
                    pagas: {
                        $sum: { $cond: [{ $eq: ['$estado', 'pago'] }, 1, 0] }
                    },
                    pendentes: {
                        $sum: { $cond: [{ $eq: ['$estado', 'pendente'] }, 1, 0] }
                    },
                    valor_total: { $sum: '$valor' },
                    valor_pago: {
                        $sum: { $cond: [{ $eq: ['$estado', 'pago'] }, '$valor', 0] }
                    }
                }
            },
            { $sort: { '_id.ano': 1 } }
        ]);

        // Últimas atividades
        const ultimasNoticias = await Noticia.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('autor', 'nome');
            
        const ultimosAssociados = await Associado.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('nome email data_adesao');

        res.json({
            estatisticas: {
                associados: {
                    total: totalAssociados,
                    novos_mes: novosAssociadosMes
                },
                quotas: {
                    pendentes: quotasPendentes,
                    pagas_mes: quotasPagasMes,
                    valor_total: valorTotalQuotas[0]?.total || 0
                },
                conteudos: {
                    noticias: totalNoticias,
                    eventos: totalEventos,
                    projetos: totalProjetos
                }
            },
            quotasPorAno,
            ultimasNoticias,
            ultimosAssociados
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
});

// ============= GESTÃO DE ASSOCIADOS =============

// Listar todos associados (com filtros)
router.get('/associados', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, tipo, ativo, ordenar = '-createdAt' } = req.query;
        
        let query = {};
        
        if (search) {
            query.$or = [
                { nome: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { numero_socio: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (tipo) query.tipo = tipo;
        if (ativo !== undefined) query.ativo = ativo === 'true';

        const associados = await Associado.find(query)
            .select('-password')
            .sort(ordenar)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Associado.countDocuments(query);

        // Adicionar estatísticas de quotas para cada associado
        const associadosComQuotas = await Promise.all(associados.map(async (assoc) => {
            const quotas = await Quota.find({ associado_id: assoc._id });
            const quotasPendentes = quotas.filter(q => q.estado === 'pendente').length;
            const quotasPagas = quotas.filter(q => q.estado === 'pago').length;
            
            return {
                ...assoc.toObject(),
                estatisticas_quotas: {
                    total: quotas.length,
                    pagas: quotasPagas,
                    pendentes: quotasPendentes,
                    ultimo_pagamento: quotas
                        .filter(q => q.estado === 'pago')
                        .sort((a, b) => b.data_pagamento - a.data_pagamento)[0]
                }
            };
        }));

        res.json({
            associados: associadosComQuotas,
            paginacao: {
                pagina: parseInt(page),
                totalPaginas: Math.ceil(total / parseInt(limit)),
                totalRegistos: total
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar associados' });
    }
});

// Criar novo associado (admin)
router.post('/associados', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { nome, email, password, telefone, tipo, morada, data_adesao, nif } = req.body;

        // Verificar se email já existe
        const existe = await Associado.findOne({ email });
        if (existe) {
            return res.status(400).json({ error: 'Email já registado' });
        }

        // Verificar se NIF já existe (se fornecido)
        if (nif) {
            const nifExiste = await Associado.findOne({ nif });
            if (nifExiste) {
                return res.status(400).json({ error: 'NIF já registado por outro associado' });
            }
        }

        const associado = new Associado({
            nome,
            email,
            password,
            telefone,
            tipo,
            morada,
            nif,
            data_adesao: data_adesao || new Date()
        });

        await associado.save();

        // Gerar quotas para o ano corrente se for associado efetivo
        if (tipo === 'efetivo') {
            const ano = new Date().getFullYear();
            const valorQuota = 50; // 50€ anuais conforme definido
            await Quota.gerarQuotaAnual(associado._id, ano, valorQuota);
        }

        res.status(201).json({
            message: 'Associado criado com sucesso',
            associado: {
                ...associado.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar associado' });
    }
});

// Editar associado
router.put('/associados/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const updates = ['nome', 'email', 'telefone', 'tipo', 'morada', 'ativo', 'role', 'nif', 'numero_socio'];
        const updateData = {};

        updates.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        // Se alterou email, verificar se já existe
        if (updateData.email) {
            const existe = await Associado.findOne({
                email: updateData.email,
                _id: { $ne: req.params.id }
            });
            if (existe) {
                return res.status(400).json({ error: 'Email já em uso por outro associado' });
            }
        }

        // Se alterou NIF, verificar se já existe noutro associado
        if (updateData.nif) {
            const nifExiste = await Associado.findOne({
                nif: updateData.nif,
                _id: { $ne: req.params.id }
            });
            if (nifExiste) {
                return res.status(400).json({ error: 'NIF já em uso por outro associado' });
            }
        }

        const associado = await Associado.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!associado) {
            return res.status(404).json({ error: 'Associado não encontrado' });
        }

        res.json({
            message: 'Associado atualizado com sucesso',
            associado
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar associado' });
    }
});

// Redefinir password de um associado
router.post('/associados/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { novaPassword } = req.body;
        
        if (!novaPassword || novaPassword.length < 6) {
            return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
        }
        
        const associado = await Associado.findById(req.params.id);
        if (!associado) {
            return res.status(404).json({ error: 'Associado não encontrado' });
        }
        
        // Atualizar password (o middleware pre-save vai fazer o hash automaticamente)
        associado.password = novaPassword;
        await associado.save();
        
        res.json({ message: 'Password redefinida com sucesso' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao redefinir password' });
    }
});

// backend/src/routes/admin.js
router.delete('/associados/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const associado = await Associado.findByIdAndDelete(req.params.id);
        
        if (!associado) {
            return res.status(404).json({ error: 'Associado não encontrado' });
        }
        
        res.json({ message: 'Associado eliminado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao eliminar associado' });
    }
});

// Buscar associado por ID (para edição)
router.get('/associados/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const associado = await Associado.findById(req.params.id).select('-password');
        
        if (!associado) {
            return res.status(404).json({ error: 'Associado não encontrado' });
        }
        
        res.json(associado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar associado' });
    }
});

// ============= GESTÃO DE QUOTAS (ADMIN) =============

// Gerar quotas para todos os associados (anual)
router.post('/quotas/gerar-anuais', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ano, valor } = req.body;
        
        if (!ano || !valor) {
            return res.status(400).json({ error: 'Ano e valor são obrigatórios' });
        }

        const associados = await Associado.find({ 
            ativo: true,
            tipo: { $in: ['efetivo', 'fundador'] }
        });

        let quotasCriadas = 0;
        let quotasIgnoradas = 0;

        for (const associado of associados) {
            // Verificar se já existem quotas para este ano
            const quotasExistentes = await Quota.countDocuments({
                associado_id: associado._id,
                ano
            });

            if (quotasExistentes === 0) {
                await Quota.gerarQuotasAnuais(associado._id, ano, valor);
                quotasCriadas++;
            } else {
                quotasIgnoradas++;
            }
        }

        res.json({
            message: 'Quotas geradas com sucesso',
            resumo: {
                total_associados: associados.length,
                quotas_criadas: quotasCriadas * 12, // 12 meses
                quotas_ignoradas: quotasIgnoradas * 12
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar quotas' });
    }
});

// Relatório de quotas
router.get('/quotas/relatorio', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ano, mes } = req.query;
        
        let matchStage = {};
        if (ano) matchStage.ano = parseInt(ano);
        if (mes) matchStage.mes = parseInt(mes);

        const relatorio = await Quota.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        ano: '$ano',
                        mes: '$mes',
                        estado: '$estado'
                    },
                    count: { $sum: 1 },
                    valor_total: { $sum: '$valor' }
                }
            },
            { $sort: { '_id.ano': -1, '_id.mes': -1 } }
        ]);

        // Associados com quotas em atraso
        const now = new Date();
        const atrasados = await Quota.aggregate([
            { 
                $match: { 
                    estado: 'pendente',
                    data_vencimento: { $lt: now }
                } 
            },
            {
                $group: {
                    _id: '$associado_id',
                    quotas_em_atraso: { $sum: 1 },
                    valor_devido: { $sum: '$valor' },
                    ultimo_vencimento: { $max: '$data_vencimento' }
                }
            },
            {
                $lookup: {
                    from: 'associados',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'associado'
                }
            },
            { $unwind: '$associado' },
            {
                $project: {
                    'associado.nome': 1,
                    'associado.email': 1,
                    'associado.telefone': 1,
                    quotas_em_atraso: 1,
                    valor_devido: 1,
                    ultimo_vencimento: 1
                }
            },
            { $sort: { valor_devido: -1 } }
        ]);

        res.json({
            relatorio,
            atrasados,
            resumo: {
                total_em_atraso: atrasados.length,
                valor_total_devido: atrasados.reduce((sum, a) => sum + a.valor_devido, 0)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// ============= GESTÃO DE NOTÍCIAS (ADMIN) =============

// Listar todas as notícias (admin)
router.get('/noticias', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, estado } = req.query;
        
        let query = {};
        
        if (search) {
            query.$or = [
                { titulo: { $regex: search, $options: 'i' } },
                { conteudo: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (estado) {
            query.estado = estado;
        }
        
        const noticias = await Noticia.find(query)
            .populate('autor', 'nome')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Noticia.countDocuments(query);
        
        res.json({
            noticias,
            paginacao: {
                pagina: parseInt(page),
                totalPaginas: Math.ceil(total / parseInt(limit)),
                totalRegistos: total
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar notícias' });
    }
});

// Criar nova notícia
router.post('/noticias', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const noticia = new Noticia({
            ...req.body,
            autor: req.associado._id
        });
        
        await noticia.save();
        
        res.status(201).json({
            message: 'Notícia criada com sucesso',
            noticia
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar notícia' });
    }
});

// Buscar notícia por ID (admin)
router.get('/noticias/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const noticia = await Noticia.findById(req.params.id);
        
        if (!noticia) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        
        res.json(noticia);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar notícia' });
    }
});

// Atualizar notícia
router.put('/noticias/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const noticia = await Noticia.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!noticia) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        
        res.json({
            message: 'Notícia atualizada com sucesso',
            noticia
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar notícia' });
    }
});

// Eliminar notícia
router.delete('/noticias/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const noticia = await Noticia.findByIdAndDelete(req.params.id);
        
        if (!noticia) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        
        res.json({ message: 'Notícia eliminada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar notícia' });
    }
});

// Alternar destaque
router.patch('/noticias/:id/destaque', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { destaque } = req.body;
        
        const noticia = await Noticia.findByIdAndUpdate(
            req.params.id,
            { destaque },
            { new: true }
        );
        
        res.json({
            message: destaque ? 'Notícia destacada' : 'Destaque removido',
            noticia
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao alterar destaque' });
    }
});

// Eventos CRUD (similar)
router.get('/eventos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const eventos = await Evento.find()
            .populate('organizadores', 'nome')
            .populate('inscritos.associado_id', 'nome email')
            .sort({ data_inicio: 1 });
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar eventos' });
    }
});

router.post('/eventos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = new Evento(req.body);
        await evento.save();
        res.status(201).json(evento);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar evento' });
    }
});

// Projetos CRUD (similar)
router.get('/projetos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projetos = await Projeto.find()
            .populate('responsaveis', 'nome')
            .sort({ createdAt: -1 });
        res.json(projetos);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar projetos' });
    }
});

// ============= COMUNICAÇÕES =============

// Enviar email para associados
router.post('/comunicacoes/email', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { assunto, mensagem, destinatarios } = req.body;
        
        // Aqui integrarias com um serviço de email (nodemailer, sendgrid, etc.)
        // Exemplo de simulação:
        
        let query = {};
        if (destinatarios === 'todos') {
            query = { ativo: true };
        } else if (destinatarios === 'com_quotas_pendentes') {
            // Lógica para quotas pendentes
            const associadosComPendentes = await Quota.distinct('associado_id', {
                estado: 'pendente'
            });
            query = { _id: { $in: associadosComPendentes } };
        }

        const associados = await Associado.find(query).select('email nome');
        
        // Simulação de envio (na prática, usarias um serviço real)
        console.log(`Enviando email para ${associados.length} associados`);
        console.log('Assunto:', assunto);
        console.log('Mensagem:', mensagem);

        res.json({
            message: 'Email enviado com sucesso',
            total_enviados: associados.length,
            destinatarios: associados.map(a => a.email)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao enviar email' });
    }
});

// Newsletter - adicionar emails
router.post('/newsletter/adicionar', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Aqui guardarias numa coleção separada de newsletter
        // Por simplicidade, vamos apenas simular
        
        res.json({ message: 'Email adicionado à newsletter' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar à newsletter' });
    }
});

// ============= EXPORTAÇÃO DE DADOS =============

// Exportar associados para CSV
router.get('/exportar/associados', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const associados = await Associado.find({ ativo: true })
            .select('nome email numero_socio telefone tipo data_adesao');
        
        // Criar cabeçalhos CSV
        const campos = ['nome', 'email', 'numero_socio', 'telefone', 'tipo', 'data_adesao'];
        const cabecalho = campos.join(';') + '\n';
        
        const linhas = associados.map(a => 
            campos.map(c => a[c] ? `"${a[c]}"` : '').join(';')
        ).join('\n');
        
        const csv = cabecalho + linhas;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=associados.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao exportar dados' });
    }
});

// ============= CONFIGURAÇÕES =============

// Guardar configurações (podes criar um modelo Config)
router.get('/configuracoes', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Simulação - depois podes guardar numa coleção
        const configuracoes = {
            nome_associacao: 'Instituto Fernando Paulouro Neves',
            email_contacto: 'geral@ifpn.pt',
            telefone: '+351 123 456 789',
            morada: 'Lisboa, Portugal',
            valor_quota_anual: 50,  // 50€ por ano
            valor_quota_mensal: 0,  // Quotas são anuais, não mensais
            ano_fiscal_inicio: 1, // Janeiro
            moeda: 'EUR'
        };
        
        res.json(configuracoes);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar configurações' });
    }
});

module.exports = router;