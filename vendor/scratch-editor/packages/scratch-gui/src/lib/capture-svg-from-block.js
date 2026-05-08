/**
 * Captures the SVG of a live Scratch block from the DOM.
 * Clones the block's SVG root, strips its workspace transform, and wraps it
 * in a standalone <svg> with a tight viewBox.
 *
 * KNOWN LIMITATION: url(#filterId) references from the parent workspace SVG
 * will not resolve inside the standalone SVG — glow effects will be absent.
 * @param {ScratchBlocks.BlockSvg} block
 * @returns {string|null} SVG string, or null on failure
 */
const captureSvgFromBlock = function (block) {
    if (!block || typeof block.getSvgRoot !== 'function') return null;
    const svgRoot = block.getSvgRoot();
    if (!svgRoot) return null;
    try {
        // getBBox() must be called on the live element (before cloning)
        let bbox = null;
        try {
            bbox = svgRoot.getBBox();
        } catch (bboxErr) {
            // Element may be off-screen or not yet rendered
        }
        // Clone to avoid modifying the live DOM
        const clone = svgRoot.cloneNode(true);
        // Remove the absolute-position workspace transform (e.g. translate(320, 450))
        clone.removeAttribute('transform');
        const pad = 6;
        const vx = bbox ? (bbox.x - pad) : -pad;
        const vy = bbox ? (bbox.y - pad) : -pad;
        const vw = bbox ? (bbox.width + (pad * 2)) : 220;
        const vh = bbox ? (bbox.height + (pad * 2)) : 60;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg"` +
            ` width="${Math.ceil(vw)}" height="${Math.ceil(vh)}"` +
            ` viewBox="${vx} ${vy} ${vw} ${vh}">${
                clone.outerHTML
            }</svg>`;
        return svgStr;
    } catch (err) {
        return null;
    }
};

export default captureSvgFromBlock;
