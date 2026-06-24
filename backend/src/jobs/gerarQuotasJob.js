const cron = require('node-cron');
const Associado = require('../models/Associado');
const Quota = require('../models/Quota');
const Configuracao = require('../models/Configuracao');

const VALOR_QUOTA_DEFAULT = 50; 

async function executarGeracaoQuotasAnuais(anoOpcional) {
    const ano = anoOpcional || new Date().getFullYear();
    const inicio = Date.now();

    console.log(`\n[CRON-QUOTAS] ▶  A iniciar geração de quotas para o ano ${ano}...`);

    try {
        // Valor da quota — preferir a configuração; fallback para o estatutário
        let valor = VALOR_QUOTA_DEFAULT;
        try {
            const config = await Configuracao.findOne();
            if (config?.informacoes_gerais?.valor_quota_anual) {
                valor = config.informacoes_gerais.valor_quota_anual;
            }
        } catch (e) {
            console.warn('[CRON-QUOTAS] ⚠  Não foi possível ler a configuração — uso valor default 50€');
        }

        // Buscar associados que devem pagar quota
        const associados = await Associado.find({
            ativo: true,
            tipo: { $in: ['efetivo', 'fundador'] }
        }).select('_id nome numero_socio');

        if (!associados.length) {
            console.log('[CRON-QUOTAS] ℹ  Não existem associados elegíveis. Nada para fazer.');
            return { ano, criadas: 0, ignoradas: 0, total: 0 };
        }

        let criadas = 0;
        let ignoradas = 0;
        const erros = [];

        for (const associado of associados) {
            try {
                const jaExiste = await Quota.findOne({
                    associado_id: associado._id,
                    ano,
                    mes: 0
                });
                if (jaExiste) {
                    ignoradas++;
                    continue;
                }

                await Quota.gerarQuotaAnual(associado._id, ano, valor);
                criadas++;
            } catch (e) {
                erros.push({ associado: associado.nome, erro: e.message });
            }
        }

        const dur = ((Date.now() - inicio) / 1000).toFixed(2);
        console.log(`[CRON-QUOTAS] ✔  Concluído em ${dur}s`);
        console.log(`             Ano: ${ano}  ·  Valor: ${valor}€`);
        console.log(`             Associados elegíveis: ${associados.length}`);
        console.log(`             Quotas criadas: ${criadas}`);
        console.log(`             Já existiam (ignoradas): ${ignoradas}`);
        if (erros.length) {
            console.log(`[CRON-QUOTAS] ⚠  Houve ${erros.length} erros:`);
            erros.forEach(e => console.log(`    - ${e.associado}: ${e.erro}`));
        }

        return { ano, valor, criadas, ignoradas, total: associados.length, erros };
    } catch (error) {
        console.error('[CRON-QUOTAS] ✘  Erro fatal:', error);
        throw error;
    }
}


function iniciarCronQuotasAnuais() {
    const expressao = '5 0 1 1 *';
    const opcoes = { timezone: 'Europe/Lisbon' };

    cron.schedule(expressao, async () => {
        try {
            await executarGeracaoQuotasAnuais();
        } catch (e) {
            console.error('[CRON-QUOTAS] Falha não tratada:', e);
        }
    }, opcoes);

}

module.exports = {
    iniciarCronQuotasAnuais,
    executarGeracaoQuotasAnuais
};
