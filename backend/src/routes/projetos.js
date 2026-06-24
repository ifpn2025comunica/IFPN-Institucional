const express = require('express');
const router = express.Router();
const Projeto = require('../models/Projeto');
const Evento = require('../models/Evento');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============= ROTAS PÚBLICAS =============

// Listar projetos (página pública)
router.get('/', async (req, res) => {
    try {
        const { estado, visivel = 'true' } = req.query;
        
        let query = { visivel: true };
        if (estado) query.estado = estado;
        
        const projetos = await Projeto.find(query)
            .populate('responsaveis', 'nome')
            .sort({ createdAt: -1 });
        
        res.json(projetos);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar projetos' });
    }
});

// Buscar projeto por ID com seus eventos
router.get('/:id', async (req, res) => {
    try {
        const projeto = await Projeto.findById(req.params.id)
            .populate('responsaveis', 'nome');
        
        if (!projeto) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        
        // Buscar eventos associados a este projeto
        const eventos = await Evento.find({ 
            projeto_id: projeto._id,
            visivel: true 
        })
        .populate('organizadores', 'nome')
        .sort({ data_inicio: 1 });
        
        res.json({
            projeto,
            eventos
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar projeto' });
    }
});

// Buscar projeto por slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const projeto = await Projeto.findOne({ slug: req.params.slug })
            .populate('responsaveis', 'nome');
        
        if (!projeto) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        
        const eventos = await Evento.find({ 
            projeto_id: projeto._id,
            visivel: true 
        })
        .populate('organizadores', 'nome')
        .sort({ data_inicio: 1 });
        
        res.json({ projeto, eventos });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar projeto' });
    }
});

// ============= ROTAS ADMIN =============

// Listar todos os projetos (admin)
router.get('/admin/todos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projetos = await Projeto.find()
            .populate('responsaveis', 'nome')
            .sort({ createdAt: -1 });
        
        // Contar eventos por projeto
        const projetosComContagem = await Promise.all(projetos.map(async (projeto) => {
            const totalEventos = await Evento.countDocuments({ projeto_id: projeto._id });
            return {
                ...projeto.toObject(),
                totalEventos
            };
        }));
        
        res.json(projetosComContagem);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar projetos' });
    }
});

// Criar projeto
router.post('/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = new Projeto(req.body);
        await projeto.save();
        res.status(201).json(projeto);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar projeto' });
    }
});

// Atualizar projeto
router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = await Projeto.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        res.json(projeto);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar projeto' });
    }
});

// Eliminar projeto (e todos os seus eventos)
router.delete('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Eliminar todos os eventos associados
        await Evento.deleteMany({ projeto_id: req.params.id });
        // Eliminar o projeto
        await Projeto.findByIdAndDelete(req.params.id);
        res.json({ message: 'Projeto e eventos eliminados com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar projeto' });
    }
});

// ============= ADMIN: Buscar projeto por ID =============
router.get('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = await Projeto.findById(req.params.id);
        
        if (!projeto) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        
        res.json(projeto);
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar projeto' });
    }
});

// ============= ROTAS DE EVENTOS (dentro de projetos) =============

// Listar eventos de um projeto
router.get('/:projetoId/eventos', async (req, res) => {
    try {
        const eventos = await Evento.find({ 
            projeto_id: req.params.projetoId,
            visivel: true 
        })
        .populate('organizadores', 'nome')
        .sort({ data_inicio: 1 });
        
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar eventos' });
    }
});

// Criar evento (admin)
router.post('/admin/:projetoId/eventos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = new Evento({
            ...req.body,
            projeto_id: req.params.projetoId
        });
        await evento.save();
        res.status(201).json(evento);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar evento' });
    }
});

// Atualizar evento
router.put('/admin/eventos/:eventoId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const evento = await Evento.findByIdAndUpdate(
            req.params.eventoId,
            req.body,
            { new: true }
        );
        res.json(evento);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar evento' });
    }
});

// Eliminar evento
router.delete('/admin/eventos/:eventoId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Evento.findByIdAndDelete(req.params.eventoId);
        res.json({ message: 'Evento eliminado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar evento' });
    }
});

// ============= ADMIN: Adicionar produto a um projeto =============
router.post('/admin/:projetoId/produtos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = await Projeto.findById(req.params.projetoId);
        if (!projeto) return res.status(404).json({ error: 'Projeto não encontrado' });

        const novoProduto = {
            titulo: req.body.titulo,
            descricao: req.body.descricao || '',
            capa: req.body.capa || '',
            preco: req.body.preco,
            link_compra: req.body.link_compra,
            ordem: projeto.produtos.length
        };
        projeto.produtos.push(novoProduto);
        await projeto.save();

        res.status(201).json({ message: 'Produto adicionado', produto: novoProduto });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= ADMIN: Editar produto =============
router.put('/admin/:projetoId/produtos/:produtoIndex', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = await Projeto.findById(req.params.projetoId);
        if (!projeto) return res.status(404).json({ error: 'Projeto não encontrado' });

        const index = parseInt(req.params.produtoIndex);
        if (index < 0 || index >= projeto.produtos.length) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const produto = projeto.produtos[index];
        produto.titulo = req.body.titulo || produto.titulo;
        produto.descricao = req.body.descricao || produto.descricao;
        produto.capa = req.body.capa || produto.capa;
        produto.preco = req.body.preco !== undefined ? req.body.preco : produto.preco;
        produto.link_compra = req.body.link_compra || produto.link_compra;
        produto.ordem = req.body.ordem !== undefined ? req.body.ordem : produto.ordem;

        await projeto.save();
        res.json({ message: 'Produto atualizado', produto });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= ADMIN: Eliminar produto =============
router.delete('/admin/:projetoId/produtos/:produtoIndex', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projeto = await Projeto.findById(req.params.projetoId);
        if (!projeto) return res.status(404).json({ error: 'Projeto não encontrado' });

        const index = parseInt(req.params.produtoIndex);
        projeto.produtos.splice(index, 1);
        // Reordenar
        projeto.produtos.forEach((p, i) => p.ordem = i);

        await projeto.save();
        res.json({ message: 'Produto removido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;