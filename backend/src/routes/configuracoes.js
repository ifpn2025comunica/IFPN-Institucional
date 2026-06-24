const express = require('express');
const router = express.Router();
const Configuracao = require('../models/Configuracao');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============= PÚBLICAS (só leitura) =============
router.get('/', async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        
        if (!config) {
            // Criar configuração padrão
            config = new Configuracao();
            await config.save();
        }
        
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar configurações' });
    }
});

// ============= ADMIN (ler e editar) =============
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        
        if (!config) {
            config = new Configuracao();
            await config.save();
        }
        
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar configurações' });
    }
});

router.put('/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        
        if (!config) {
            config = new Configuracao();
        }
        
        // Atualizar campos
        if (req.body.transmissao_ao_vivo) {
            config.transmissao_ao_vivo = req.body.transmissao_ao_vivo;
        }
        
        if (req.body.videos_arquivo) {
            config.videos_arquivo = req.body.videos_arquivo;
        }
        
        if (req.body.redes_sociais) {
            config.redes_sociais = req.body.redes_sociais;
        }
        
        if (req.body.contactos) {
            config.contactos = req.body.contactos;
        }
        
        if (req.body.informacoes_gerais) {
            config.informacoes_gerais = req.body.informacoes_gerais;
        }
        
        config.updated_by = req.associado._id;
        await config.save();
        
        res.json({ message: 'Configurações atualizadas com sucesso', config });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// ============= ADMIN: Vídeos (CRUD individual) =============
router.post('/admin/videos', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        if (!config) config = new Configuracao();
        
        const novoVideo = {
            ...req.body,
            ordem: config.videos_arquivo.length
        };
        
        config.videos_arquivo.push(novoVideo);
        await config.save();
        
        res.status(201).json({ message: 'Vídeo adicionado', video: novoVideo });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar vídeo' });
    }
});

router.put('/admin/videos/:index', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        if (!config) return res.status(404).json({ error: 'Configurações não encontradas' });
        
        const index = parseInt(req.params.index);
        if (index >= 0 && index < config.videos_arquivo.length) {
            config.videos_arquivo[index] = { ...config.videos_arquivo[index], ...req.body };
            await config.save();
            res.json({ message: 'Vídeo atualizado' });
        } else {
            res.status(404).json({ error: 'Vídeo não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar vídeo' });
    }
});

router.delete('/admin/videos/:index', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let config = await Configuracao.findOne();
        if (!config) return res.status(404).json({ error: 'Configurações não encontradas' });
        
        const index = parseInt(req.params.index);
        config.videos_arquivo.splice(index, 1);
        
        // Reordenar
        config.videos_arquivo.forEach((v, i) => v.ordem = i);
        
        await config.save();
        res.json({ message: 'Vídeo removido' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover vídeo' });
    }
});

module.exports = router;