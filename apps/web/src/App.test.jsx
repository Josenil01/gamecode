import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("renderiza titulo inicial", () => {
    render(<App />);
    expect(screen.getByText("hyScratch MVP")).toBeTruthy();
  });

  it("abre o editor embutido ao clicar no botao", () => {
    render(<App />);

    fireEvent.click(screen.getByText("Abrir editor embutido"));

    expect(screen.getByTitle("Editor Scratch")).toBeTruthy();
  });

  it("aceita importacao de arquivo .sb3", () => {
    render(<App />);

    const input = screen.getByLabelText("Importar projeto (.sb3)");
    const file = new File(["fake-content"], "projeto-aluno.sb3", {
      type: "application/octet-stream",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("Projeto importado com sucesso.")).toBeTruthy();
    expect(screen.getByText("Arquivo atual: projeto-aluno.sb3")).toBeTruthy();
  });

  it("rejeita arquivo sem extensao .sb3", () => {
    render(<App />);

    const input = screen.getByLabelText("Importar projeto (.sb3)");
    const file = new File(["texto"], "notas.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText("Arquivo invalido. Selecione um arquivo com extensao .sb3.")
    ).toBeTruthy();
  });

  it("exporta projeto .sb3 apos importacao", () => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => "";
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-sb3");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App />);

    const input = screen.getByLabelText("Importar projeto (.sb3)");
    const file = new File(["fake-content"], "jogo.sb3", {
      type: "application/octet-stream",
    });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Exportar projeto (.sb3)"));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-sb3");
    expect(screen.getByText("Projeto exportado com sucesso.")).toBeTruthy();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    anchorClick.mockRestore();
  });
});
