// Configuração da API
const API_URL = 'https://ifpn-public.onrender.com/api';

// Função genérica para chamadas API
async function apiRequest(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (requiresAuth) {
        const token = localStorage.getItem('token');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Erro na requisição');
        }

        return responseData;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth
async function login(email, password) {
    return apiRequest('/auth/login', 'POST', { email, password }, false);
}

async function registar(dados) {
    return apiRequest('/auth/registar', 'POST', dados, false);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('associado');
    window.location.href = '/';
}

// Quotas
async function getMinhasQuotas() {
    return apiRequest('/quotas/minhas');
}

async function getHistoricoQuotas(ano = '', estado = '') {
    let url = '/quotas/historico';
    const params = new URLSearchParams();
    if (ano) params.append('ano', ano);
    if (estado) params.append('estado', estado);
    if (params.toString()) url += '?' + params.toString();
    
    return apiRequest(url);
}

async function simularPagamento(quotaId, metodo) {
    return apiRequest(`/quotas/simular-pagamento/${quotaId}`, 'POST', { metodo_pagamento: metodo });
}

// Associados
async function getPerfil() {
    return apiRequest('/auth/perfil');
}

async function atualizarPerfil(id, dados) {
    return apiRequest(`/associados/${id}`, 'PUT', dados);
}

// Utilitários
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function getAssociado() {
    const associado = localStorage.getItem('associado');
    return associado ? JSON.parse(associado) : null;
}