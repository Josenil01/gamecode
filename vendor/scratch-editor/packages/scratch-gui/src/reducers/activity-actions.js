import {fetchActivity} from '../lib/activity-api';
import {
    LOAD_ACTIVITY_START,
    LOAD_ACTIVITY_SUCCESS,
    LOAD_ACTIVITY_ERROR,
    SET_VERIFY_MESSAGE,
    getCurrentStep,
    isLastStep
} from './activity';
import {OPEN_ACTIVITY_MODAL} from './activity-modal';
import {ADVANCE_STEP} from './activity';

// Notifies the parent window (apps/web) that the current step was completed.
// apps/web listens for this message and sends progress + the .sb3 to helloyotta.
const notifyStepCompleted = function (dispatch, getState) {
    const state = getState();
    const step = getCurrentStep(state);
    const isLast = isLastStep(state);
    const activityId = state.scratchGui.activity.activityId;
    dispatch({type: ADVANCE_STEP});
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'hyscratch:step-completed',
            source: 'scratch-gui',
            stepId: step ? step.stepId : null,
            activityId: activityId ?? null,
            isLast,
            at: Date.now()
        }, '*');
    }
};

// Thunk: advance step from the modal "next" button (nextStepButton steps).
// Also notifies the parent so apps/web can save progress to helloyotta.
export const advanceActivityStep = () => (dispatch, getState) => {
    notifyStepCompleted(dispatch, getState);
};

// Collects opcodes reachable from a hat block chain (ignores orphan/shadow blocks).
const getConnectedOpcodes = function (vm) {
    const connected = new Set();
    vm.runtime.targets.forEach(target => {
        const blocks = target.blocks._blocks;
        const visited = new Set();
        const getInputChildIds = function (block) {
            if (!block || !block.inputs) return [];
            const childIds = [];
            Object.values(block.inputs).forEach(input => {
                if (!input) return;
                if (typeof input === 'string') {
                    childIds.push(input);
                    return;
                }
                if (Array.isArray(input)) {
                    input.forEach(item => {
                        if (typeof item === 'string') childIds.push(item);
                    });
                    return;
                }
                if (typeof input === 'object') {
                    if (typeof input.block === 'string') childIds.push(input.block);
                    if (typeof input.shadow === 'string') childIds.push(input.shadow);
                }
            });
            return childIds;
        };
        const traverse = function (blockId) {
            if (!blockId || visited.has(blockId)) return;
            visited.add(blockId);
            const b = blocks[blockId];
            if (!b || b.shadow) return;
            connected.add(b.opcode);
            getInputChildIds(b).forEach(childId => traverse(childId));
            if (b.next) traverse(b.next);
        };
        Object.values(blocks).forEach(block => {
            // Hat blocks: no parent, opcode starts with 'event_', not a shadow
            if (!block.shadow && !block.parent && block.opcode.startsWith('event_')) {
                traverse(block.id);
            }
        });
    });
    return connected;
};

// Returns true if at least one hat block has a child block connected below it.
const hasConnectedScript = function (vm) {
    let found = false;
    vm.runtime.targets.forEach(target => {
        if (found) return;
        const blocks = target.blocks._blocks;
        Object.values(blocks).forEach(block => {
            if (found || block.shadow) return;
            if (!block.parent && block.opcode.startsWith('event_') && block.next) {
                found = true;
            }
        });
    });
    return found;
};

export const verifyCurrentStep = vm => (dispatch, getState) => {
    const state = getState();
    const step = getCurrentStep(state);
    if (!step) return;

    const requiredOpcodes = step.requiredOpcodes || [];
    const isSpriteOnlyStep = requiredOpcodes.length === 0;

    // No hat block with children → workspace empty or blocks are all orphaned
    // Skip this check for sprite-only steps (no required opcodes) — students
    // are only expected to add/remove sprites, not write code.
    if (!isSpriteOnlyStep && !hasConnectedScript(vm)) {
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'incomplete'});
        return;
    }

    // ── Sprite name validation ────────────────────────────────────────────────
    const spriteNames = vm.runtime.targets
        .filter(t => !t.isStage)
        .map(t => t.sprite.name);
    const {requiredRemoveSprites, requiredAddSprites} = step;

    if (Array.isArray(requiredRemoveSprites) && requiredRemoveSprites.length > 0) {
        const stillPresent = requiredRemoveSprites.filter(name => spriteNames.includes(name));
        if (stillPresent.length > 0) {
            const msg = `Remova: ${stillPresent.join(', ')}`;
            dispatch({type: SET_VERIFY_MESSAGE, message: msg});
            dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
            return;
        }
    }

    if (Array.isArray(requiredAddSprites) && requiredAddSprites.length > 0) {
        const missing = requiredAddSprites.filter(name => !spriteNames.includes(name));
        if (missing.length > 0) {
            const msg = `Adicione: ${missing.join(', ')}`;
            dispatch({type: SET_VERIFY_MESSAGE, message: msg});
            dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
            return;
        }
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Sprite count validation ─────────────────────────────────────────────
    // Counts only non-stage targets (sprites).
    // Supports: requiredSpriteCount (exact), minSpriteCount, maxSpriteCount
    const spriteCount = vm.runtime.targets.filter(t => !t.isStage).length;
    const {requiredSpriteCount, minSpriteCount, maxSpriteCount} = step;

    if (typeof requiredSpriteCount === 'number' && spriteCount !== requiredSpriteCount) {
        const diff = spriteCount - requiredSpriteCount;
        const msg = diff > 0
            ? `Seu projeto tem ${spriteCount} personagens, mas esta etapa requer exatamente ${requiredSpriteCount}. Remova ${diff}.`
            : `Seu projeto tem ${spriteCount} personagens, mas esta etapa requer exatamente ${requiredSpriteCount}. Adicione mais ${-diff}.`;
        dispatch({type: SET_VERIFY_MESSAGE, message: msg});
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
        return;
    }
    if (typeof minSpriteCount === 'number' && spriteCount < minSpriteCount) {
        const msg = `Seu projeto tem ${spriteCount} personagens. Adicione pelo menos ${minSpriteCount - spriteCount} mais para continuar.`;
        dispatch({type: SET_VERIFY_MESSAGE, message: msg});
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
        return;
    }
    if (typeof maxSpriteCount === 'number' && spriteCount > maxSpriteCount) {
        const msg = `Seu projeto tem ${spriteCount} personagens. Remova ${spriteCount - maxSpriteCount} para continuar (máximo: ${maxSpriteCount}).`;
        dispatch({type: SET_VERIFY_MESSAGE, message: msg});
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
        return;
    }
    // ───────────────────────────────────────────────────────────────────────

    const required = step.requiredOpcodes || [];
    if (required.length === 0) {
        notifyStepCompleted(dispatch, getState);
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'success'});
        return;
    }

    const present = getConnectedOpcodes(vm);
    const missing = required.filter(opcode => !present.has(opcode));

    if (missing.length === 0) {
        notifyStepCompleted(dispatch, getState);
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'success'});
    } else {
        const missingLabels = missing.map(opcode => {
            const preview = (step.previewBlocks || []).find(b => b.opcode === opcode);
            return preview ? preview.label : opcode;
        });
        const message = `Ainda faltam: ${missingLabels.join(', ')}`;
        dispatch({type: SET_VERIFY_MESSAGE, message});
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'verify'});
    }
};

export const loadActivity = activityId => async dispatch => {
    dispatch({type: LOAD_ACTIVITY_START});
    try {
        const data = await fetchActivity(activityId);
        dispatch({type: LOAD_ACTIVITY_SUCCESS, payload: data});
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'video'});
    } catch (err) {
        dispatch({type: LOAD_ACTIVITY_ERROR, error: err.message});
    }
};
