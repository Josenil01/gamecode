import {fetchActivity} from '../lib/activity-api';
import {
    LOAD_ACTIVITY_START,
    LOAD_ACTIVITY_SUCCESS,
    LOAD_ACTIVITY_ERROR,
    SET_VERIFY_MESSAGE,
    getCurrentStep
} from './activity';
import {OPEN_ACTIVITY_MODAL} from './activity-modal';

// Collects opcodes reachable from a hat block chain (ignores orphan/shadow blocks).
const getConnectedOpcodes = function (vm) {
    const connected = new Set();
    vm.runtime.targets.forEach(target => {
        const blocks = target.blocks._blocks;
        const traverse = function (blockId) {
            const b = blocks[blockId];
            if (!b || b.shadow) return;
            connected.add(b.opcode);
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

    // No hat block with children → workspace empty or blocks are all orphaned
    if (!hasConnectedScript(vm)) {
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'incomplete'});
        return;
    }

    const required = step.requiredOpcodes || [];
    if (required.length === 0) {
        dispatch({type: OPEN_ACTIVITY_MODAL, slide: 'success'});
        return;
    }

    const present = getConnectedOpcodes(vm);
    const missing = required.filter(opcode => !present.has(opcode));

    if (missing.length === 0) {
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
