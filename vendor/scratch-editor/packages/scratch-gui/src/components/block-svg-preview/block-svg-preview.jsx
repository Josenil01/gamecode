import React from 'react';
import PropTypes from 'prop-types';
import styles from './block-svg-preview.css';

/**
 * Renders a Scratch block as an inline SVG.
 * Uses dangerouslySetInnerHTML — safe here because the SVG originates from
 * the workspace DOM (never from user input).
 *
 * KNOWN LIMITATION: url(#filter) references from the parent workspace SVG
 * will not resolve here — glows and some effects will be absent.
 * @param root0
 * @param root0.svgXml
 * @param root0.label
 */
const BlockSvgPreview = function ({svgXml, label}) {
    if (svgXml) {
        return (
            <div
                className={styles.svgPreview}
                /* eslint-disable-next-line react/no-danger */
                dangerouslySetInnerHTML={{__html: svgXml}}
            />
        );
    }
    return <span className={styles.blockName}>{label}</span>;
};

BlockSvgPreview.propTypes = {
    svgXml: PropTypes.string,
    label: PropTypes.string
};

export default BlockSvgPreview;
