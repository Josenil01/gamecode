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
        motion: 'motion',
        looks: 'looks',
        sound: 'sound',
        event: 'events',
        control: 'control',
        sensing: 'sensing',
        operator: 'operators',
        data: 'variables',
        procedures: 'myBlocks'
    };
    return map[prefix] || null;
};

export {getCategoryForOpcode};
