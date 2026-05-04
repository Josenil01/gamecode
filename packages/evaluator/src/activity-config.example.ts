/**
 * MODELO DE ATIVIDADE — copie este arquivo para criar uma nova atividade.
 *
 * Instruções:
 *   1. Copie para packages/evaluator/src/activities/<id-da-atividade>.ts
 *   2. Substitua todos os campos marcados com TODO
 *   3. Importe e passe o objeto para window.HyScratch.setActivity() via
 *      postMessage do host (apps/web) antes de o aluno abrir o editor
 *
 * Consulte activity-config.types.ts para a referência completa dos tipos
 * e a lista de opcodes disponíveis no cabeçalho daquele arquivo.
 */

import type { ActivityConfig } from "./activity-config.types";

const atividadeModelo: ActivityConfig = {
  // ------------------------------------------------------------------
  // Identificação
  // ------------------------------------------------------------------

  /** Use kebab-case, único no projeto. Ex.: "modulo-02-atividade-03" */
  id: "TODO: modulo-XX-atividade-YY",

  /** Título curto exibido ao aluno no feedback */
  title: "TODO: Título da Atividade",

  /** Uma frase descrevendo o que o aluno vai aprender */
  description: "TODO: O aluno deve aprender a ...",

  /**
   * Nível da turma — define o tom das mensagens no modal.
   * Opções: "fundamental-1" | "fundamental-2" | "medio" | "adulto"
   */
  audienceLevel: "fundamental-1",

  // ------------------------------------------------------------------
  // Blocos obrigatórios
  // ------------------------------------------------------------------

  /**
   * Lista de blocos que o aluno DEVE usar para completar a atividade.
   * Adicione um objeto por bloco obrigatório.
   */
  requiredBlocks: [
    {
      opcode: "TODO: motion_gotoxy",        // opcode exato do Scratch
      label: "TODO: vá para x: () y: ()",   // rótulo legível ao aluno
      required: true,                        // false = sugerido, não obrigatório
    },
    // Adicione mais blocos obrigatórios conforme necessário:
    // { opcode: "control_repeat", label: "repita () vezes", required: true },
  ],

  // ------------------------------------------------------------------
  // Blocos que disparam aviso pedagógico
  // ------------------------------------------------------------------

  /**
   * Quando o aluno arrastar um desses blocos para o script,
   * o editor abre um modal amigável com a mensagem e a sugestão.
   *
   * Adicione um objeto para cada confusão comum nesta atividade.
   * Exemplo clássico: aluno usa "aponte para" em vez de "vá para x y".
   */
  incorrectBlocks: [
    {
      /** Opcode do bloco que o aluno usou por engano */
      opcode: "TODO: motion_pointtowards",

      /** Como esse bloco aparece na tela do Scratch */
      label: "TODO: aponte para ()",

      /**
       * Mensagem exibida no modal — seja amigável e educativo.
       * Dica: explique o que o bloco errado FAZ e por que o correto é melhor
       * para este objetivo específico. Evite "você errou".
       */
      friendlyMessage:
        "TODO: Esse bloco muda a direção do personagem, mas não move ele para outro lugar. " +
        "Experimente o bloco sugerido abaixo para posicionar o personagem no lugar certo!",

      /** Opcode do bloco que deve ser usado no lugar */
      suggestedOpcode: "TODO: motion_gotoxy",

      /** Como o bloco correto aparece na tela do Scratch */
      suggestedLabel: "TODO: vá para x: () y: ()",
    },

    // Adicione mais confusões comuns para esta atividade:
    // {
    //   opcode: "motion_turnright",
    //   label: "gire () graus para a direita",
    //   friendlyMessage:
    //     "Esse bloco gira o personagem, mas não faz ele se mover para frente. " +
    //     "Tente o bloco 'mova () passos' para avançar!",
    //   suggestedOpcode: "motion_movesteps",
    //   suggestedLabel: "mova () passos",
    // },
  ],
};

export default atividadeModelo;
