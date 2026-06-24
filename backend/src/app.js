const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Importar rotas
const authRoutes = require('./routes/auth');
const associadosRoutes = require('./routes/associados');
const quotasRoutes = require('./routes/quotas');
const noticiasRoutes = require('./routes/noticias');
const contactoRoutes = require('./routes/contacto');
const adminRoutes = require('./routes/admin');
const projetosRoutes = require('./routes/projetos');
const eventosRoutes = require('./routes/eventos');
const estatisticasRoutes = require('./routes/estatisticas');
const newsletterRoutes = require('./routes/newsletter');
const configRoutes = require('./routes/configuracoes');
const { iniciarCronQuotasAnuais } = require('./jobs/gerarQuotasJob');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://ifpn-institucional.onrender.com'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB conectado com sucesso');
        iniciarCronQuotasAnuais();
    })
    .catch(err => console.error('❌ Erro ao conectar MongoDB:', err));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/associados', associadosRoutes);
app.use('/api/quotas', quotasRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api', contactoRoutes);
app.use('/api/projetos', projetosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/estatisticas', estatisticasRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/configuracoes', configRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'API IFPN funcionando' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;