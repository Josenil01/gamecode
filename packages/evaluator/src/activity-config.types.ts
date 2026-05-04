/**
 * Tipos compartilhados para configuração pedagógica de atividades hyScratch.
 *
 * Referência rápida de opcodes comuns:
 *   Movimento : motion_movesteps, motion_gotoxy, motion_goto,
 *               motion_turnright, motion_turnleft, motion_pointindirection,
 *               motion_pointtowards, motion_ifonedgebounce
 *   Controle  : control_repeat, control_forever, control_if,
 *               control_if_else, control_wait
 *   Aparência : looks_say, looks_sayforsecs, looks_setsizeto, looks_show
 *   Som       : sound_play, sound_playuntildone
 *   Eventos   : event_whenflagclicked, event_whenkeypressed
 *   Variáveis : data_setvariableto, data_changevariableby
 */

/** Nível da turma — influencia o tom da mensagem no modal */
export type AudienceLevel =
  | "fundamental-1"
  | "fundamental-2"
  | "medio"
  | "adulto";

/** Bloco que o aluno DEVE usar para completar a atividade */
export type RequiredBlock = {
  /** Opcode exato do Scratch (ex.: "motion_gotoxy") */
  opcode: string;
  /** Rótulo legível para exibir ao aluno (ex.: "vá para x: () y: ()") */
  label: string;
  /** Se true: ausência deste bloco marca a atividade como incompleta */
  required: boolean;
};

/** Bloco que gera aviso quando usado no lugar de um bloco esperado */
export type IncorrectBlock = {
  /** Opcode do bloco que o aluno usou por engano */
  opcode: string;
  /** Rótulo legível do bloco incorreto */
  label: string;
  /** Mensagem amigável exibida no modal dentro do editor */
  friendlyMessage: string;
  /** Opcode do bloco correto a sugerir */
  suggestedOpcode: string;
  /** Rótulo do bloco sugerido (exibido na dica do modal) */
  suggestedLabel: string;
};

/** Configuração completa de uma atividade */
export type ActivityConfig = {
  /** Identificador único — use kebab-case (ex.: "modulo-01-atividade-02") */
  id: string;
  /** Título exibido ao aluno e ao professor */
  title: string;
  /** Descrição breve do objetivo pedagógico */
  description: string;
  /** Nível da turma */
  audienceLevel: AudienceLevel;
  /** Blocos que o aluno deve usar */
  requiredBlocks: RequiredBlock[];
  /** Blocos que disparam aviso pedagógico quando usados incorretamente */
  incorrectBlocks: IncorrectBlock[];
};
