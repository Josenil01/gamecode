import React from 'react';
import ReactModal from 'react-modal';
import PropTypes from 'prop-types';
import styles from './wrong-block-modal.css';

/**
 * Renderiza um bloco Scratch como SVG inline.
 * Usa dangerouslySetInnerHTML — seguro aqui porque o SVG vem do proprio DOM do workspace
 * (nunca de entrada do usuario). O HTML e' gerado internamente pelo scratch-blocks.
 *
 * AVISO CONHECIDO: referencias `url(#filter)` do workspace principal nao resolvem
 * dentro do modal (filtros definidos em outro SVG). Glows e alguns efeitos ficarao ausentes.
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
    // Fallback para texto quando SVG nao esta disponivel
    return <span className={styles.blockName}>{label}</span>;
};

BlockSvgPreview.propTypes = {
    svgXml: PropTypes.string,
    label: PropTypes.string
};

const WrongBlockModal = function ({
    isOpen, message,
    detectedLabel, suggestedLabel,
    detectedSvgXml, suggestedSvgXml,
    onClose
}) {
    if (!isOpen) return null;

    return (
        <ReactModal
            isOpen={isOpen}
            onRequestClose={onClose}
            className={styles.container}
            overlayClassName={styles.overlay}
            contentLabel="Dica de bloco"
        >
            <div className={styles.header}>
                <span className={styles.title}>{'Quase la!'}</span>
            </div>
            <div className={styles.body}>
                <p className={styles.message}>
                    {message || 'Parece que voce usou um bloco diferente do esperado para esta atividade.'}
                </p>
                {(detectedLabel || detectedSvgXml) && (suggestedLabel || suggestedSvgXml) ? (
                    <div className={styles.comparison}>
                        <div className={[styles.blockTag, styles.wrong].join(' ')}>
                            <span className={styles.blockTagLabel}>{'Voce usou'}</span>
                            <BlockSvgPreview svgXml={detectedSvgXml} label={detectedLabel} />
                        </div>
                        <span className={styles.arrow}>{'\u2192'}</span>
                        <div className={[styles.blockTag, styles.suggested].join(' ')}>
                            <span className={styles.blockTagLabel}>{'Experimente'}</span>
                            <BlockSvgPreview svgXml={suggestedSvgXml} label={suggestedLabel} />
                        </div>
                    </div>
                ) : null}
            </div>
            <div className={styles.footer}>
                <button
                    className={styles.okButton}
                    onClick={onClose}
                >
                    {'Entendi!'}
                </button>
            </div>
        </ReactModal>
    );
};

WrongBlockModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    message: PropTypes.string,
    detectedLabel: PropTypes.string,
    suggestedLabel: PropTypes.string,
    detectedSvgXml: PropTypes.string,
    suggestedSvgXml: PropTypes.string,
    onClose: PropTypes.func.isRequired
};

WrongBlockModal.defaultProps = {
    message: '',
    detectedLabel: '',
    suggestedLabel: '',
    detectedSvgXml: null,
    suggestedSvgXml: null
};

export default WrongBlockModal;
