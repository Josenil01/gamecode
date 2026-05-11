/**
 * Returns the toolboxitemid of the category that owns the given opcode.
 * Based on standard scratch-blocks opcode prefixes.
 * @param {string} opcode
 * @returns {string|null}
 */
const getCategoryForOpcode = function (opcode) {
    if (!opcode) return null;
    const prefix = opcode.split('_')[0];
    const map = {
        // Core categories
        motion: 'motion',
        looks: 'looks',
        sound: 'sound',
        event: 'events',
        control: 'control',
        sensing: 'sensing',
        operator: 'operators',
        data: 'variables',
        procedures: 'myBlocks',
        // Extension categories
        pen: 'pen',
        music: 'music',
        text2speech: 'text2speech',
        translate: 'translate',
        speech2text: 'speech2text',
        videoSensing: 'videoSensing',
        microbit: 'microbit',
        makeymakey: 'makeymakey',
        boost: 'boost',
        wedo2: 'wedo2',
        ev3: 'ev3',
        gdxfor: 'gdxfor',
        faceSensing: 'faceSensing'
    };
    return map[prefix] || null;
};

export {getCategoryForOpcode};
