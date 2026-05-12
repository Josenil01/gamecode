import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Validates a JWT token issued by aluno.helloyotta.com.
 *
 * Strategy: call the helloyotta introspection endpoint with the token.
 * The endpoint URL and shared secret are configured via environment variables:
 *   HELLOYOTTA_VERIFY_URL  — URL of the helloyotta token verification endpoint
 *   QUBIT_API_KEY          — shared secret / API key sent as Authorization header
 *
 * Expected helloyotta response shape:
 *   { ok: true, studentId: string, studentName: string }
 *   { ok: false }
 */

export interface StudentInfo {
  studentId: string;
  studentName: string;
}

export async function verifyHelloyottaToken(token: string): Promise<StudentInfo | null> {
  const verifyUrl = process.env.HELLOYOTTA_VERIFY_URL;
  const apiSecret = process.env.QUBIT_API_KEY;

  if (!verifyUrl) {
    throw new Error("HELLOYOTTA_VERIFY_URL nao configurado.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiSecret) headers["Authorization"] = `Bearer ${apiSecret}`;

  const res = await fetch(verifyUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { ok: boolean; studentId?: string; studentName?: string };
  if (!data?.ok || !data.studentId) return null;

  return { studentId: data.studentId, studentName: data.studentName ?? "" };
}

/**
 * Fastify preHandler — rejects requests without a valid Bearer token.
 * Attaches student info to request for use in route handlers.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return reply.status(401).send({ ok: false, error: "Token de autenticacao ausente." });
  }

  try {
    const student = await verifyHelloyottaToken(token);
    if (!student) {
      return reply.status(401).send({ ok: false, error: "Token invalido ou expirado." });
    }
    // Attach to request for route handlers
    (request as FastifyRequest & { student: StudentInfo }).student = student;
  } catch (err) {
    request.log.error({ err }, "Falha ao verificar token com helloyotta");
    return reply.status(503).send({ ok: false, error: "Servico de autenticacao indisponivel." });
  }
}
