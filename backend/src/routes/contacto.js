const express = require('express');
const router = express.Router();
const Contacto = require('../models/Contacto');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============= ROTA PÚBLICA =============

// Enviar mensagem (público)
router.post('/contacto', async (req, res) => {
    try {
        const { nome, email, telefone, assunto, mensagem } = req.body;

        // Validar
        if (!nome || !email || !mensagem) {
            return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
        }

        // Guardar na BD
        const novoContacto = new Contacto({
            nome,
            email,
            telefone,
            assunto,
            mensagem,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        await novoContacto.save();

        res.status(201).json({ 
            message: 'Mensagem enviada com sucesso! Entraremos em contacto brevemente.' 
        });

    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// ============= ROTAS ADMIN =============

// Listar todas as mensagens (admin)
router.get('/admin/contacto', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        
        let query = {};
        
        if (status && status !== 'todos') {
            query.status = status;
        }
        
        if (search) {
            query.$text = { $search: search };
        }
        
        const mensagens = await Contacto.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Contacto.countDocuments(query);
        
        // Estatísticas
        const estatisticas = {
            total: await Contacto.countDocuments(),
            nao_lidas: await Contacto.countDocuments({ status: 'nao_lida' }),
            lidas: await Contacto.countDocuments({ status: 'lida' }),
            respondidas: await Contacto.countDocuments({ status: 'respondida' }),
            arquivadas: await Contacto.countDocuments({ status: 'arquivada' })
        };
        
        res.json({
            mensagens,
            estatisticas,
            paginacao: {
                pagina: parseInt(page),
                totalPaginas: Math.ceil(total / parseInt(limit)),
                totalRegistos: total
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar mensagens' });
    }
});

// Buscar mensagem por ID
router.get('/admin/contacto/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const mensagem = await Contacto.findById(req.params.id);
        
        if (!mensagem) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }
        
        // Marcar como lida se ainda não foi
        if (mensagem.status === 'nao_lida') {
            mensagem.status = 'lida';
            mensagem.lida_em = new Date();
            await mensagem.save();
        }
        
        res.json(mensagem);
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mensagem' });
    }
});

// Marcar como respondida
router.put('/admin/contacto/:id/responder', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { resposta } = req.body;
        
        const mensagem = await Contacto.findByIdAndUpdate(
            req.params.id,
            {
                status: 'respondida',
                respondida_em: new Date(),
                'resposta.texto': resposta,
                'resposta.enviada_por': req.associado._id
            },
            { new: true }
        );
        
        res.json({ message: 'Mensagem marcada como respondida', mensagem });
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

// Mudar status da mensagem
router.patch('/admin/contacto/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        
        const update = { status };
        if (status === 'lida') update.lida_em = new Date();
        if (status === 'respondida') update.respondida_em = new Date();
        
        const mensagem = await Contacto.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        );
        
        res.json({ message: 'Status atualizado', mensagem });
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Eliminar mensagem
router.delete('/admin/contacto/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Contacto.findByIdAndDelete(req.params.id);
        res.json({ message: 'Mensagem eliminada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar mensagem' });
    }
});

module.exports = router;