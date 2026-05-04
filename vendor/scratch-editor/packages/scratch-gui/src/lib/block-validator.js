import {getActivity} from './activity-config.js';

/**
 * Opcodes que nunca devem disparar o modal pedagógico,
 * independente da configuração da atividade.
 */
const IGNORED_OPCODE_PREFIXES = [
    'procedures_',
    'argument_',
    'data_'
];

const validateWrongOpcode = function (opcode) {
    if (!opcode) return null;

    const isIgnored = IGNORED_OPCODE_PREFIXES.some(prefix => opcode.startsWith(prefix));
    if (isIgnored) return null;

    const activity = getActivity();
    if (!activity || !Array.isArray(activity.incorrectBlocks)) return null;

    const wrongBlock = activity.incorrectBlocks.find(function (b) {
        return b.opcode === opcode;
    });
    if (!wrongBlock) return null;

    return {
        detectedOpcode: wrongBlock.opcode,
        detectedLabel: wrongBlock.label,
        message: wrongBlock.friendlyMessage,
        suggestedOpcode: wrongBlock.suggestedOpcode,
        suggestedLabel: wrongBlock.suggestedLabel
    };
};

/**
 * Valida um evento Blockly contra a configuração da atividade atual.
 *
 * @param {object} event  - Evento do Blockly workspace
 * @returns {object|null} - Objeto com dados da dica, ou null se nenhuma dica
 */
const extractOpcodesFromEvent = function (event, workspace) {
    if (!event) return [];

    const opcodes = [];
    const pushOpcode = function (value) {
        if (typeof value === 'string' && value.length > 0) {
            opcodes.push(value);
        }
    };

    pushOpcode(event.json && event.json.type);

    if (event.xml && typeof event.xml.getAttribute === 'function') {
        pushOpcode(event.xml.getAttribute('type'));
    }

    pushOpcode(event.oldJson && event.oldJson.type);

    if (workspace && typeof workspace.getBlockById === 'function') {
        if (event.blockId) {
            const eventBlock = workspace.getBlockById(event.blockId);
            pushOpcode(eventBlock && eventBlock.type);
        }

        if (Array.isArray(event.ids)) {
            for (let i = 0; i < event.ids.length; i++) {
                const block = workspace.getBlockById(event.ids[i]);
                pushOpcode(block && block.type);
            }
        }
    }

    return opcodes.filter(function (opcode, index) {
        return opcodes.indexOf(opcode) === index;
    });
};

const validateBlockEvent = function (event, workspace) {
    // So interessa eventos de criacao de bloco no workspace principal.
    // 'endDrag' removido: dispara antes do descarte para lixeira/flyout.
    const isCreateEvent = event && (
        event.type === 'create' ||
        event.type === 'blockCreate' ||
        event.type === 'BLOCK_CREATE'
    );
    if (!isCreateEvent) return null;

    // recordUndo=false indica evento de sistema (flyout/undo), nao de drag do usuario.
    if (event.recordUndo === false) return null;

    // Extrai opcodes com fallback entre formatos de evento.
    const candidateOpcodes = extractOpcodesFromEvent(event, workspace);
    if (!candidateOpcodes.length) return null;

    for (let i = 0; i < candidateOpcodes.length; i++) {
        const opcode = candidateOpcodes[i];
        const hint = validateWrongOpcode(opcode);
        if (hint) return hint;
    }

    return null;
};

export {
    validateBlockEvent,
    validateWrongOpcode
};
