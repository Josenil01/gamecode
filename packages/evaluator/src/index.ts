import JSZip from "jszip";

export type EvaluationResult = {
  ok: boolean;
  message: string;
};

export type ProjectEvaluation = {
  ok: true;
  status: "correto" | "erro";
  feedback: string;
  insights: {
    targetCount: number;
    spriteCount: number;
    hasRepeatBlock: boolean;
    hasMotionBlock: boolean;
  };
};

export function evaluatePlaceholder(): EvaluationResult {
  return {
    ok: true,
    message: "Evaluator inicial pronto para evoluir no Sprint 2.",
  };
}

export async function evaluateProjectSb3Base64(projectDataBase64: string): Promise<ProjectEvaluation> {
  try {
    const binary = Buffer.from(projectDataBase64, "base64");
    if (!binary.length) {
      return buildErrorEvaluation("Projeto vazio ou base64 invalido.");
    }

    const zip = await JSZip.loadAsync(binary);
    const projectJsonFile = zip.file("project.json");

    if (!projectJsonFile) {
      return buildErrorEvaluation("Arquivo .sb3 invalido: project.json ausente.");
    }

    const projectJsonText = await projectJsonFile.async("string");
    const projectData = JSON.parse(projectJsonText);
    return evaluateProjectJson(projectData);
  } catch {
    return buildErrorEvaluation("Nao foi possivel ler o projeto .sb3 enviado.");
  }
}

export function evaluateProjectJson(projectData: unknown): ProjectEvaluation {
  const targets = Array.isArray((projectData as { targets?: unknown[] })?.targets)
    ? ((projectData as { targets: unknown[] }).targets as Array<{ isStage?: boolean; blocks?: Record<string, { opcode?: string }> }> )
    : [];

  if (!targets.length) {
    return buildErrorEvaluation("Projeto sem alvos validos para avaliacao.");
  }

  const spriteCount = targets.filter((target) => !target?.isStage).length;
  const opcodes = targets.flatMap((target) =>
    Object.values(target?.blocks ?? {}).map((block) => String(block?.opcode ?? ""))
  );

  const hasRepeatBlock = opcodes.some((opcode) => opcode.startsWith("control_repeat") || opcode === "control_forever");
  const hasMotionBlock = opcodes.some((opcode) => opcode.startsWith("motion_"));

  if (hasRepeatBlock && hasMotionBlock) {
    return {
      ok: true,
      status: "correto",
      feedback: "Projeto consistente: encontrou blocos de repeticao e movimento.",
      insights: {
        targetCount: targets.length,
        spriteCount,
        hasRepeatBlock,
        hasMotionBlock,
      },
    };
  }

  return {
    ok: true,
    status: "erro",
    feedback:
      "Projeto ainda incompleto para esta rubrica. Inclua blocos de repeticao e de movimento.",
    insights: {
      targetCount: targets.length,
      spriteCount,
      hasRepeatBlock,
      hasMotionBlock,
    },
  };
}

function buildErrorEvaluation(feedback: string): ProjectEvaluation {
  return {
    ok: true,
    status: "erro",
    feedback,
    insights: {
      targetCount: 0,
      spriteCount: 0,
      hasRepeatBlock: false,
      hasMotionBlock: false,
    },
  };
}
