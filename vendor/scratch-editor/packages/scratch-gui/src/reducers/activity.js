export const LOAD_ACTIVITY_START = 'scratch-gui/activity/LOAD_ACTIVITY_START';
export const LOAD_ACTIVITY_SUCCESS = 'scratch-gui/activity/LOAD_ACTIVITY_SUCCESS';
export const LOAD_ACTIVITY_ERROR = 'scratch-gui/activity/LOAD_ACTIVITY_ERROR';
export const ADVANCE_STEP = 'scratch-gui/activity/ADVANCE_STEP';
export const RESET_ACTIVITY = 'scratch-gui/activity/RESET_ACTIVITY';
export const SET_VERIFY_MESSAGE = 'scratch-gui/activity/SET_VERIFY_MESSAGE';
export const SET_PREVIEW_BLOCK_SVGS = 'scratch-gui/activity/SET_PREVIEW_BLOCK_SVGS';
export const REQUEST_CAPTURE_PREVIEWS = 'scratch-gui/activity/REQUEST_CAPTURE_PREVIEWS';

export const activityInitialState = {
    activityId: null,
    title: null,
    steps: [],
    currentStepIndex: 0,
    status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    error: null,
    lastVerifyMessage: null,
    previewBlockSvgs: [],
    captureRequestSeq: 0
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = activityInitialState;
    switch (action.type) {
    case LOAD_ACTIVITY_START:
        return Object.assign({}, state, {status: 'loading', error: null});
    case LOAD_ACTIVITY_SUCCESS:
        return Object.assign({}, state, {
            activityId: action.payload.activityId,
            title: action.payload.title,
            steps: action.payload.steps,
            currentStepIndex: 0,
            status: 'ready',
            error: null
        });
    case LOAD_ACTIVITY_ERROR:
        return Object.assign({}, state, {status: 'error', error: action.error});
    case ADVANCE_STEP:
        return Object.assign({}, state, {
            currentStepIndex: Math.min(state.currentStepIndex + 1, state.steps.length - 1),
            lastVerifyMessage: null,
            previewBlockSvgs: []
        });
    case SET_VERIFY_MESSAGE:
        return Object.assign({}, state, {lastVerifyMessage: action.message});
    case SET_PREVIEW_BLOCK_SVGS:
        return Object.assign({}, state, {previewBlockSvgs: action.payload});
    case REQUEST_CAPTURE_PREVIEWS:
        return Object.assign({}, state, {captureRequestSeq: state.captureRequestSeq + 1});
    case RESET_ACTIVITY:
        return activityInitialState;
    default:
        return state;
    }
};

export const getCurrentStep = function (state) {
    const activity = state.scratchGui.activity;
    return activity.steps[activity.currentStepIndex] ?? null;
};

export const isLastStep = function (state) {
    const {steps, currentStepIndex} = state.scratchGui.activity;
    return currentStepIndex >= steps.length - 1;
};

export default reducer;
