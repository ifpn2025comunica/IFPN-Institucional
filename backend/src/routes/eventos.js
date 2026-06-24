const express = require('express');
const router = express.Router();
const Evento = require('../models/Evento');
const Projeto = require('../models/Projeto');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============= PÚBLICAS =============
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 9, tipo } = req.query;
        let query = { visivel: true };
        if(tipo && tipo !== 'todos') query.tipo = tipo;
        const eventos = await Evento.find(query).populate('projeto_id', 'titulo').sort({ data_inicio: 1 }).limit(parseInt(limit)).skip((parseInt(page)-1)*parseInt(limit));
        const total = await Evento.countDocuments(query);
        res.json({ eventos, paginacao: { pagina: parseInt(page), totalPaginas: Math.ceil(total/parseInt(limit)), totalRegistos: total } });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/calendario', async (req, res) => {
    try {
        const { ano, mes } = req.query;
        const inicio = new Date(parseInt(ano), parseInt(mes)-1, 1);
        const fim = new Date(parseInt(ano), parseInt(mes), 0);
        const eventos = await Evento.find({ data_inicio: { $gte: inicio, $lte: fim }, visivel: true }).select('titulo data_inicio local _id');
        res.json(eventos);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const evento = await Evento.findById(req.params.id).populate('projeto_id', 'titulo');
        if(!evento) return res.status(404).json({ error: 'Evento não encontrado' });
        res.json(evento);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/inscrever', authMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findById(req.params.id);
        if(!evento) return res.status(404).json({ error: 'Evento não encontrado' });
        const jaInscrito = evento.inscritos.some(i => i.associado_id.toString() === req.associado._id.toString());
        if(jaInscrito) return res.status(400).json({ error: 'Já está inscrito neste evento' });
        evento.inscritos.push({ associado_id: req.associado._id });
        await evento.save();
        res.json({ message: 'Inscrição realizada com sucesso' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Buscar eventos onde o associado está inscrito
router.get('/meus/inscricoes', authMiddleware, async (req, res) => {
    try {
        const eventos = await Evento.find({
            'inscritos.associado_id': req.associado._id
        }).sort({ data_inicio: 1 });
        
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar inscrição de um evento
router.delete('/:id/cancelar', authMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findById(req.params.id);
        
        if (!evento) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        // Verificar se o associado está inscrito
        const inscricaoIndex = evento.inscritos.findIndex(
            i => i.associado_id.toString() === req.associado._id.toString()
        );
        
        if (inscricaoIndex === -1) {
            return res.status(400).json({ error: 'Você não está inscrito neste evento' });
        }
        
        // Remover a inscrição
        evento.inscritos.splice(inscricaoIndex, 1);
        await evento.save();
        
        res.json({ message: 'Inscrição cancelada com sucesso' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao cancelar inscrição' });
    }
});

// ============= ADMIN =============
router.get('/admin/todos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const eventos = await Evento.find().populate('projeto_id', 'titulo').sort({ data_inicio: -1 });
        res.json(eventos.map(e => ({ ...e.toObject(), projeto_nome: e.projeto_id?.titulo })));
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = new Evento(req.body);
        await evento.save();
        res.status(201).json(evento);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(evento);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Evento.findByIdAndDelete(req.params.id);
        res.json({ message: 'Evento eliminado' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findById(req.params.id);
        if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });
        res.json(evento);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Buscar inscrições de um evento
router.get('/admin/:id/inscritos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findById(req.params.id).populate('inscritos.associado_id', 'nome email numero_socio');
        
        if (!evento) {
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        res.json({
            evento_id: evento._id,
            evento_titulo: evento.titulo,
            total_inscritos: evento.inscritos.length,
            inscritos: evento.inscritos
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;