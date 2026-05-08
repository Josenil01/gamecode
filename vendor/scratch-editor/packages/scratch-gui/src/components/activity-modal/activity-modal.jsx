import React, {useEffect, useRef} from 'react';
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

// Carrega a YouTube IFrame API uma única vez e notifica todos os callbacks
const _ytCallbacks = [];
const _loadYouTubeAPI = cb => {
    if (window.YT && window.YT.Player) { cb(); return; }
    _ytCallbacks.push(cb);
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        _ytCallbacks.splice(0).forEach(fn => fn());
    };
};

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
    const ytPlayerRef = useRef(null);
    const ytContainerRef = useRef(null);

    // When slide is 'video' but step has no videoUrl, skip directly to instruction.
    // Also request capture here since "Começar" will never be shown.
    useEffect(() => {
        if (isOpen && slide === 'video' && currentStep && !currentStep.videoUrl) {
            if (onRequestCaptureBlockPreviews) onRequestCaptureBlockPreviews();
            onSetSlide('instruction');
        }
    }, [isOpen, slide, currentStep, onSetSlide, onRequestCaptureBlockPreviews]);

    // YouTube player: autoplay ao abrir, volta ao thumbnail ao terminar
    useEffect(() => {
        if (!isOpen || slide !== 'video' || !currentStep) return;
        const videoId = getYouTubeVideoId(currentStep.videoUrl);
        if (!videoId || !ytContainerRef.current) return;

        const initPlayer = () => {
            if (ytPlayerRef.current) {
                ytPlayerRef.current.destroy();
                ytPlayerRef.current = null;
            }
            // Cria um div filho para o YouTube substituir (evita conflito com React)
            ytContainerRef.current.innerHTML = '';
            const target = document.createElement('div');
            ytContainerRef.current.appendChild(target);

            ytPlayerRef.current = new window.YT.Player(target, {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: {autoplay: 1, rel: 0, modestbranding: 1},
                events: {
                    onStateChange: event => {
                        // Ao terminar: volta ao início e pausa (mostra thumbnail)
                        if (event.data === window.YT.PlayerState.ENDED) {
                            event.target.seekTo(0);
                            event.target.pauseVideo();
                        }
                    }
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            _loadYouTubeAPI(initPlayer);
        }

        return () => {
            if (ytPlayerRef.current) {
                ytPlayerRef.current.destroy();
                ytPlayerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, slide, currentStep && currentStep.videoUrl]);

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
                // Container gerenciado pelo React; o YouTube API cria o iframe dentro
                return (
                    <div
                        ref={ytContainerRef}
                        className={styles.video}
                    />
                );
            }
            return (
                <iframe
                    className={styles.video}
                    src={currentStep.videoUrl}
                    allowFullScreen
                    title="Video da atividade"
                />
            );
        }
        if (slide === 'instruction') {
            const svgsToUse = (previewBlockSvgs && previewBlockSvgs.length > 0) ?
                previewBlockSvgs :
                null;
            const fallbackBlocks = currentStep.previewBlocks || [];
            return (
                <div>
                    <p className={styles.instructions}>{currentStep.instructions}</p>
                    {(svgsToUse || fallbackBlocks.length > 0) && (
                        <div className={styles.blockPreviewList}>
                            {svgsToUse ? (
                                svgsToUse.map(b => (
                                    <div
                                        key={b.opcode}
                                        className={styles.blockPreview}
                                    >
                                        <BlockSvgPreview
                                            svgXml={b.svgXml}
                                            label={b.label}
                                        />
                                    </div>
                                ))
                            ) : (
                                fallbackBlocks.map(b => (
                                    <div
                                        key={b.opcode}
                                        className={styles.blockPreview}
                                    >
                                        <span className={styles.blockLabel}>{b.label}</span>
                                    </div>
                                ))
                            )}
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
            return (
                <p className={styles.successText}>
                    {isLastStep ?
                        'Incrível! Você concluiu toda a atividade!' :
                        'Muito bem! Você completou esta etapa!'}
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
            return (
                <button
                    className={styles.primaryButton}
                    onClick={onClose}
                >
                    {'Fechar e programar'}
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

    return (
        <ReactModal
            isOpen={isOpen}
            onRequestClose={onClose}
            className={styles.container}
            overlayClassName={styles.overlay}
            contentLabel={SLIDE_TITLES[slide] || 'Atividade'}
        >
            <div className={[styles.header, HEADER_STYLES[slide]].join(' ')}>
                <span className={styles.title}>{SLIDE_TITLES[slide]}</span>
            </div>
            <div className={styles.body}>
                {renderBody()}
            </div>
            <div className={styles.footer}>
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
