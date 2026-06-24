// backend/src/routes/estatisticas.js
const express = require('express');
const router = express.Router();
const Associado = require('../models/Associado');
const Projeto = require('../models/Projeto');
const Noticia = require('../models/Noticia');
const Evento = require('../models/Evento');

// Total de associados ativos
router.get('/associados', async (req, res) => {
    try {
        const total = await Associado.countDocuments({ ativo: true });
        res.json({ total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Total de projetos
router.get('/projetos', async (req, res) => {
    try {
        const total = await Projeto.countDocuments({ visivel: true });
        res.json({ total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Total de publicações (notícias com categoria 'publicacao')
router.get('/noticias', async (req, res) => {
    try {
        const total = await Noticia.countDocuments({ 
            estado: 'publicada'
        });
        res.json({ total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

// Total de eventos por ano
router.get('/eventos', async (req, res) => {
    try {
        const { ano } = req.query;
        const anoAtual = ano || new Date().getFullYear();
        
        const inicio = new Date(parseInt(anoAtual), 0, 1);
        const fim = new Date(parseInt(anoAtual), 11, 31);
        
        const total = await Evento.countDocuments({
            data_inicio: { $gte: inicio, $lte: fim },
            visivel: true
        });
        
        res.json({ total, ano: parseInt(anoAtual) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/tudo', async (req, res) => {
    try {
        const ano = new Date().getFullYear();
        const inicio = new Date(ano, 0, 1);
        const fim = new Date(ano, 11, 31);
        
        const [associados, projetos, noticias, eventos] = await Promise.all([
            Associado.countDocuments({ ativo: true }),
            Projeto.countDocuments({ visivel: true }),
            Noticia.countDocuments({ estado: 'publicada' }),  
            Evento.countDocuments({ data_inicio: { $gte: inicio, $lte: fim }, visivel: true })
        ]);
        
        res.json({
            associados,
            projetos,
            noticias,       
            eventos_ano: eventos
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;