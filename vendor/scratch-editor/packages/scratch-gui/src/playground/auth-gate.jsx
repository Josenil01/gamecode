import React, {useEffect, useState} from 'react';

const PLATFORM_URL = 'https://aluno.helloyotta.com';

const wrapStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    background: '#f0f4f8',
    margin: 0
};
const cardStyle = {
    background: '#ffffff',
    borderRadius: 16,
    padding: '2.5rem 3rem',
    boxShadow: '0 4px 24px rgba(0,0,0,.10)',
    textAlign: 'center',
    maxWidth: 420,
    width: '90%'
};
const btnStyle = {
    background: '#ff8c1a',
    color: '#1f2937',
    border: 'none',
    borderRadius: 12,
    padding: '0.7rem 1.6rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    marginTop: '1rem'
};

function LoginRequired () {
    return (
        <div style={wrapStyle}>
            <div style={cardStyle}>
                <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>🔒</div>
                <h1 style={{fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#1e293b'}}>
                    Ops! Você não fez o login.
                </h1>
                <p style={{color: '#64748b', margin: '0 0 0.5rem', lineHeight: 1.5}}>
                    Acesse a plataforma helloyotta e abra esta atividade a partir de lá.
                </p>
                <a
                    href={PLATFORM_URL}
                    style={btnStyle}
                >
                    Ir para o helloyotta
                </a>
            </div>
        </div>
    );
}

function AccessDenied () {
    return (
        <div style={wrapStyle}>
            <div style={cardStyle}>
                <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>🚫</div>
                <h1 style={{fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#b91c1c'}}>
                    Acesso negado
                </h1>
                <p style={{color: '#64748b', margin: '0 0 0.5rem', lineHeight: 1.5}}>
                    Sua sessão expirou ou você não tem permissão para acessar esta atividade.
                </p>
                <a
                    href={PLATFORM_URL}
                    style={btnStyle}
                >
                    Voltar ao helloyotta
                </a>
            </div>
        </div>
    );
}

function Checking () {
    return (
        <div style={wrapStyle}>
            <p style={{fontSize: '1.1rem', color: '#64748b'}}>Verificando acesso...</p>
        </div>
    );
}

const API_BASE = (typeof window !== 'undefined' && window.__HYSCRATCH_CONFIG?.apiUrl)
    ?? process.env.ACTIVITY_API_URL
    ?? 'https://aluno.helloyotta.com';

const VERIFY_URL = (typeof window !== 'undefined' && window.__HYSCRATCH_CONFIG?.verifyUrl)
    ?? `${API_BASE}/auth/verify`;

/**
 * Auth gate shown before the Scratch editor.
 * - No ?token= in URL   → "Ops! Você não fez o login."
 * - Invalid token        → "Acesso negado"
 * - Valid token          → calls onAuthorized() and renders nothing (editor takes over)
 *
 * On success, student info is available at window.__hyStudent = { token, studentId, studentName }.
 */
export default function AuthGate ({onAuthorized}) {
    // 'checking' | 'no-token' | 'denied' | 'ok'
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let token = params.get('token');

        // Fallback: also check #token= in the hash (some platforms deliver via fragment)
        if (!token) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            token = hashParams.get('token');
        }

        if (!token) {
            setStatus('no-token');
            return;
        }

        // Remove token from URL bar (avoid sharing / history leaks)
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);

        fetch(VERIFY_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token})
        })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok) {
                    window.__hyStudent = {
                        token,
                        studentId: data.studentId,
                        studentName: data.studentName
                    };
                    setStatus('ok');
                    if (onAuthorized) onAuthorized();
                } else {
                    setStatus('denied');
                }
            })
            .catch(() => {
                // API unreachable – deny access (fail-secure)
                setStatus('denied');
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (status === 'checking') return <Checking />;
    if (status === 'no-token') return <LoginRequired />;
    if (status === 'denied') return <AccessDenied />;
    return null; // authorized – editor is rendering
}
