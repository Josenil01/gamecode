export const OPEN_ACTIVITY_MODAL = 'scratch-gui/activity-modal/OPEN_ACTIVITY_MODAL';
export const CLOSE_ACTIVITY_MODAL = 'scratch-gui/activity-modal/CLOSE_ACTIVITY_MODAL';
export const SET_ACTIVITY_MODAL_SLIDE = 'scratch-gui/activity-modal/SET_ACTIVITY_MODAL_SLIDE';

export const activityModalInitialState = {
    isOpen: false,
    slide: 'video' // 'video' | 'instruction' | 'verify' | 'success'
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = activityModalInitialState;
    switch (action.type) {
    case OPEN_ACTIVITY_MODAL:
        return Object.assign({}, state, {
            isOpen: true,
            slide: action.slide || 'video'
        });
    case CLOSE_ACTIVITY_MODAL:
        return Object.assign({}, state, {isOpen: false});
    case SET_ACTIVITY_MODAL_SLIDE:
        return Object.assign({}, state, {slide: action.slide});
    default:
        return state;
    }
};

export const openActivityModal = function (slide) {
    return {type: OPEN_ACTIVITY_MODAL, slide: slide || 'video'};
};

export const closeActivityModal = function () {
    return {type: CLOSE_ACTIVITY_MODAL};
};

export const setActivityModalSlide = function (slide) {
    return {type: SET_ACTIVITY_MODAL_SLIDE, slide};
};

export default reducer;
