import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildApp } from "./app";

describe("GET /health", () => {
  it("retorna status de saude", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "@hyscratch/api" });

    await app.close();
  });
});

describe("POST /evaluate/simple", () => {
  it("retorna correto para resposta 24", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/evaluate/simple",
      payload: { answer: 24 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      status: "correto",
      feedback: "Correto. Boa logica!",
    });

    await app.close();
  });

  it("retorna erro para resposta incorreta", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/evaluate/simple",
      payload: { answer: "10" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      status: "erro",
      feedback: "Resposta incorreta. Tente novamente.",
    });

    await app.close();
  });

  it("retorna 400 para payload invalido", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/evaluate/simple",
      payload: { foo: "bar" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      status: "erro",
      feedback: "Payload invalido. Envie { answer }.",
    });

    await app.close();
  });
});

describe("POST /evaluate/project", () => {
  it("retorna correto para projeto com repeticao e movimento", async () => {
    const zip = new JSZip();
    zip.file(
      "project.json",
      JSON.stringify({
        targets: [
          { isStage: true, blocks: {} },
          {
            isStage: false,
            blocks: {
              a: { opcode: "control_repeat" },
              b: { opcode: "motion_movesteps" },
            },
          },
        ],
      })
    );
    const projectDataBase64 = await zip.generateAsync({ type: "base64" });

    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/evaluate/project",
      payload: { projectDataBase64 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      status: "correto",
      insights: {
        hasRepeatBlock: true,
        hasMotionBlock: true,
      },
    });

    await app.close();
  });

  it("retorna 400 para payload invalido", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/evaluate/project",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      status: "erro",
      feedback: "Payload invalido. Envie { projectDataBase64 }.",
    });

    await app.close();
  });
});
