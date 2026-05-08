import React, {useEffect, useState} from 'react';
import ReactModal from 'react-modal';
import PropTypes from 'prop-types';
import styles from './activity-modal.css';
import BlockSvgPreview from '../block-svg-preview/block-svg-preview';

// Extrai o ID de URLs YouTube embed ou watch
const getYouTubeVideoId = url => {
    if (!url) return null;
    const m = url.match(/youtube\.com\/(?:embed\/|watch\?v=)([^?&#/]+)|youtu\.be\/([^?&#/]+)/);
    return m ? (m[1] || m[2]) : null;
};

// Build a stable embed URL that works even when YouTube IFrame API is blocked.
const getYouTubeEmbedUrl = videoId =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`;

const SLIDE_TITLES = {
    video: 'Atividade',
    instruction: 'Instruções',
    verify: 'Verificar',
    success: 'Parabéns!',
    incomplete: 'Ops!'
};

const HEADER_STYLES = {
    video: styles.headerVideo,
    instruction: styles.headerInstruction,
    verify: styles.headerVerify,
    success: styles.headerSuccess,
    incomplete: styles.headerIncomplete
};

const ActivityModal = function ({
    isOpen,
    slide,
    currentStep,
    isLastStep,
    lastVerifyMessage,
    previewBlockSvgs,
    onClose,
    onSetSlide,
    onAdvanceStep,
    onRequestCaptureBlockPreviews
}) {
    // When slide is 'video' but step has no videoUrl, skip directly to instruction.
    // Also request capture here since "Começar" will never be shown.
    useEffect(() => {
        if (isOpen && slide === 'video' && currentStep && !currentStep.videoUrl) {
            if (onRequestCaptureBlockPreviews) onRequestCaptureBlockPreviews();
            onSetSlide('instruction');
        }
    }, [isOpen, slide, currentStep, onSetSlide, onRequestCaptureBlockPreviews]);

    // ── Block-ready gate ──────────────────────────────────────────────────────
    // Keep modal visually hidden until two animation frames confirm the SVGs
    // have been painted. Hooks must come before any early return.
    const hasBlockPreviews = slide === 'instruction' && currentStep && (
        (previewBlockSvgs && previewBlockSvgs.length > 0) ||
        ((currentStep.previewBlocks || []).length > 0)
    );
    const [blocksReady, setBlocksReady] = useState(false);
    useEffect(() => {
        if (!isOpen || slide !== 'instruction') {
            setBlocksReady(false);
            return;
        }
        if (!hasBlockPreviews) {
            setBlocksReady(true);
            return;
        }
        // Double-RAF: first frame → DOM nodes exist; second frame → browser painted
        let raf2;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setBlocksReady(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [isOpen, slide, hasBlockPreviews]);
    // ─────────────────────────────────────────────────────────────────────────

    const handleGoToInstruction = function () {
        if (onRequestCaptureBlockPreviews) onRequestCaptureBlockPreviews();
        onSetSlide('instruction');
    };
    const handleNextStep = function () {
        onAdvanceStep(); onSetSlide('video');
    };

    if (!currentStep) return null;

    const renderBody = function () {
        if (slide === 'video') {
            if (!currentStep.videoUrl) return null;
            const videoId = getYouTubeVideoId(currentStep.videoUrl);
            if (videoId) {
                // Use embed iframe directly so video still loads if YouTube API script is blocked.
                return (
                    <iframe
                        className={styles.video}
                        src={getYouTubeEmbedUrl(videoId)}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        title="Video da atividade"
                    />
                );
            }
            return (
                <iframe
                    className={styles.video}
                    src={currentStep.videoUrl}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title="Video da atividade"
                />
            );
        }
        if (slide === 'instruction') {
            const stepBlocks = currentStep.previewBlocks || [];
            const svgByOpcode = new Map(
                (previewBlockSvgs || []).map(item => [item.opcode, item.svgXml || null])
            );
            return (
                <div>
                    <p className={styles.instructions}>{currentStep.instructions}</p>
                    {stepBlocks.length > 0 && (
                        <div className={styles.blockPreviewList}>
                            {stepBlocks.map(b => (
                                <div
                                    key={b.opcode}
                                    className={styles.blockPreview}
                                >
                                    <BlockSvgPreview
                                        svgXml={svgByOpcode.get(b.opcode) || null}
                                        label={b.label}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        if (slide === 'verify') {
            return (
                <div>
                    {lastVerifyMessage ? (
                        <p className={styles.verifyErrorText}>{lastVerifyMessage}</p>
                    ) : null}
                    <p className={styles.verifyText}>
                        {'Revise seu c\u00f3digo e clique em \u26a0 para tentar novamente.'}
                    </p>
                </div>
            );
        }
        if (slide === 'success') {
            const customMsg = currentStep.successMessage;
            const fallbackMsg = isLastStep ?
                'Incrível! Você concluiu toda a atividade!' :
                'Muito bem! Você completou esta etapa!';
            const displayMsg = customMsg || fallbackMsg;
            return (
                <p className={styles.successText}>
                    {displayMsg}
                </p>
            );
        }
        if (slide === 'incomplete') {
            return (
                <p className={styles.incompleteText}>
                    {'Seus blocos precisam estar conectados a um evento ' +
                    '(como \u201cQuando a bandeira verde for clicada\u201d) ' +
                    'para que o programa funcione. Conecte os blocos e tente novamente!'}
                </p>
            );
        }
        return null;
    };

    const renderFooter = function () {
        if (slide === 'video') {
            return (
                <button
                    className={styles.primaryButton}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={handleGoToInstruction}
                >
                    {'Começar'}
                </button>
            );
        }
        if (slide === 'instruction') {
            const goToNextStep = Boolean(currentStep.nextStepButton);
            return (
                <button
                    className={styles.primaryButton}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={goToNextStep ? handleNextStep : onClose}
                >
                    {goToNextStep ? 'Ir para a próxima etapa' : 'Fechar e programar'}
                </button>
            );
        }
        if (slide === 'verify') {
            return (
                <button
                    className={styles.secondaryButton}
                    onClick={onClose}
                >
                    {'Continuar programando'}
                </button>
            );
        }
        if (slide === 'success') {
            if (isLastStep) {
                return (
                    <button
                        className={styles.primaryButton}
                        onClick={onClose}
                    >
                        {'Concluir atividade'}
                    </button>
                );
            }
            return (
                <button
                    className={styles.primaryButton}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={handleNextStep}
                >
                    {'Próxima etapa'}
                </button>
            );
        }
        if (slide === 'incomplete') {
            return (
                <button
                    className={styles.secondaryButton}
                    onClick={onClose}
                >
                    {'Continuar programando'}
                </button>
            );
        }
        return null;
    };

    const waitingForBlocks = hasBlockPreviews && !blocksReady;

    return (
        <ReactModal
            isOpen={isOpen}
            onRequestClose={onClose}
            closeTimeoutMS={220}
            className={[styles.container, waitingForBlocks ? styles.invisible : ''].join(' ')}
            overlayClassName={[styles.overlay, waitingForBlocks ? styles.invisible : ''].join(' ')}
            contentLabel={SLIDE_TITLES[slide] || 'Atividade'}
        >
            <div className={[styles.header, HEADER_STYLES[slide]].join(' ')}>
                <span className={styles.title}>{SLIDE_TITLES[slide]}</span>
            </div>
            <div
                key={slide}
                className={styles.body}
            >
                {renderBody()}
            </div>
            <div
                key={`footer-${slide}`}
                className={styles.footer}
            >
                {renderFooter()}
            </div>
        </ReactModal>
    );
};

ActivityModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    slide: PropTypes.oneOf(['video', 'instruction', 'verify', 'success']).isRequired,
    currentStep: PropTypes.shape({
        videoUrl: PropTypes.string,
        instructions: PropTypes.string,
        successMessage: PropTypes.string,
        nextStepButton: PropTypes.bool,
        previewBlocks: PropTypes.arrayOf(PropTypes.shape({
            opcode: PropTypes.string,
            label: PropTypes.string
        }))
    }),
    isLastStep: PropTypes.bool.isRequired,
    lastVerifyMessage: PropTypes.string,
    previewBlockSvgs: PropTypes.arrayOf(PropTypes.shape({
        opcode: PropTypes.string,
        label: PropTypes.string,
        svgXml: PropTypes.string
    })),
    onClose: PropTypes.func.isRequired,
    onSetSlide: PropTypes.func.isRequired,
    onAdvanceStep: PropTypes.func.isRequired,
    onRequestCaptureBlockPreviews: PropTypes.func
};

ActivityModal.defaultProps = {
    currentStep: null,
    lastVerifyMessage: null,
    previewBlockSvgs: null,
    onRequestCaptureBlockPreviews: null
};

export default ActivityModal;
