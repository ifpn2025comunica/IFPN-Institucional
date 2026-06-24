const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Associado = require('../models/Associado');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Registro de associado
router.post('/registar', [
    body('nome').notEmpty().withMessage('Nome obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Password deve ter 6+ caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nome, email, password, telefone, morada, nif } = req.body;

        // Verificar se email já existe
        const existeAssociado = await Associado.findOne({ email });
        if (existeAssociado) {
            return res.status(400).json({ error: 'Email já registado' });
        }

        // Verificar se NIF já existe (se fornecido)
        if (nif) {
            const nifExiste = await Associado.findOne({ nif });
            if (nifExiste) {
                return res.status(400).json({ error: 'NIF já registado' });
            }
        }

        // Criar associado
        const associado = new Associado({
            nome,
            email,
            password,
            telefone,
            morada,
            nif
        });

        await associado.save();

        // Gerar token
        const token = jwt.sign(
            { id: associado._id, role: associado.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(201).json({
            message: 'Associado registado com sucesso',
            token,
            associado: {
                id: associado._id,
                nome: associado.nome,
                email: associado.email,
                numero_socio: associado.numero_socio,
                role: associado.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registar associado' });
    }
});

// Login
router.post('/login', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Password obrigatória')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Verificar associado
        const associado = await Associado.findOne({ email });
        if (!associado) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Verificar password
        const isMatch = await associado.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Verificar se está ativo
        if (!associado.ativo) {
            return res.status(403).json({ error: 'Conta desativada. Contacte a direção.' });
        }

        // Atualizar último login
        associado.ultimo_login = new Date();
        await associado.save();

        // Gerar token
        const token = jwt.sign(
            { id: associado._id, role: associado.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            message: 'Login realizado com sucesso',
            token,
            associado: {
                id: associado._id,
                nome: associado.nome,
                email: associado.email,
                numero_socio: associado.numero_socio,
                role: associado.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Perfil do associado logado
router.get('/perfil', authMiddleware, async (req, res) => {
    try {
        res.json({
            associado: req.associado
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// ============= ALTERAR PASSWORD (utilizador logado) =============
router.post('/alterar-password', authMiddleware, async (req, res) => {
    try {
        const { password_atual, nova_password } = req.body;
        
        
        if (!password_atual || !nova_password) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }
        
        if (nova_password.length < 6) {
            return res.status(400).json({ error: 'A nova password deve ter pelo menos 6 caracteres' });
        }
        
        const associado = await Associado.findById(req.associado._id);
        
        // Verificar password atual
        const isMatch = await associado.comparePassword(password_atual);
        if (!isMatch) {
            return res.status(401).json({ error: 'Password atual incorreta' });
        }
        
        associado.password = nova_password;
        await associado.save();
        
        
        res.json({ message: 'Password alterada com sucesso!' });
        
    } catch (error) {
        res.status(500).json({ error: 'Erro ao alterar password' });
    }
});

// ============= ATUALIZAR PERFIL (sem password) =============
router.put('/atualizar-perfil', authMiddleware, async (req, res) => {
    try {
        const { nome, email, telefone, morada, nif } = req.body;

        const associado = await Associado.findById(req.associado._id);

        // Se enviou NIF e é diferente do atual, verificar duplicados
        if (nif && nif !== associado.nif) {
            const nifExiste = await Associado.findOne({
                nif,
                _id: { $ne: associado._id }
            });
            if (nifExiste) {
                return res.status(400).json({ error: 'NIF já em uso por outro associado' });
            }
        }

        if (nome) associado.nome = nome;
        if (email) associado.email = email;
        if (telefone) associado.telefone = telefone;
        if (morada) associado.morada = morada;
        if (nif !== undefined) associado.nif = nif;

        await associado.save();
        
        const associadoSemPassword = associado.toObject();
        delete associadoSemPassword.password;
        
        res.json({
            message: 'Perfil atualizado com sucesso!',
            associado: associadoSemPassword
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Logout (apenas para frontend - token é removido no cliente)
router.post('/logout', authMiddleware, (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;