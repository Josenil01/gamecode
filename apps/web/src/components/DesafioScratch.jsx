import React, { useMemo, useState } from "react";

const statusStyles = {
  pendente: { label: "pendente", color: "#475569", bg: "#e2e8f0" },
  correto: { label: "correto", color: "#166534", bg: "#dcfce7" },
  erro: { label: "erro", color: "#b91c1c", bg: "#fee2e2" },
};

export default function DesafioScratch({ titulo, enunciado, respostaEsperada, onLog }) {
  const [resposta, setResposta] = useState("");
  const [status, setStatus] = useState("pendente");
  const [feedback, setFeedback] = useState("Preencha a resposta e clique em Verificar.");

  const style = useMemo(() => statusStyles[status], [status]);

  const verificar = () => {
    const valor = resposta.trim();
    if (!valor) {
      setStatus("erro");
      setFeedback("Informe um valor antes de verificar.");
      onLog?.("warn", "Verificacao sem resposta no desafio.");
      return;
    }

    if (valor === String(respostaEsperada)) {
      setStatus("correto");
      setFeedback("Correto. Boa logica! Pode seguir para o proximo passo.");
      onLog?.("info", `Desafio validado com sucesso. Resposta: ${valor}`);
      return;
    }

    setStatus("erro");
    setFeedback("Resposta incorreta. Revise a regra e tente novamente.");
    onLog?.("warn", `Desafio incorreto. Recebido: ${valor}`);
  };

  return (
    <section
      style={{
        marginTop: "1rem",
        border: "1px solid #d7dce3",
        borderRadius: "12px",
        padding: "1rem",
        background: "#ffffff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{titulo}</h2>
      <p>{enunciado}</p>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="desafio-resposta">Resposta</label>
        <input
          id="desafio-resposta"
          type="text"
          value={resposta}
          onChange={(event) => setResposta(event.target.value)}
          placeholder="Digite sua resposta"
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "0.5rem 0.7rem",
          }}
        />
        <button
          onClick={verificar}
          style={{
            border: "none",
            borderRadius: "10px",
            padding: "0.55rem 0.9rem",
            background: "#0f172a",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Verificar
        </button>
      </div>

      <p
        data-testid="desafio-status"
        style={{
          marginTop: "0.8rem",
          display: "inline-block",
          padding: "0.25rem 0.6rem",
          borderRadius: "999px",
          color: style.color,
          background: style.bg,
          fontWeight: 700,
          fontSize: "0.85rem",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {style.label}
      </p>

      <p style={{ marginTop: "0.6rem", color: "#334155" }}>{feedback}</p>
    </section>
  );
}
