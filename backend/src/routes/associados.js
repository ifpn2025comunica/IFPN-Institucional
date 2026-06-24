const express = require('express');
const Associado = require('../models/Associado');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Listar associados (apenas admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const associados = await Associado.find()
            .select('-password')
            .sort({ nome: 1 });
        res.json(associados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar associados' });
    }
});

// Buscar associado por ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        // Verificar se é o próprio ou admin
        if (req.params.id !== req.associado._id.toString() && req.associado.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const associado = await Associado.findById(req.params.id).select('-password');
        if (!associado) {
            return res.status(404).json({ error: 'Associado não encontrado' });
        }

        res.json(associado);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar associado' });
    }
});

// Atualizar perfil
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // Verificar se é o próprio ou admin
        if (req.params.id !== req.associado._id.toString() && req.associado.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const updates = ['nome', 'email', 'telefone', 'morada', 'notificacoes'];
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

        if (req.body.novaPassword) {
            // Verificar password atual
            const associado = await Associado.findById(req.params.id);
            const isMatch = await associado.comparePassword(req.body.passwordAtual);
            
            if (!isMatch) {
                return res.status(400).json({ error: 'Password atual incorreta' });
            }
            
            // Atualizar password
            updateData.password = req.body.novaPassword;
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
            message: 'Perfil atualizado com sucesso',
            associado
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// ADMIN: Desativar/ativar associado
router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ativo } = req.body;
        
        const associado = await Associado.findByIdAndUpdate(
            req.params.id,
            { ativo },
            { new: true }
        ).select('-password');

        res.json({
            message: `Associado ${ativo ? 'ativado' : 'desativado'} com sucesso`,
            associado
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao alterar status' });
    }
});

module.exports = router;