const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AssociadoSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    password: {
        type: String,
        required: [true, 'Password é obrigatória'],
        minlength: [6, 'Password deve ter pelo menos 6 caracteres']
    },
    numero_socio: {
        type: String,
        unique: true,
        sparse: true
    },
    nif: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        validate: {
            validator: function(v) {
                // Aceita vazio (campo opcional) ou exatamente 9 dígitos (NIF português)
                return !v || /^\d{9}$/.test(v);
            },
            message: 'NIF deve conter 9 dígitos'
        }
    },
    telefone: {
        type: String,
        trim: true
    },
    morada: {
        rua: String,
        cidade: String,
        codigo_postal: String,
        pais: { type: String, default: 'Portugal' }
    },
    tipo: {
        type: String,
        enum: ['efetivo', 'honorario', 'fundador'],
        default: 'efetivo'
    },
    data_adesao: {
        type: Date,
        default: Date.now
    },
    ativo: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['associado', 'admin'],
        default: 'associado'
    },
    foto_perfil: String,
    ultimo_login: Date,
    notificacoes: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

// Hash da password antes de guardar
AssociadoSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar passwords
AssociadoSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Gerar número de sócio automático (evitar duplicados)
AssociadoSchema.pre('save', async function(next) {
    // Se já tem número de sócio, não gerar novo
    if (this.numero_socio) return next();
    
    try {
        // Encontrar o maior número de sócio atual
        const ultimoAssociado = await mongoose.model('Associado')
            .findOne({ numero_socio: { $regex: /^IFPN-\d{4}-\d{4}$/ } })
            .sort({ numero_socio: -1 });
        
        let novoNumero = 1;
        const ano = new Date().getFullYear();
        
        if (ultimoAssociado && ultimoAssociado.numero_socio) {
            const match = ultimoAssociado.numero_socio.match(/IFPN-\d{4}-(\d{4})/);
            if (match) {
                novoNumero = parseInt(match[1]) + 1;
            }
        }
        
        this.numero_socio = `IFPN-${ano}-${novoNumero.toString().padStart(4, '0')}`;
        next();
        
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Associado', AssociadoSchema);