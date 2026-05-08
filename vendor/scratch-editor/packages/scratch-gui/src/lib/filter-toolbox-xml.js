import {getCategoryForOpcode} from './opcode-category-map';

/**
 * Filters toolbox XML by allowed categories and/or allowed opcodes.
 *
 * Categories are identified by the `toolboxitemid` attribute (scratch-blocks convention).
 * The toolbox uses "Form A" — empty categories filled automatically by scratch-blocks.
 * This function only removes whole categories; individual block filtering happens in
 * the flyout DOM (see filterFlyoutBlocks in blocks.jsx).
 *
 * A category is removed when:
 *  1. It is not in allowedCategories (if provided), OR
 *  2. allowedOpcodes is provided and none of the allowedOpcodes belong to this category
 *     (prevents showing an empty flyout for that category).
 * @param {string} toolboxXML - full original XML string
 * @param {string[] | null} allowedCategories - allowed toolboxitemid values; null = all
 * @param {string[] | null} allowedOpcodes    - allowed opcode strings; null = all
 * @returns {string} filtered XML string
 */
const filterToolboxXML = function (toolboxXML, allowedCategories, allowedOpcodes) {
    if (!allowedCategories && !allowedOpcodes) return toolboxXML;
    if (!toolboxXML) return toolboxXML;

    const parser = new DOMParser();
    const doc = parser.parseFromString(toolboxXML, 'text/xml');

    // Abort on parse error rather than returning broken XML
    if (doc.querySelector('parsererror')) return toolboxXML;

    const categories = doc.querySelectorAll('category');
    const allowedSet = Array.isArray(allowedOpcodes) ? new Set(allowedOpcodes) : null;

    const cleanCategoryNodes = function (cat) {
        if (!allowedSet) return;

        // Remove all block nodes not explicitly allowed.
        Array.from(cat.querySelectorAll('block')).forEach(block => {
            const type = block.getAttribute('type');
            if (!type || !allowedSet.has(type)) {
                block.parentNode.removeChild(block);
            }
        });

        // Remove separators when there is no block around them in the same category,
        // preventing visual gaps in the flyout.
        const children = Array.from(cat.children);
        children.forEach((node, idx) => {
            if (node.tagName !== 'sep') return;
            const prevBlock = children.slice(0, idx).reverse().find(n => n.tagName === 'block');
            const nextBlock = children.slice(idx + 1).find(n => n.tagName === 'block');
            if (!prevBlock || !nextBlock) {
                node.parentNode.removeChild(node);
            }
        });
    };

    categories.forEach(cat => {
        // scratch-blocks uses `toolboxitemid` — not `id` or `name`
        const catId = (cat.getAttribute('toolboxitemid') || '').toLowerCase();

        // Rule 1: remove if category not in allowedCategories
        if (allowedCategories && catId && !allowedCategories.includes(catId)) {
            cat.parentNode.removeChild(cat);
            return;
        }

        // Rule 2: remove if no allowed opcode belongs to this category
        // (avoids showing a flyout with zero valid blocks)
        if (allowedOpcodes && allowedOpcodes.length > 0 && catId) {
            const hasAny = allowedOpcodes.some(
                op => (getCategoryForOpcode(op) || '').toLowerCase() === catId
            );
            if (!hasAny) {
                cat.parentNode.removeChild(cat);
                return;
            }
        }

        cleanCategoryNodes(cat);
    });

    // Serialize documentElement to avoid XMLSerializer prepending <?xml?> declaration
    const result = new XMLSerializer().serializeToString(doc.documentElement);
    // XMLSerializer may inject xmlns="" on the root element in some browsers — strip it
    return result.replace(/ xmlns=""/g, '');
};

export {filterToolboxXML};
