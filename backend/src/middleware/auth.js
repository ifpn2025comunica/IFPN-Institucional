const jwt = require('jsonwebtoken');
const Associado = require('../models/Associado');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const associado = await Associado.findById(decoded.id).select('-password');

        if (!associado) {
            return res.status(401).json({ error: 'Associado não encontrado.' });
        }

        if (!associado.ativo) {
            return res.status(403).json({ error: 'Conta desativada.' });
        }

        req.associado = associado;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado.' });
        }
        res.status(500).json({ error: 'Erro na autenticação.' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.associado.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };