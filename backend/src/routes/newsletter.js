const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============= PÚBLICO =============
router.post('/subscribe', async (req, res) => {
    try {
        const { email, nome, categorias } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }
        
        // Verificar se já existe
        let subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
        
        if (subscriber) {
            // Atualizar existente
            subscriber.categorias = categorias.includes('todos') ? ['todos'] : categorias;
            subscriber.nome = nome || subscriber.nome;
            await subscriber.save();
            return res.json({ message: 'Preferências atualizadas com sucesso!' });
        }
        
        // Criar novo
        subscriber = new Newsletter({
            email: email.toLowerCase(),
            nome: nome,
            categorias: categorias.includes('todos') ? ['todos'] : categorias
        });
        await subscriber.save();
        
        res.status(201).json({ message: 'Inscrição realizada com sucesso!' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao subscrever' });
    }
});

// Cancelar por email (via formulário)
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }
        
        const result = await Newsletter.findOneAndDelete({ email: email.toLowerCase() });
        
        if (result) {
            res.json({ message: 'Subscrição cancelada com sucesso!' });
        } else {
            res.status(404).json({ error: 'Email não encontrado na nossa lista' });
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao cancelar subscrição' });
    }
});

// ============= ADMIN =============

// Listar todos os subscritores
router.get('/admin/subscribers', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { categoria, search } = req.query;
        
        let query = {};
        
        if (categoria && categoria !== 'todos') {
            query.categorias = { $in: [categoria, 'todos'] };
        }
        
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { nome: { $regex: search, $options: 'i' } }
            ];
        }
        
        const subscribers = await Newsletter.find(query).sort({ data_subscricao: -1 });
        
        // Estatísticas
        const estatisticas = {
            total: await Newsletter.countDocuments(),
            por_categoria: {
                projetos: await Newsletter.countDocuments({ categorias: { $in: ['projetos', 'todos'] } }),
                eventos: await Newsletter.countDocuments({ categorias: { $in: ['eventos', 'todos'] } }),
                noticias: await Newsletter.countDocuments({ categorias: { $in: ['noticias', 'todos'] } }),
                todos: await Newsletter.countDocuments({ categorias: 'todos' })
            }
        };
        
        res.json({ subscribers, estatisticas });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar subscritores' });
    }
});

// Exportar emails para CSV
router.get('/admin/exportar', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { categoria } = req.query;
        
        let query = {};
        if (categoria && categoria !== 'todos') {
            query.categorias = { $in: [categoria, 'todos'] };
        }
        
        const subscribers = await Newsletter.find(query).select('email nome categorias');
        
        // Criar CSV apenas com emails
        let csv = 'Email;Nome;Categorias\n';
        subscribers.forEach(s => {
            csv += `${s.email};${s.nome || ''};${s.categorias.join(', ')}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=newsletter_${categoria || 'todos'}.csv`);
        res.send('\uFEFF' + csv);
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao exportar' });
    }
});

module.exports = router;