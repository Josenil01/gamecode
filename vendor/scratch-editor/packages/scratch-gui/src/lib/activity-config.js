/**
 * Configuração da atividade pedagógica ativa no editor.
 *
 * O host (apps/web) pode trocar a atividade a qualquer momento via:
 *   window.HyScratch.setActivity(config)
 *
 * Ou via postMessage:
 *   editorIframe.contentWindow.postMessage({
 *     type: 'hyscratch:set-activity',
 *     activity: { id, title, requiredBlocks, incorrectBlocks, ... }
 *   }, '*')
 *
 * Estrutura esperada: veja packages/evaluator/src/activity-config.types.ts
 */

const DEFAULT_ACTIVITY = {
    id: 'demo-01',
    title: 'Atividade Demonstração',
    description: 'Mover o personagem para uma posição específica.',
    audienceLevel: 'fundamental-1',
    requiredBlocks: [
        {opcode: 'motion_gotoxy', label: 'vá para x: () y: ()', required: true}
    ],
    incorrectBlocks: [
        {
            opcode: 'motion_pointtowards',
            label: 'aponte para ()',
            friendlyMessage:
                'Esse bloco muda a direção do personagem, mas não move ele para outro lugar. ' +
                'Tente o bloco "vá para x: () y: ()" que fica na mesma categoria Movimento!',
            suggestedOpcode: 'motion_gotoxy',
            suggestedLabel: 'vá para x: () y: ()'
        }
    ]
};

let _currentActivity = DEFAULT_ACTIVITY;

const getActivity = function () {
    return _currentActivity;
};

const setActivity = function (config) {
    if (!config || !config.id) return;
    _currentActivity = config;
};

// Expõe API global para o host e para mensagens recebidas via postMessage
if (typeof window !== 'undefined') {
    window.HyScratch = window.HyScratch || {};
    window.HyScratch.setActivity = setActivity;
    window.HyScratch.getActivity = getActivity;

    window.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'hyscratch:set-activity') return;
        if (!event.data.activity) return;
        setActivity(event.data.activity);
    });
}

export {
    getActivity,
    setActivity,
    DEFAULT_ACTIVITY
};
