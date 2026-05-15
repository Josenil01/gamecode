// Vercel Serverless Function — proxy autenticado para aluno.helloyotta.com
// Adiciona QUBIT_API_KEY server-side, evitando CORS e exposição da chave no browser.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const verifyUrl = process.env.HELLOYOTTA_VERIFY_URL ||
        'https://aluno.helloyotta.com/api/auth/verify-token';
    const apiKey = process.env.QUBIT_API_KEY;

    if (!apiKey) {
        console.error('QUBIT_API_KEY não configurado no ambiente Vercel');
        return res.status(503).json({ ok: false, error: 'Serviço indisponível.' });
    }

    try {
        const upstream = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(req.body),
        });

        const data = await upstream.json();
        return res.status(upstream.status).json(data);
    } catch (err) {
        console.error('Erro ao verificar token com helloyotta:', err);
        return res.status(503).json({ ok: false, error: 'Serviço indisponível.' });
    }
}
