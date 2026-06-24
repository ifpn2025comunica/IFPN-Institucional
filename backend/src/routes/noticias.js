const express = require('express');
const router = express.Router();
const Noticia = require('../models/Noticia');

// ============= PÁGINA PÚBLICA =============

// Listar notícias (com paginação e filtros)
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 9, search, categoria, destaque } = req.query;
        
        let query = { estado: 'publicada' };
        
        if (search) {
            query.$text = { $search: search };
        }
        
        if (categoria) {
            query.categorias = categoria;
        }
        
        if (destaque === 'true') {
            query.destaque = true;
        }
        
        const noticias = await Noticia.find(query)
            .populate('autor', 'nome')
            .sort({ data_publicacao: -1 })
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
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar notícias' });
    }
});

// Buscar notícia por ID (para detalhes)
router.get('/:id', async (req, res) => {
    try {
        const noticia = await Noticia.findById(req.params.id)
            .populate('autor', 'nome email');
        
        if (!noticia) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        
        // Incrementar visualizações
        noticia.visualizacoes += 1;
        await noticia.save();
        
        res.json(noticia);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar notícia' });
    }
});

// Buscar notícias em destaque
router.get('/destaques/lista', async (req, res) => {
    try {
        const destaques = await Noticia.find({ 
            estado: 'publicada', 
            destaque: true 
        })
        .populate('autor', 'nome')
        .sort({ data_publicacao: -1 })
        .limit(3);
        
        res.json(destaques);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar destaques' });
    }
});

module.exports = router;