import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { evaluateProjectSb3Base64 } from "@hyscratch/evaluator";
import { requireAuth, verifyHelloyottaToken } from "./plugins/auth.js";

const ALLOWED_ORIGINS = [
  "https://qubit.helloyotta.com",
  "https://aluno.helloyotta.com",
  "http://localhost:5173",
  "http://localhost:8601",
];

export function buildApp() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g., server-to-server) or from allowed list
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`Origem nao permitida: ${origin}`), false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.get("/health", async () => {
    return { ok: true, service: "@hyscratch/api" };
  });

  // ── Auth: endpoint público para validar token do helloyotta ──────────────
  app.post("/auth/verify", async (request, reply) => {
    const schema = z.object({ token: z.string().min(1) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "Token ausente no payload." });
    }

    try {
      const student = await verifyHelloyottaToken(parsed.data.token);
      if (!student) {
        return reply.status(401).send({ ok: false, error: "Token invalido ou expirado." });
      }
      return { ok: true, studentId: student.studentId, studentName: student.studentName };
    } catch (err) {
      request.log.error({ err }, "Erro ao verificar token");
      return reply.status(503).send({ ok: false, error: "Servico de autenticacao indisponivel." });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  app.post("/evaluate/simple", { preHandler: [requireAuth] }, async (request, reply) => {
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

  app.post("/evaluate/project", { preHandler: [requireAuth] }, async (request, reply) => {
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
