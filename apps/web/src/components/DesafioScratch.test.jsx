import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesafioScratch from "./DesafioScratch";

afterEach(() => {
  cleanup();
});

describe("DesafioScratch", () => {
  it("inicia com status pendente", () => {
    render(<DesafioScratch titulo="Desafio" enunciado="Teste" respostaEsperada={24} />);

    expect(screen.getByTestId("desafio-status").textContent).toBe("pendente");
  });

  it("marca status correto quando resposta bate", () => {
    const onLog = vi.fn();
    render(
      <DesafioScratch titulo="Desafio" enunciado="Teste" respostaEsperada={24} onLog={onLog} />
    );

    fireEvent.change(screen.getByLabelText("Resposta"), { target: { value: "24" } });
    fireEvent.click(screen.getByText("Verificar"));

    expect(screen.getByTestId("desafio-status").textContent).toBe("correto");
    expect(screen.getByText(/Correto/)).toBeTruthy();
    expect(onLog).toHaveBeenCalled();
  });

  it("marca status erro para resposta incorreta", () => {
    render(<DesafioScratch titulo="Desafio" enunciado="Teste" respostaEsperada={24} />);

    fireEvent.change(screen.getByLabelText("Resposta"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Verificar"));

    expect(screen.getByTestId("desafio-status").textContent).toBe("erro");
  });
});
