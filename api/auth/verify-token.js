// Vercel Serverless Function — proxy autenticado para aluno.helloyotta.com
// Adiciona QUBIT_API_KEY server-side, evitando CORS e exposição da chave no browser.
import https from 'https';
import http from 'http';

/** Lê o body cru do request e faz o parse como JSON. */
function readBody(req) {
    return new Promise((resolve, reject) => {
        // Vercel já parseia quando Content-Type: application/json, mas lemos o stream como fallback.
        if (req.body !== undefined) {
            resolve(req.body);
            return;
        }
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

/** Faz uma requisição HTTPS e retorna { status, body }. */
function httpsPost(urlStr, headers, bodyObj) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(urlStr);
        const payload = JSON.stringify(bodyObj);
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(payload),
            },
        };
        const reqOut = lib.request(options, resIn => {
            let data = '';
            resIn.on('data', c => { data += c; });
            resIn.on('end', () => {
                try { resolve({ status: resIn.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: resIn.statusCode, body: {} }); }
            });
        });
        reqOut.on('error', reject);
        reqOut.write(payload);
        reqOut.end();
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const verifyUrl = process.env.HELLOYOTTA_VERIFY_URL ||
        'https://aluno.helloyotta.com/api/auth/verify-token';
    const apiKey = process.env.QUBIT_API_KEY;

    if (!apiKey) {
        console.error('[verify-token] QUBIT_API_KEY não configurado');
        return res.status(503).json({ ok: false, error: 'Serviço indisponível (config).' });
    }

    let body;
    try {
        body = await readBody(req);
    } catch (err) {
        console.error('[verify-token] Erro ao ler body:', err);
        return res.status(400).json({ ok: false, error: 'Bad request.' });
    }

    console.log('[verify-token] Encaminhando para:', verifyUrl, '| token presente:', !!body.token);

    try {
        const { status, body: data } = await httpsPost(verifyUrl, {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        }, body);

        console.log('[verify-token] Resposta upstream:', status, JSON.stringify(data));
        return res.status(status).json(data);
    } catch (err) {
        console.error('[verify-token] Erro na chamada upstream:', err.message);
        return res.status(503).json({ ok: false, error: 'Serviço indisponível (upstream).' });
    }
}
