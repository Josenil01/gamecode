import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { evaluatePlaceholder, evaluateProjectJson, evaluateProjectSb3Base64 } from "./index";

describe("evaluatePlaceholder", () => {
  it("retorna resultado inicial valido", () => {
    const result = evaluatePlaceholder();
    expect(result.ok).toBe(true);
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("evaluateProjectJson", () => {
  it("retorna correto quando encontra repeticao e movimento", () => {
    const result = evaluateProjectJson({
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
    });

    expect(result.status).toBe("correto");
    expect(result.insights.spriteCount).toBe(1);
  });

  it("retorna erro quando nao encontra blocos esperados", () => {
    const result = evaluateProjectJson({
      targets: [{ isStage: false, blocks: { a: { opcode: "looks_say" } } }],
    });

    expect(result.status).toBe("erro");
    expect(result.insights.hasRepeatBlock).toBe(false);
    expect(result.insights.hasMotionBlock).toBe(false);
  });
});

describe("evaluateProjectSb3Base64", () => {
  it("avalia sb3 base64 valido", async () => {
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
              b: { opcode: "motion_turnright" },
            },
          },
        ],
      })
    );

    const base64 = await zip.generateAsync({ type: "base64" });
    const result = await evaluateProjectSb3Base64(base64);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("correto");
  });
});
