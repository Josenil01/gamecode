import React, { useEffect, useMemo, useRef, useState } from "react";
import DesafioScratch from "./components/DesafioScratch";

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authStatus, setAuthStatus] = useState("loading"); // 'loading' | 'authorized' | 'denied'
  const [authStudent, setAuthStudent] = useState(null); // { token, studentId, studentName }
  // ─────────────────────────────────────────────────────────────────────────

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [preferLocalEditor, setPreferLocalEditor] = useState(true);
  const [editorConnectionStatus, setEditorConnectionStatus] = useState("desconectado");
  const [importStatus, setImportStatus] = useState("pendente");
  const [importMessage, setImportMessage] = useState("Nenhum projeto importado.");
  const [evaluationStatus, setEvaluationStatus] = useState("pendente");
  const [evaluationFeedback, setEvaluationFeedback] = useState("Aguardando projeto para avaliacao automatica.");
  const [evaluationInsights, setEvaluationInsights] = useState(null);
  const [importedFileName, setImportedFileName] = useState("");
  const [importedFile, setImportedFile] = useState(null);

  // Tracks stepIds already reported to helloyotta in this session
  const completedStepsRef = useRef([]);
  // Pending step-completed: { stepId, activityId, isLast } waiting for project-data response
  const pendingProgressRef = useRef(null);

  const editorIframeRef = useRef(null);

  const localEditorUrl = "http://localhost:8601/";
  const cloudEditorUrl = "https://scratch.mit.edu/projects/editor/?tutorial=getStarted";

  const editorUrl = useMemo(
    () => (preferLocalEditor ? localEditorUrl : cloudEditorUrl),
    [preferLocalEditor]
  );
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001", []);
  const helloyottaProgressUrl = useMemo(
    () => import.meta.env.VITE_HELLOYOTTA_PROGRESS_URL ?? "https://aluno.helloyotta.com/api/student-progress",
    []
  );

  // ── Auth: ler ?token= da URL e validar na API ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    // Remove token da URL (evitar histórico e cópia acidental)
    if (token) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
    }

    if (!token) {
      setAuthStatus("denied");
      return;
    }

    fetch(`${apiBaseUrl}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) {
          setAuthStudent({ token, studentId: data.studentId, studentName: data.studentName });
          setAuthStatus("authorized");
        } else {
          setAuthStatus("denied");
        }
      })
      .catch(() => setAuthStatus("denied"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onEditorMessage = (event) => {
      if (!event?.data || typeof event.data !== "object") {
        return;
      }

      const messageType = event.data.type;
      if (messageType === "hyscratch:editor-ready") {
        setEditorConnectionStatus("conectado");
        logFrontend("info", "Editor respondeu com sinal de pronto.");
      }

      if (messageType === "hyscratch:project-changed") {
        logFrontend("info", "Editor sinalizou alteracao no projeto.");
      }

      if (messageType === "hyscratch:project-loaded") {
        setEditorConnectionStatus("projeto-carregado");
        setImportStatus("correto");
        setImportMessage("Projeto carregado no editor com sucesso.");
        logFrontend("info", "Editor confirmou carregamento do projeto.");
      }

      if (messageType === "hyscratch:error") {
        setEditorConnectionStatus("erro");
        const reason = event.data.reason || "erro-desconhecido";
        logFrontend("warn", `Editor retornou erro: ${reason}`);
      }

      if (messageType === "hyscratch:project-data") {
        const projectDataBase64 = event.data.projectDataBase64;
        const fileName = event.data.fileName || "projeto-editor.sb3";
        if (!projectDataBase64) {
          setImportStatus("erro");
          setImportMessage("Editor nao retornou dados do projeto.");
          return;
        }

        // ── Progresso pendente: enviar ao helloyotta ─────────────────────
        if (pendingProgressRef.current) {
          const { stepId, activityId, isLast } = pendingProgressRef.current;
          pendingProgressRef.current = null;
          void sendProgressToHelloyotta({ stepId, activityId, isLast, projectDataBase64 });
          return; // não faz download automático neste caso
        }
        // ────────────────────────────────────────────────────────────────

        try {
          const blob = base64ToBlob(projectDataBase64, "application/x.scratch.sb3");
          downloadBlob(blob, fileName);
          setImportStatus("correto");
          setImportMessage("Projeto exportado do editor com sucesso.");
          logFrontend("info", `Projeto exportado do editor: ${fileName}`);
          void evaluateProjectWithApi(projectDataBase64);
        } catch (error) {
          setImportStatus("erro");
          setImportMessage("Falha ao processar projeto exportado do editor.");
          logFrontend("error", "Falha ao converter projeto exportado para download.");
        }
      }

      // ── Step concluído: capturar .sb3 e enviar ao helloyotta ───────────
      if (messageType === "hyscratch:step-completed") {
        const { stepId, activityId, isLast } = event.data;
        if (!stepId) return;
        pendingProgressRef.current = { stepId, activityId, isLast: !!isLast };
        if (editorIframeRef.current?.contentWindow) {
          editorIframeRef.current.contentWindow.postMessage(
            { type: "hyscratch:get-project", source: "hyscratch-web", at: Date.now() },
            "*"
          );
        } else {
          // Sem iframe disponível: envia sem o .sb3
          pendingProgressRef.current = null;
          void sendProgressToHelloyotta({ stepId, activityId, isLast: !!isLast, projectDataBase64: null });
        }
      }
      // ────────────────────────────────────────────────────────────────
    };

    window.addEventListener("message", onEditorMessage);
    return () => {
      window.removeEventListener("message", onEditorMessage);
    };
  }, []);

  const logFrontend = (level, message) => {
    if (level === "warn") {
      console.warn(`[web] ${message}`);
      return;
    }
    if (level === "error") {
      console.error(`[web] ${message}`);
      return;
    }
    console.info(`[web] ${message}`);
  };

  const onPingEditor = () => {
    if (!editorIframeRef.current?.contentWindow) {
      setEditorConnectionStatus("erro");
      logFrontend("warn", "Nao foi possivel enviar ping: iframe indisponivel.");
      return;
    }

    setEditorConnectionStatus("aguardando");
    editorIframeRef.current.contentWindow.postMessage(
      {
        type: "hyscratch:ping",
        source: "hyscratch-web",
        at: Date.now(),
      },
      "*"
    );
    logFrontend("info", "Ping enviado ao editor embedado.");
  };

  const onImportSb3 = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".sb3")) {
      setImportStatus("erro");
      setImportedFileName("");
      setImportedFile(null);
      setImportMessage("Arquivo invalido. Selecione um arquivo com extensao .sb3.");
      logFrontend("warn", `Tentativa de importacao invalida: ${file.name}`);
      return;
    }

    setImportStatus("correto");
    setImportedFileName(file.name);
    setImportedFile(file);
    setImportMessage("Projeto importado com sucesso.");
    logFrontend("info", `Projeto importado: ${file.name}`);

    void sendProjectToEditor(file);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Falha ao converter arquivo para base64."));
          return;
        }

        const base64 = result.split(",")[1] || "";
        if (!base64) {
          reject(new Error("Base64 vazio ao converter arquivo."));
          return;
        }

        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error("Erro ao ler arquivo .sb3."));
      };

      reader.readAsDataURL(file);
    });

  const sendProjectToEditor = async (file) => {
    if (!editorIframeRef.current?.contentWindow) {
      logFrontend("warn", "Editor nao esta aberto; projeto salvo apenas localmente.");
      return;
    }

    if (!preferLocalEditor) {
      logFrontend("warn", "Editor oficial selecionado; envio automatico de projeto indisponivel.");
      return;
    }

    try {
      setEditorConnectionStatus("enviando-projeto");
      const projectDataBase64 = await fileToBase64(file);

      editorIframeRef.current.contentWindow.postMessage(
        {
          type: "hyscratch:load-project",
          source: "hyscratch-web",
          projectDataBase64,
          name: file.name,
          at: Date.now(),
        },
        "*"
      );

      logFrontend("info", `Projeto enviado ao editor: ${file.name}`);
      setImportMessage("Projeto enviado ao editor. Aguardando confirmacao...");
    } catch (err) {
      setEditorConnectionStatus("erro");
      setImportStatus("erro");
      setImportMessage("Falha ao preparar projeto para envio ao editor.");
      logFrontend("error", `Erro ao enviar projeto: ${err?.message || "erro desconhecido"}`);
    }
  };

  const evaluateProjectWithApi = async (projectDataBase64) => {
    const headers = { "Content-Type": "application/json" };
    if (authStudent?.token) headers["Authorization"] = `Bearer ${authStudent.token}`;

    try {
      setEvaluationStatus("avaliando");
      setEvaluationFeedback("Enviando projeto para avaliacao...");

      const response = await fetch(`${apiBaseUrl}/evaluate/project`, {
        method: "POST",
        headers,
        body: JSON.stringify({ projectDataBase64 }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.feedback || "Falha ao avaliar projeto.");
      }

      setEvaluationStatus(data.status === "correto" ? "correto" : "erro");
      setEvaluationFeedback(data.feedback || "Avaliacao concluida.");
      setEvaluationInsights(data.insights ?? null);
      logFrontend("info", `Avaliacao automatica concluida: ${data.status}`);
    } catch (error) {
      setEvaluationStatus("erro");
      setEvaluationFeedback("Nao foi possivel avaliar o projeto na API.");
      setEvaluationInsights(null);
      logFrontend("error", `Falha na avaliacao automatica: ${error?.message || "erro desconhecido"}`);
    }
  };

  // ── Envio de progresso ao helloyotta ─────────────────────────────────────
  const sendProgressToHelloyotta = async ({ stepId, activityId, isLast, projectDataBase64 }) => {
    if (!authStudent) {
      logFrontend("warn", "Progresso nao enviado: aluno nao autenticado.");
      return;
    }

    if (!completedStepsRef.current.includes(stepId)) {
      completedStepsRef.current = [...completedStepsRef.current, stepId];
    }

    const payload = {
      studentId: authStudent.studentId,
      activityId: activityId ?? "unknown",
      stepId,
      completedSteps: completedStepsRef.current,
      completedAt: new Date().toISOString(),
      activityCompleted: !!isLast,
      ...(projectDataBase64 ? { projectBase64: projectDataBase64 } : {}),
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(helloyottaProgressUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authStudent.token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          logFrontend("info", `Progresso step ${stepId} enviado ao helloyotta (tentativa ${attempt}).`);
          return;
        }
        logFrontend("warn", `helloyotta retornou ${res.status} ao salvar progresso (tentativa ${attempt}).`);
      } catch (err) {
        logFrontend("warn", `Falha ao enviar progresso step ${stepId} (tentativa ${attempt}): ${err?.message}`);
      }
    }
    logFrontend("error", `Nao foi possivel enviar progresso do step ${stepId} apos ${MAX_RETRIES} tentativas.`);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const onExportSb3 = () => {
    if (preferLocalEditor && editorIframeRef.current?.contentWindow) {
      setEditorConnectionStatus("aguardando-export");
      editorIframeRef.current.contentWindow.postMessage(
        {
          type: "hyscratch:get-project",
          source: "hyscratch-web",
          fileName: importedFileName || "projeto-editor.sb3",
          at: Date.now(),
        },
        "*"
      );
      setImportMessage("Solicitando projeto atual ao editor...");
      logFrontend("info", "Solicitacao de exportacao enviada ao editor.");
      return;
    }

    if (!importedFile) {
      setImportStatus("erro");
      setImportMessage("Importe um arquivo .sb3 antes de exportar.");
      logFrontend("warn", "Exportacao tentada sem arquivo importado.");
      return;
    }

    if (typeof URL.createObjectURL !== "function") {
      setImportStatus("erro");
      setImportMessage("Exportacao nao suportada neste navegador.");
      logFrontend("error", "Exportacao indisponivel: createObjectURL ausente.");
      return;
    }

    const objectUrl = URL.createObjectURL(importedFile);
    const downloadName = `${importedFile.name.replace(/\.sb3$/i, "")}-export.sb3`;
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(objectUrl);
    }

    setImportStatus("correto");
    setImportMessage("Projeto exportado com sucesso.");
    logFrontend("info", `Projeto exportado: ${downloadName}`);
  };

  const base64ToBlob = (base64, mimeType) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  };

  const downloadBlob = (blob, fileName) => {
    if (typeof URL.createObjectURL !== "function") {
      throw new Error("createObjectURL indisponivel");
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        padding: "2rem",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      {/* ── Auth Gate ─────────────────────────────────────────────────── */}
      {authStatus === "loading" && (
        <div style={{ textAlign: "center", marginTop: "4rem", color: "#334155" }}>
          <p style={{ fontSize: "1.2rem" }}>Verificando acesso...</p>
        </div>
      )}

      {authStatus === "denied" && (
        <div style={{ textAlign: "center", marginTop: "4rem" }}>
          <h2 style={{ color: "#b91c1c" }}>Acesso negado</h2>
          <p style={{ color: "#475569" }}>
            Sua sessão expirou ou você não tem permissão para acessar esta página.
          </p>
          <a
            href="https://aluno.helloyotta.com"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              padding: "0.6rem 1.2rem",
              background: "#ff8c1a",
              color: "#1f2937",
              borderRadius: "10px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Voltar ao helloyotta
          </a>
        </div>
      )}
      {/* ─────────────────────────────────────────────────────────────── */}

      {authStatus === "authorized" && (
        <>
          <h1>hyScratch MVP</h1>
          {authStudent?.studentName && (
            <p style={{ color: "#475569" }}>Olá, <strong>{authStudent.studentName}</strong>!</p>
          )}
          <p>Desafio 01: abra o editor para iniciar a atividade no Scratch.</p>

      <section
        style={{
          marginTop: "1.5rem",
          border: "1px solid #d7dce3",
          borderRadius: "12px",
          padding: "1rem",
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Secao de Aula: Editor Scratch</h2>
        <p style={{ marginBottom: "1rem" }}>
          Clique no botao para carregar o editor embutido nesta pagina.
        </p>

        <div style={{ marginBottom: "0.75rem" }}>
          <label>
            <input
              type="checkbox"
              checked={preferLocalEditor}
              onChange={(event) => setPreferLocalEditor(event.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Usar fork local do editor (localhost:8601)
          </label>
        </div>

        {!isEditorOpen ? (
          <button
            onClick={() => setIsEditorOpen(true)}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "0.7rem 1rem",
              background: "#ff8c1a",
              color: "#1f2937",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Abrir editor embutido
          </button>
        ) : (
          <div>
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingTop: "62%",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid #d7dce3",
                background: "#e2e8f0",
              }}
            >
              <iframe
                ref={editorIframeRef}
                title="Editor Scratch"
                src={editorUrl}
                loading="lazy"
                allow="clipboard-read; clipboard-write; fullscreen"
                onLoad={() => {
                  setEditorConnectionStatus("carregado");
                  logFrontend("info", `Iframe carregado: ${editorUrl}`);
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>

            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button
                onClick={onPingEditor}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.5rem 0.9rem",
                  background: "#0f766e",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Testar conexao editor
              </button>
              <span style={{ alignSelf: "center", fontSize: "0.9rem", color: "#334155" }}>
                Status da conexao: {editorConnectionStatus}
              </span>
            </div>

            <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
              Se o navegador bloquear o iframe, use o editor em nova aba:{" "}
              <a href={editorUrl} target="_blank" rel="noreferrer">
                abrir editor
              </a>
              .
            </p>
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "1rem",
          border: "1px solid #d7dce3",
          borderRadius: "12px",
          padding: "1rem",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Importacao de Projeto .sb3</h2>
        <label htmlFor="sb3-input" style={{ display: "block", marginBottom: "0.4rem" }}>
          Importar projeto (.sb3)
        </label>
        <input id="sb3-input" type="file" accept=".sb3" onChange={onImportSb3} />

        <div style={{ marginTop: "0.8rem" }}>
          <button
            onClick={onExportSb3}
            disabled={!importedFile && !(preferLocalEditor && isEditorOpen)}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "0.55rem 0.9rem",
              background: importedFile || (preferLocalEditor && isEditorOpen) ? "#0f766e" : "#94a3b8",
              color: "#ffffff",
              fontWeight: 700,
              cursor: importedFile || (preferLocalEditor && isEditorOpen) ? "pointer" : "not-allowed",
            }}
          >
            Exportar projeto (.sb3)
          </button>
        </div>

        <p
          style={{
            marginTop: "0.7rem",
            color:
              importStatus === "erro"
                ? "#b91c1c"
                : importStatus === "correto"
                  ? "#166534"
                  : "#334155",
          }}
        >
          {importMessage}
        </p>

        {importedFileName ? (
          <p style={{ marginTop: "0.2rem", fontSize: "0.9rem", color: "#475569" }}>
            Arquivo atual: {importedFileName}
          </p>
        ) : null}
      </section>

      <section
        style={{
          marginTop: "1rem",
          border: "1px solid #d7dce3",
          borderRadius: "12px",
          padding: "1rem",
          background: "#fffaf0",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Avaliacao automatica do projeto (.sb3)</h2>
        <p
          style={{
            marginTop: "0.2rem",
            color:
              evaluationStatus === "correto"
                ? "#166534"
                : evaluationStatus === "erro"
                  ? "#b91c1c"
                  : "#334155",
          }}
        >
          {evaluationFeedback}
        </p>
        <p style={{ marginTop: "0.4rem", fontSize: "0.9rem", color: "#475569" }}>
          Status: {evaluationStatus}
        </p>
        {evaluationInsights ? (
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem", color: "#334155" }}>
            <li>Targets: {evaluationInsights.targetCount}</li>
            <li>Sprites: {evaluationInsights.spriteCount}</li>
            <li>Tem repeticao: {evaluationInsights.hasRepeatBlock ? "sim" : "nao"}</li>
            <li>Tem movimento: {evaluationInsights.hasMotionBlock ? "sim" : "nao"}</li>
          </ul>
        ) : null}
      </section>

      <DesafioScratch
        titulo="Desafio de Logica (Regra Fixa)"
        enunciado="Se cada passo gira 15 graus, quantas repeticoes sao necessarias para completar 360 graus?"
        respostaEsperada={24}
        onLog={logFrontend}
      />
        </>
      )}
    </main>
  );
}
