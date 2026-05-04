const SHOW_BLOCK_HINT = 'scratch-gui/block-hint/SHOW_BLOCK_HINT';
const HIDE_BLOCK_HINT = 'scratch-gui/block-hint/HIDE_BLOCK_HINT';

const initialState = {
    isOpen: false,
    detectedOpcode: null,
    detectedLabel: null,
    message: null,
    suggestedOpcode: null,
    suggestedLabel: null,
    // [SVG-B] SVG clonado do workspace/flyout. null = fallback para label de texto.
    detectedSvgXml: null,
    suggestedSvgXml: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SHOW_BLOCK_HINT:
        return {
            isOpen: true,
            detectedOpcode: action.detectedOpcode,
            detectedLabel: action.detectedLabel,
            message: action.message,
            suggestedOpcode: action.suggestedOpcode,
            suggestedLabel: action.suggestedLabel,
            detectedSvgXml: action.detectedSvgXml || null,
            suggestedSvgXml: action.suggestedSvgXml || null
        };
    case HIDE_BLOCK_HINT:
        return Object.assign({}, state, {isOpen: false});
    default:
        return state;
    }
};

const showBlockHint = function (hint) {
    return Object.assign({type: SHOW_BLOCK_HINT}, hint);
};

const hideBlockHint = function () {
    return {type: HIDE_BLOCK_HINT};
};

export {
    reducer as default,
    initialState as blockHintInitialState,
    showBlockHint,
    hideBlockHint
};
