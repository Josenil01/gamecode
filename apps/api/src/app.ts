import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { evaluateProjectSb3Base64 } from "@hyscratch/evaluator";

export function buildApp() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.get("/health", async () => {
    return { ok: true, service: "@hyscratch/api" };
  });

  app.post("/evaluate/simple", async (request, reply) => {
    const schema = z.object({
      answer: z.union([z.string(), z.number()]),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ issues: parsed.error.issues }, "Payload invalido em /evaluate/simple");
      return reply.status(400).send({
        ok: false,
        status: "erro",
        feedback: "Payload invalido. Envie { answer }.",
      });
    }

    const normalized = String(parsed.data.answer).trim();
    if (normalized === "24") {
      request.log.info({ answer: normalized }, "Resposta correta no endpoint simples");
      return {
        ok: true,
        status: "correto",
        feedback: "Correto. Boa logica!",
      };
    }

    request.log.info({ answer: normalized }, "Resposta incorreta no endpoint simples");
    return {
      ok: true,
      status: "erro",
      feedback: "Resposta incorreta. Tente novamente.",
    };
  });

  app.post("/evaluate/project", async (request, reply) => {
    const schema = z.object({
      projectDataBase64: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ issues: parsed.error.issues }, "Payload invalido em /evaluate/project");
      return reply.status(400).send({
        ok: false,
        status: "erro",
        feedback: "Payload invalido. Envie { projectDataBase64 }.",
      });
    }

    const result = await evaluateProjectSb3Base64(parsed.data.projectDataBase64);
    request.log.info(
      { status: result.status, insights: result.insights },
      "Avaliacao de projeto processada"
    );
    return result;
  });

  return app;
}
