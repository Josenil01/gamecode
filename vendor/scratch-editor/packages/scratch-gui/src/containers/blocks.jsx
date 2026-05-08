import bindAll from 'lodash.bindall';
import debounce from 'lodash.debounce';
import defaultsDeep from 'lodash.defaultsdeep';
import makeToolboxXML from '../lib/make-toolbox-xml';
import {filterToolboxXML} from '../lib/filter-toolbox-xml';
import captureSvgFromBlock from '../lib/capture-svg-from-block';
import {getCurrentStep, SET_PREVIEW_BLOCK_SVGS} from '../reducers/activity';
import {verifyCurrentStep} from '../reducers/activity-actions';
import {CLOSE_ACTIVITY_MODAL} from '../reducers/activity-modal';
import PropTypes from 'prop-types';
import React from 'react';
import VMScratchBlocks from '../lib/blocks';
import VM from '@scratch/scratch-vm';

import analytics from '../lib/analytics';
import log from '../lib/log.js';
import Prompt from './prompt.jsx';
import BlocksComponent from '../components/blocks/blocks.jsx';
import ExtensionLibrary from './extension-library.jsx';
import extensionData from '../lib/libraries/extensions/index.jsx';
import CustomProcedures from './custom-procedures.jsx';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {BLOCKS_DEFAULT_SCALE, STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import DropAreaHOC from '../lib/drop-area-hoc.jsx';
import DragConstants from '../lib/drag-constants';
import defineDynamicBlock from '../lib/define-dynamic-block';
import {DEFAULT_MODE, getColorsForMode, colorModeMap} from '../lib/settings/color-mode';
import {CAT_BLOCKS_THEME} from '../lib/settings/theme';
import {
    injectExtensionBlockIcons,
    injectExtensionCategoryMode,
    getExtensionColors
} from '../lib/settings/color-mode/blockHelpers';

import {connect} from 'react-redux';
import {updateToolbox} from '../reducers/toolbox';
import {activateColorPicker} from '../reducers/color-picker';
import {closeExtensionLibrary, openSoundRecorder, openConnectionModal} from '../reducers/modals';
import {activateCustomProcedures, deactivateCustomProcedures} from '../reducers/custom-procedures';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';
import {updateMetrics} from '../reducers/workspace-metrics';
import {isTimeTravel2020} from '../reducers/time-travel';
import {showBlockHint} from '../reducers/block-hint';
import {validateBlockEvent, validateWrongOpcode} from '../lib/block-validator.js';

import {
    activateTab,
    SOUNDS_TAB_INDEX
} from '../reducers/editor-tab';

const addFunctionListener = (object, property, callback) => {
    const oldFn = object[property];
    object[property] = function (...args) {
        const result = oldFn.apply(this, args);
        callback.apply(this, result);
        return result;
    };
};

const DroppableBlocks = DropAreaHOC([
    DragConstants.BACKPACK_CODE
])(BlocksComponent);

import {getCategoryForOpcode} from '../lib/opcode-category-map';

// Maps opcode prefix → toolbox category toolboxitemid (kept for captureStepPreviews)
const OPCODE_CATEGORY_MAP = {
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

class Blocks extends React.Component {
    constructor (props) {
        super(props);
        this.ScratchBlocks = VMScratchBlocks(props.vm);
        bindAll(this, [
            'attachVM',
            'detachVM',
            'handleBlockValidation',
            'tryShowBlockHint',
            'syncKnownWorkspaceBlockIds',
            'getHintFromWorkspaceDelta',
            'getToolboxXML',
            'handleCategorySelected',
            'handleConnectionModalStart',
            'handleDrop',
            'handleStatusButtonUpdate',
            'handleOpenSoundRecorder',
            'handlePromptStart',
            'handlePromptCallback',
            'handlePromptClose',
            'handleCustomProceduresClose',
            'onScriptGlowOn',
            'onScriptGlowOff',
            'onBlockGlowOn',
            'onBlockGlowOff',
            'handleMonitorsUpdate',
            'handleExtensionAdded',
            'handleBlocksInfoUpdate',
            'onTargetsUpdate',
            'onVisualReport',
            'onWorkspaceUpdate',
            'onWorkspaceMetricsChange',
            'setBlocks',
            'setLocale',
            'handleProjectRunStop',
            'captureStepPreviews',
            'filterFlyoutBlocks',
            'selectDefaultToolboxCategory'
        ]);
        this.ScratchBlocks.dialog.setPrompt(this.handlePromptStart);
        this.ScratchBlocks.ScratchVariables.setPromptHandler(
            this.handlePromptStart
        );
        this.ScratchBlocks.StatusIndicatorLabel.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.state = {
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
        this.toolboxUpdateQueue = [];
        this._lastBlockHintOpcode = null;
        this._lastBlockHintShownAt = 0;
        this._knownWorkspaceBlockIds = new Set();
        this._knownSnapshotTargetId = null;
        this._hasPrimedWorkspaceSnapshot = false;
        this._pendingHintBlockId = null;
    }
    componentDidMount () {
        this.ScratchBlocks = VMScratchBlocks(this.props.vm, this.props.useCatBlocks);
        this.ScratchBlocks.dialog.setPrompt(this.handlePromptStart);
        this.ScratchBlocks.StatusIndicatorLabel.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.ScratchBlocks.FieldColourSlider.activateEyedropper_ = this.props.onActivateColorPicker;
        this.ScratchBlocks.ScratchProcedures.externalProcedureDefCallback = this.props.onActivateCustomProcedures;
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        const workspaceConfig = defaultsDeep({},
            Blocks.defaultOptions,
            this.props.options,
            {
                rtl: this.props.isRtl,
                toolbox: this.props.toolboxXML,
                theme: new this.ScratchBlocks.Theme(
                    this.props.colorMode,
                    getColorsForMode(this.props.colorMode)
                ),
                // TODO: use scratch-blocks constants instead of bare strings
                scratchTheme: this.props.useCatBlocks ? 'catblocks' : 'classic'
            }
        );
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);
        this.workspace.registerToolboxCategoryCallback(
            'VARIABLE',
            this.ScratchBlocks.ScratchVariables.getVariablesCategory
        );
        this.workspace.registerToolboxCategoryCallback(
            'PROCEDURE',
            this.ScratchBlocks.ScratchProcedures.getProceduresCategory
        );

        this.toolboxUpdateChangeListener = (event) => {
            if (
                event.type === this.ScratchBlocks.Events.VAR_CREATE ||
                event.type === this.ScratchBlocks.Events.VAR_RENAME ||
                event.type === this.ScratchBlocks.Events.VAR_DELETE ||
                (event.type === this.ScratchBlocks.Events.BLOCK_DELETE &&
                    event.oldJson.type === 'procedures_definition') ||
                // Only refresh the toolbox when procedure block creations are
                // triggered by undoing a deletion (implied by recordUndo being
                // false on the event).
                (event.type === this.ScratchBlocks.Events.BLOCK_CREATE &&
                    event.json.type === 'procedures_definition' &&
                    !event.recordUndo)
            ) {
                this.requestToolboxUpdate();
            }
        };
        this.workspace.addChangeListener(this.toolboxUpdateChangeListener);

        // Register buttons under new callback keys for creating variables,
        // lists, and procedures from extensions.

        const toolboxWorkspace = this.workspace.getFlyout().getWorkspace();

        const varListButtonCallback = (type) =>
            (() => this.ScratchBlocks.ScratchVariables.createVariable(this.workspace, null, type));
        const procButtonCallback = () => {
            this.ScratchBlocks.ScratchProcedures.createProcedureDefCallback(this.workspace);
        };

        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);

        // Store the xml of the toolbox that is actually rendered.
        // This is used in componentDidUpdate instead of prevProps, because
        // the xml can change while e.g. on the costumes tab.
        this._renderedToolboxXML = this.props.toolboxXML;

        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);
        this.selectDefaultToolboxCategory();

        this.attachVM();
        // Only update blocks/vm locale when visible to avoid sizing issues
        // If locale changes while not visible it will get handled in didUpdate
        if (this.props.isVisible) {
            this.setLocale();
        }

        window.addEventListener('load-extension', () => {
            this.props.vm.extensionManager.loadExtensionURL('faceSensing').then(() => {
                this.handleCategorySelected('faceSensing');
            });
        });
    }
    shouldComponentUpdate (nextProps, nextState) {
        return (
            this.state.prompt !== nextState.prompt ||
            this.props.isVisible !== nextProps.isVisible ||
            this._renderedToolboxXML !== nextProps.toolboxXML ||
            this.props.extensionLibraryVisible !== nextProps.extensionLibraryVisible ||
            this.props.customProceduresVisible !== nextProps.customProceduresVisible ||
            this.props.locale !== nextProps.locale ||
            this.props.anyModalVisible !== nextProps.anyModalVisible ||
            this.props.stageSize !== nextProps.stageSize ||
            this.props.activityModalOpen !== nextProps.activityModalOpen ||
            this.props.currentStep !== nextProps.currentStep ||
            this.props.captureRequestSeq !== nextProps.captureRequestSeq ||
            this.props.allowedOpcodes !== nextProps.allowedOpcodes
        );
    }
    componentDidUpdate (prevProps) {
        // Capture SVG previews when the user clicks "Começar" (or auto-skips on no-video
        // steps). REQUEST_CAPTURE_PREVIEWS increments captureRequestSeq, guaranteeing
        // the workspace is already rendered and the toolbox is ready.
        if (this.props.captureRequestSeq !== prevProps.captureRequestSeq) {
            clearTimeout(this._capturePreviewTimeout);
            this._capturePreviewTimeout = setTimeout(this.captureStepPreviews, 100);
        }
        if (this.props.allowedOpcodes !== prevProps.allowedOpcodes) {
            this.requestToolboxUpdate();
            // filterFlyoutBlocks will be called inside runAfterRerender after
            // the toolbox re-renders (see updateToolbox). No separate timeout needed.
        }
        if (this.props.currentStep !== prevProps.currentStep) {
            this.withToolboxUpdates(() => {
                this.selectDefaultToolboxCategory();
            });
        }
        // If any modals are open, call hideChaff to close z-indexed field editors
        if (this.props.anyModalVisible && !prevProps.anyModalVisible) {
            this.ScratchBlocks.hideChaff();
        }

        // Only rerender the toolbox when the blocks are visible and the xml is
        // different from the previously rendered toolbox xml.
        // Do not check against prevProps.toolboxXML because that may not have been rendered.
        if (this.props.isVisible && this.props.toolboxXML !== this._renderedToolboxXML) {
            this.requestToolboxUpdate();
        }

        if (this.props.isVisible === prevProps.isVisible) {
            if (this.props.stageSize !== prevProps.stageSize) {
                // force workspace to redraw for the new stage size
                window.dispatchEvent(new Event('resize'));
            }
            return;
        }
        // @todo hack to resize blockly manually in case resize happened while hidden
        // @todo hack to reload the workspace due to gui bug #413
        if (this.props.isVisible) { // Scripts tab
            this.workspace.setVisible(true);
            if (prevProps.locale !== this.props.locale || this.props.locale !== this.props.vm.getLocale()) {
                // call setLocale if the locale has changed, or changed while the blocks were hidden.
                // vm.getLocale() will be out of sync if locale was changed while not visible
                this.setLocale();
            } else {
                this.props.vm.refreshWorkspace();
            }

            window.dispatchEvent(new Event('resize'));
        } else {
            this.workspace.setVisible(false);
        }
    }
    componentWillUnmount () {
        this.detachVM();
        // Hide any open field editor and move Blockly focus to the workspace
        // root before disposing. Without this, BlockSvg.dispose() detects the
        // focused element is inside a block and schedules a stale
        // setTimeout(() => focusTree(workspace)), which fires after the
        // workspace is unregistered and throws
        // "Attempted to focus unregistered tree" (scratch-blocks#3460).
        //
        // focusNode(workspace) — not focusTree(workspace) — is used here
        // because focusTree would restore focus to whatever was previously
        // focused in this workspace (likely the same block about to be
        // disposed). focusNode pins focus to the workspace root directly,
        // ensuring no block is focused when dispose() runs.
        this.ScratchBlocks.WidgetDiv.hide();
        this.ScratchBlocks.getFocusManager().focusNode(this.workspace);
        this.workspace.dispose();
        clearTimeout(this.toolboxUpdateTimeout);

        // Clear the flyout blocks so that they can be recreated on mount.
        this.props.vm.clearFlyoutBlocks();
    }
    requestToolboxUpdate () {
        clearTimeout(this.toolboxUpdateTimeout);
        this.toolboxUpdateTimeout = setTimeout(() => {
            this.updateToolbox();
        }, 0);
    }
    setLocale () {
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);
        this.props.vm.setLocale(this.props.locale, this.props.messages)
            .then(() => {
                this.workspace.getFlyout().setRecyclingEnabled(false);
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
                this.withToolboxUpdates(() => {
                    this.workspace.getFlyout().setRecyclingEnabled(true);
                });
            });
    }

    updateToolbox () {
        this.toolboxUpdateTimeout = false;

        const scale = this.workspace.getFlyout().getWorkspace().scale;
        const selectedCategoryName = this.workspace
            .getToolbox()
            .getSelectedItem()
            .getName();
        const selectedCategoryScrollPosition =
            this.workspace
                .getFlyout()
                .getCategoryScrollPosition(selectedCategoryName) * scale;
        const offsetWithinCategory =
            this.workspace.getFlyout().getWorkspace()
                .getMetrics().viewTop -
            selectedCategoryScrollPosition;

        this.workspace.updateToolbox(this.props.toolboxXML);
        this.workspace.getToolbox().runAfterRerender(() => {
            const newCategoryScrollPosition = this.workspace
                .getFlyout()
                .getCategoryScrollPosition(selectedCategoryName);
            if (newCategoryScrollPosition) {
                this.workspace
                    .getFlyout()
                    .getWorkspace()
                    .scrollbar.setY(
                        (newCategoryScrollPosition * scale) + offsetWithinCategory
                    );
            }
            // Re-apply flyout block filter after the toolbox re-renders,
            // since forceRerender() recreates block SVGs and clears display style.
            this.filterFlyoutBlocks();
        });
        this.workspace.getToolbox().forceRerender();
        this._renderedToolboxXML = this.props.toolboxXML;

        const queue = this.toolboxUpdateQueue;
        this.toolboxUpdateQueue = [];
        queue.forEach(fn => fn());
    }

    withToolboxUpdates (fn) {
        // if there is a queued toolbox update, we need to wait
        if (this.toolboxUpdateTimeout) {
            this.toolboxUpdateQueue.push(fn);
        } else {
            fn();
        }
    }

    attachVM () {
        this.workspace.addChangeListener(this.props.vm.blockListener);
        this.workspace.addChangeListener(this.handleBlockValidation);
        this.syncKnownWorkspaceBlockIds();

        // ── DIAGNÓSTICO VISUAL ─────────────────────────────────────────────
        // Overlay no DOM: funciona independente do frame/contexto do DevTools.
        // Arraste qualquer bloco e veja os eventos aparecerem na barra verde.
        // DIAGNOSTICO VISUAL — oculto por padrao.
        // Para ativar: window.HyScratch.debugOverlay = true (no console do browser)
        this._debugListener = (e) => {
            if (!window.HyScratch || !window.HyScratch.debugOverlay) return;
            if (!window._scratchDebugDiv) {
                const div = document.createElement('div');
                div.id = '_scratchDebugDiv';
                div.style.cssText = [
                    'position:fixed',
                    'bottom:0',
                    'left:0',
                    'right:0',
                    'background:#111',
                    'color:#0f0',
                    'font:11px monospace',
                    'z-index:99999',
                    'max-height:140px',
                    'overflow-y:auto',
                    'padding:4px 6px',
                    'pointer-events:none'
                ].join(';');
                document.body.appendChild(div);
                window._scratchDebugDiv = div;
            }
            const line = document.createElement('div');
            const typeStr = `type=${e.type}`;
            const blockStr = `blockId=${e.blockId || '?'}`;
            const undoStr = `recordUndo=${e.recordUndo}`;
            const elemStr = `element=${e.element || '?'}`;
            line.textContent = `${typeStr} | ${blockStr} | ${undoStr} | ${elemStr}`;
            window._scratchDebugDiv.prepend(line);
            while (window._scratchDebugDiv.children.length > 10) {
                window._scratchDebugDiv.removeChild(window._scratchDebugDiv.lastChild);
            }
        };
        this.workspace.addChangeListener(this._debugListener);

        // Expoe funcoes de diagnostico/teste no namespace global
        window.HyScratch = window.HyScratch || {};
        window.HyScratch.debugOverlay = false;
        window.HyScratch.showDebug = () => {
            window.HyScratch.debugOverlay = true;
        };
        window.HyScratch.hideDebug = () => {
            window.HyScratch.debugOverlay = false;
            if (window._scratchDebugDiv) {
                window._scratchDebugDiv.remove();
                window._scratchDebugDiv = null;
            }
        };
        window.HyScratch.testModal = (hint) => {
            this.props.onShowBlockHint(hint || {
                detectedOpcode: 'motion_pointtowards',
                detectedLabel: 'aponte para ()',
                message: 'Teste: esse bloco nao e o indicado para esta atividade.',
                suggestedOpcode: 'motion_gotoxy',
                suggestedLabel: 'va para x: () y: ()'
            });
        };
        window.HyScratch.vm = this.props.vm;
        window.HyScratch.triggerRunStop = () => this.props.vm.emit('PROJECT_RUN_STOP');
        window.HyScratch.triggerVerify = () => this.props.onVerifyCurrentStep(this.props.vm);
        // ──────────────────────────────────────────────────────────────────

        // ── Track sprite list for reactive verification ─────────────────────
        // When a step has sprite constraints but no required opcodes,
        // auto-verify when sprites are added/removed (without running the project).
        this._prevSpriteIds = new Set(
            this.props.vm.runtime.targets
                .filter(t => !t.isStage)
                .map(t => t.id)
        );
        // ──────────────────────────────────────────────────────────────────

        // ── Activity run-stop listeners ────────────────────────────────────
        this._runStopTimeout = null;
        this._noScriptTimeout = null;
        this._foreverVerifyTimeout = null;

        this._onProjectRunStart = () => {
            // Scripts are running — cancel the empty-workspace check
            if (this._noScriptTimeout) {
                clearTimeout(this._noScriptTimeout);
                this._noScriptTimeout = null;
            }
            if (this._runStopTimeout) {
                clearTimeout(this._runStopTimeout);
                this._runStopTimeout = null;
            }
            if (this._foreverVerifyTimeout) {
                clearTimeout(this._foreverVerifyTimeout);
                this._foreverVerifyTimeout = null;
            }

            // Steps requiring "forever" never emit PROJECT_RUN_STOP naturally.
            // Validate after ~2 cycles so success modal can appear automatically.
            const step = this.props.currentStep;
            const hasForeverRequirement = Boolean(
                step && Array.isArray(step.requiredOpcodes) &&
                step.requiredOpcodes.includes('control_forever')
            );
            if (hasForeverRequirement) {
                this._foreverVerifyTimeout = setTimeout(() => {
                    this._foreverVerifyTimeout = null;
                    if (this.props.vm.runtime._nonMonitorThreadCount > 0) {
                        this.handleProjectRunStop();
                    }
                }, 2200);
            }

            if (this.props.activityModalOpen) {
                this.props.onCloseActivityModal();
            }
        };

        // Intercept vm.greenFlag to handle the case where no scripts exist.
        // When the workspace is empty (or has only orphan blocks), no threads
        // are created, _nonMonitorThreadCount stays 0, and PROJECT_RUN_STOP
        // never fires. We detect this with a 150ms timeout after greenFlag.
        this._originalGreenFlag = this.props.vm.greenFlag.bind(this.props.vm);
        this.props.vm.greenFlag = () => {
            this._originalGreenFlag();
            if (!this.props.currentStep) return;
            if (this._noScriptTimeout) clearTimeout(this._noScriptTimeout);
            this._noScriptTimeout = setTimeout(() => {
                this._noScriptTimeout = null;
                // If _nonMonitorThreadCount is still 0, no scripts ever started
                if (this.props.vm.runtime._nonMonitorThreadCount === 0) {
                    this.handleProjectRunStop();
                }
            }, 150);
        };

        this._onProjectRunStop = () => {
            if (!this.props.currentStep) return;
            if (this._foreverVerifyTimeout) {
                clearTimeout(this._foreverVerifyTimeout);
                this._foreverVerifyTimeout = null;
            }
            if (this._runStopTimeout) {
                clearTimeout(this._runStopTimeout);
            }
            // Re-check after one frame: if _nonMonitorThreadCount is still 0,
            // the runtime truly finished all scripts (not a momentary empty queue).
            this._runStopTimeout = setTimeout(() => {
                this._runStopTimeout = null;
                if (this.props.vm.runtime._nonMonitorThreadCount === 0) {
                    // Wait 2s so the student can see the result before the modal opens.
                    this._runStopTimeout = setTimeout(() => {
                        this._runStopTimeout = null;
                        this.handleProjectRunStop();
                    }, 2000);
                }
                // If count > 0, a new PROJECT_RUN_STOP will fire when done.
            }, 100);
        };

        this.flyoutWorkspace = this.workspace
            .getFlyout()
            .getWorkspace();
        this.flyoutWorkspace.addChangeListener(this.props.vm.flyoutBlockListener);
        this.flyoutWorkspace.addChangeListener(this.props.vm.monitorBlockListener);
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.addListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.addListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.addListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.addListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.addListener('MONITORS_UPDATE', this.handleMonitorsUpdate);
        this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.addListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.addListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.addListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.addListener('PROJECT_RUN_START', this._onProjectRunStart);
        this.props.vm.addListener('PROJECT_RUN_STOP', this._onProjectRunStop);
    }
    detachVM () {
        this.workspace.removeChangeListener(this.handleBlockValidation);
        if (this._debugListener) {
            this.workspace.removeChangeListener(this._debugListener);
        }
        this._knownWorkspaceBlockIds = new Set();
        this._knownSnapshotTargetId = null;
        this._hasPrimedWorkspaceSnapshot = false;
        this._prevSpriteIds = null;
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.removeListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.removeListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.removeListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.removeListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.removeListener('MONITORS_UPDATE', this.handleMonitorsUpdate);
        this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.removeListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
        if (this._noScriptTimeout) {
            clearTimeout(this._noScriptTimeout);
            this._noScriptTimeout = null;
        }
        if (this._runStopTimeout) {
            clearTimeout(this._runStopTimeout);
            this._runStopTimeout = null;
        }
        if (this._foreverVerifyTimeout) {
            clearTimeout(this._foreverVerifyTimeout);
            this._foreverVerifyTimeout = null;
        }
        if (this._capturePreviewTimeout) {
            clearTimeout(this._capturePreviewTimeout);
            this._capturePreviewTimeout = null;
        }
        if (this._originalGreenFlag) {
            this.props.vm.greenFlag = this._originalGreenFlag;
            this._originalGreenFlag = null;
        }
        if (this._onProjectRunStop) {
            this.props.vm.removeListener('PROJECT_RUN_STOP', this._onProjectRunStop);
        }
        if (this._onProjectRunStart) {
            this.props.vm.removeListener('PROJECT_RUN_START', this._onProjectRunStart);
        }
    }

    updateToolboxBlockValue (id, value) {
        this.withToolboxUpdates(() => {
            const block = this.workspace
                .getFlyout()
                .getWorkspace()
                .getBlockById(id);
            if (block) {
                block.inputList[0].fieldRow[0].setValue(value);
            }
        });
    }

    onTargetsUpdate () {
        if (this.props.vm.editingTarget && this.workspace.getFlyout()) {
            ['glide', 'move', 'set'].forEach((prefix) => {
                this.updateToolboxBlockValue(`${prefix}x`, Math.round(this.props.vm.editingTarget.x).toString());
                this.updateToolboxBlockValue(`${prefix}y`, Math.round(this.props.vm.editingTarget.y).toString());
            });
        }

        // ── Reactive sprite verification ────────────────────────────────────
        // If the step has sprite constraints but no required opcodes,
        // auto-verify when sprites are added/removed.
        const step = this.props.currentStep;
        if (!step) return;

        const hasSpriteCriteria = (
            Array.isArray(step.requiredRemoveSprites) ||
            Array.isArray(step.requiredAddSprites) ||
            typeof step.minSpriteCount === 'number' ||
            typeof step.maxSpriteCount === 'number' ||
            typeof step.requiredSpriteCount === 'number'
        );

        const noOpcodeRequired = (
            !Array.isArray(step.requiredOpcodes) ||
            step.requiredOpcodes.length === 0
        );

        if (hasSpriteCriteria && noOpcodeRequired) {
            const currentSpriteIds = new Set(
                this.props.vm.runtime.targets
                    .filter(t => !t.isStage)
                    .map(t => t.id)
            );

            // Check if sprite list changed (added or removed)
            const changed = (
                currentSpriteIds.size !== this._prevSpriteIds.size ||
                [...currentSpriteIds].some(id => !this._prevSpriteIds.has(id)) ||
                [...this._prevSpriteIds].some(id => !currentSpriteIds.has(id))
            );

            if (changed) {
                this._prevSpriteIds = currentSpriteIds;
                this.props.onVerifyCurrentStep(this.props.vm);
            }
        }
        // ────────────────────────────────────────────────────────────────
    }
    onWorkspaceMetricsChange () {
        const target = this.props.vm.editingTarget;
        if (target && target.id) {
            // Dispatch updateMetrics later, since onWorkspaceMetricsChange may be (very indirectly)
            // called from a reducer, i.e. when you create a custom procedure.
            // TODO: Is this a vehement hack?
            setTimeout(() => {
                this.props.updateMetrics({
                    targetID: target.id,
                    scrollX: this.workspace.scrollX,
                    scrollY: this.workspace.scrollY,
                    scale: this.workspace.scale
                });
            }, 0);
        }
    }
    onScriptGlowOn (data) {
        this.ScratchBlocks.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.ScratchBlocks.glowStack(data.id, false);
    }
    onBlockGlowOn (/* data */) {
        // No-op, support may be added in the future
    }
    onBlockGlowOff (/* data */) {
        // No-op, support may be added in the future
    }
    onVisualReport (data) {
        this.ScratchBlocks.reportValue(data.id, data.value);
    }
    getToolboxXML () {
        // Use try/catch because this requires digging pretty deep into the VM
        // Code inside intentionally ignores several error situations (no stage, etc.)
        // Because they would get caught by this try/catch
        try {
            let {editingTarget: target, runtime} = this.props.vm;
            const stage = runtime.getTargetForStage();
            if (!target) target = stage; // If no editingTarget, use the stage

            const stageCostumes = stage.getCostumes();
            const targetCostumes = target.getCostumes();
            const targetSounds = target.getSounds();
            const dynamicBlocksXML = injectExtensionCategoryMode(
                this.props.vm.runtime.getBlocksXML(target),
                this.props.colorMode
            );
            return makeToolboxXML(false, target.isStage, target.id, dynamicBlocksXML,
                targetCostumes[targetCostumes.length - 1].name,
                stageCostumes[stageCostumes.length - 1].name,
                targetSounds.length > 0 ? targetSounds[targetSounds.length - 1].name : '',
                getColorsForMode(this.props.colorMode)
            );
        } catch {
            return null;
        }
    }
    onWorkspaceUpdate (data) {
        const currentTargetId = this.props.vm.editingTarget && this.props.vm.editingTarget.id;

        // When we change sprites, update the toolbox to have the new sprite's blocks
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }

        if (this.props.vm.editingTarget && !this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id]) {
            this.onWorkspaceMetricsChange();
        }

        // Disable Blockly events during workspace reload. In Blockly v2, Events.fire()
        // enqueues events for async dispatch (after rendering), so the old pattern of
        // removing and re-adding the blockListener no longer prevents spurious events
        // from reaching the VM — the queued events fire after the listener is re-added.
        // Disabling events entirely during the load ensures nothing is queued.
        this.workspace.removeChangeListener(this.toolboxUpdateChangeListener);
        try {
            this.ScratchBlocks.Events.disable();
            const dom = this.ScratchBlocks.utils.xml.textToDom(data.xml);
            this.ScratchBlocks.clearWorkspaceAndLoadFromXml(dom, this.workspace);
        } catch (error) {
            // The workspace is likely incomplete. What did update should be
            // functional.
            //
            // Instead of throwing the error, by logging it and continuing as
            // normal lets the other workspace update processes complete in the
            // gui and vm, which lets the vm run even if the workspace is
            // incomplete. Throwing the error would keep things like setting the
            // correct editing target from happening which can interfere with
            // some blocks and processes in the vm.
            if (error.message) {
                error.message = `Workspace Update Error: ${error.message}`;
            }
            log.error(error);
        } finally {
            this.ScratchBlocks.Events.enable();
        }

        if (this.props.vm.editingTarget && this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id]) {
            const {scrollX, scrollY, scale} = this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id];
            this.workspace.scrollX = scrollX;
            this.workspace.scrollY = scrollY;
            this.workspace.scale = scale;
            this.workspace.resize();
        }

        // Clear the undo state of the workspace since this is a
        // fresh workspace and we don't want any changes made to another sprites
        // workspace to be 'undone' here.
        this.workspace.clearUndo();

        // Primeiro update após carregar/trocar alvo: apenas sincroniza snapshot.
        if (!this._hasPrimedWorkspaceSnapshot || this._knownSnapshotTargetId !== currentTargetId) {
            this.syncKnownWorkspaceBlockIds();
            this._knownSnapshotTargetId = currentTargetId;
            this._hasPrimedWorkspaceSnapshot = true;
        } else {
            const hintFromDelta = this.getHintFromWorkspaceDelta();
            this.tryShowBlockHint(hintFromDelta);
        }

        this.syncKnownWorkspaceBlockIds();
        // Let events get flushed before readding the toolbox-updater listener
        // to avoid unneeded refreshes.
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.workspace.addChangeListener(
                    this.toolboxUpdateChangeListener
                );
            });
        });
    }
    handleMonitorsUpdate (monitors) {
        // Update the checkboxes of the relevant monitors.
        // TODO: What about monitors that have fields? See todo in scratch-vm blocks.js changeBlock:
        // https://github.com/LLK/scratch-vm/blob/2373f9483edaf705f11d62662f7bb2a57fbb5e28/src/engine/blocks.js#L569-L576
        const flyout = this.workspace.getFlyout();
        for (const monitor of monitors.values()) {
            const blockId = monitor.get('id');
            const isVisible = monitor.get('visible');
            flyout.setCheckboxState(blockId, isVisible);
            // We also need to update the isMonitored flag for this block on the VM, since it's used to determine
            // whether the checkbox is activated or not when the checkbox is re-displayed (e.g. local variables/blocks
            // when switching between sprites).
            const block = this.props.vm.runtime.monitorBlocks.getBlock(blockId);
            if (block) {
                block.isMonitored = isVisible;
            }
        }
    }
    handleExtensionAdded (categoryInfo) {
        analytics.event({
            category: 'extensions',
            action: 'added',
            label: categoryInfo.id
        });

        const defineBlocks = (blockInfoArray) => {
            if (blockInfoArray && blockInfoArray.length > 0) {
                const staticBlocksJson = [];
                const dynamicBlocksInfo = [];
                blockInfoArray.forEach((blockInfo) => {
                    if (blockInfo.info && blockInfo.info.isDynamic) {
                        dynamicBlocksInfo.push(blockInfo);
                    } else if (blockInfo.json) {
                        staticBlocksJson.push(injectExtensionBlockIcons(blockInfo.json, this.props.colorMode));
                    }
                    // otherwise it's a non-block entry such as '---'
                });

                this.ScratchBlocks.defineBlocksWithJsonArray(staticBlocksJson);
                dynamicBlocksInfo.forEach((blockInfo) => {
                    // This is creating the block factory / constructor -- NOT a specific instance of the block.
                    // The factory should only know static info about the block: the category info and the opcode.
                    // Anything else will be picked up from the XML attached to the block instance.
                    const extendedOpcode = `${categoryInfo.id}_${blockInfo.info.opcode}`;
                    const blockDefinition =
                        defineDynamicBlock(this.ScratchBlocks, categoryInfo, blockInfo, extendedOpcode);
                    this.ScratchBlocks.Blocks[extendedOpcode] = blockDefinition;
                });
            }
        };

        // scratch-blocks implements a menu or custom field as a special kind of block ("shadow" block)
        // these actually define blocks and MUST run regardless of the UI state
        defineBlocks(
            Object.getOwnPropertyNames(categoryInfo.customFieldTypes)
                .map((fieldTypeName) => categoryInfo.customFieldTypes[fieldTypeName].scratchBlocksDefinition));
        defineBlocks(categoryInfo.menus);
        defineBlocks(categoryInfo.blocks);
        // Note that Blockly uses the UK spelling of "colour", so fields that
        // interact directly with Blockly follow that convention, while Scratch
        // code uses the US spelling of "color".
        let colourPrimary = categoryInfo.color1;
        let colourSecondary = categoryInfo.color2;
        let colourTertiary = categoryInfo.color3;
        let colourQuaternary = categoryInfo.color3;
        if (this.props.colorMode !== DEFAULT_MODE) {
            const colors = getExtensionColors(this.props.colorMode);
            colourPrimary = colors.colourPrimary;
            colourSecondary = colors.colourSecondary;
            colourTertiary = colors.colourTertiary;
            colourQuaternary = colors.colourQuaternary;
        }
        this.ScratchBlocks.getMainWorkspace()
            .getTheme()
            .setBlockStyle(categoryInfo.id, {
                colourPrimary,
                colourSecondary,
                colourTertiary,
                colourQuaternary
            });
        this.ScratchBlocks.getMainWorkspace()
            .getTheme()
            .setBlockStyle(`${categoryInfo.id}_selected`, {
                colourPrimary: colourQuaternary,
                colourSecondary: colourQuaternary,
                colourTertiary: colourQuaternary,
                colourQuaternary: colourQuaternary
            });
        this.ScratchBlocks.getMainWorkspace().setTheme(
            this.ScratchBlocks.getMainWorkspace().getTheme()
        );
        // Update the toolbox with new blocks if possible
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }
    }
    handleBlocksInfoUpdate (categoryInfo) {
        // @todo Later we should replace this to avoid all the warnings from redefining blocks.
        this.handleExtensionAdded(categoryInfo);
    }
    handleCategorySelected (categoryId) {
        const extension = extensionData.find((ext) => ext.extensionId === categoryId);
        if (extension && extension.launchPeripheralConnectionFlow) {
            this.handleConnectionModalStart(categoryId);
        }

        this.withToolboxUpdates(() => {
            const toolbox = this.workspace.getToolbox();
            toolbox.setSelectedItem(toolbox.getToolboxItemById(categoryId));
            // Flyout is populated synchronously after setSelectedItem — filter immediately.
            this.filterFlyoutBlocks();
        });
        // Re-capture SVG previews now that the flyout has new blocks
        this.captureStepPreviews();
    }
    selectDefaultToolboxCategory () {
        if (!this.workspace) return;
        const toolbox = this.workspace.getToolbox && this.workspace.getToolbox();
        if (!toolbox) return;

        const controlItem = toolbox.getToolboxItemById && toolbox.getToolboxItemById('control');
        if (controlItem) {
            toolbox.setSelectedItem(controlItem);
        }
        this.filterFlyoutBlocks();
    }
    filterFlyoutBlocks () {
        if (!this.props.allowedOpcodes) return;
        if (!this.workspace) return;
        try {
            const flyout = this.workspace.getFlyout && this.workspace.getFlyout();
            const flyoutWs = flyout && flyout.getWorkspace && flyout.getWorkspace();
            if (!flyoutWs) return;
            flyoutWs.getAllBlocks(false)
                .filter(b => !b.getParent())
                .forEach(b => {
                    const svg = b.getSvgRoot && b.getSvgRoot();
                    if (!svg) return;
                    svg.style.display = this.props.allowedOpcodes.includes(b.type) ? '' : 'none';
                });
        } catch (_) {
            // noop — flyout may not exist yet
        }
    }
    setBlocks (blocks) {
        this.blocks = blocks;
    }
    handlePromptStart (message, defaultValue, callback, optTitle, optVarType) {
        const p = {prompt: {callback, message, defaultValue}};
        p.prompt.title = optTitle ? optTitle :
            this.ScratchBlocks.Msg.VARIABLE_MODAL_TITLE;
        p.prompt.varType = typeof optVarType === 'string' ?
            optVarType : this.ScratchBlocks.SCALAR_VARIABLE_TYPE;
        p.prompt.showVariableOptions = // This flag means that we should show variable/list options about scope
            optVarType !== this.ScratchBlocks.BROADCAST_MESSAGE_VARIABLE_TYPE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_VARIABLE_MODAL_TITLE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_LIST_MODAL_TITLE;
        p.prompt.showCloudOption = (optVarType === this.ScratchBlocks.SCALAR_VARIABLE_TYPE) && this.props.canUseCloud;
        this.setState(p);
    }
    handleConnectionModalStart (extensionId) {
        this.props.onOpenConnectionModal(extensionId);
    }
    handleStatusButtonUpdate () {
        this.workspace.getFlyout().refreshStatusButtons();
    }
    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

    /*
     * Pass along information about proposed name and variable options (scope and isCloud)
     * and additional potentially conflicting variable names from the VM
     * to the variable validation prompt callback used in scratch-blocks.
     */
    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }
    handlePromptClose () {
        this.setState({prompt: null});
    }
    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        this.updateToolbox();
        ws.getToolbox().selectCategoryByName('myBlocks');
    }
    syncKnownWorkspaceBlockIds () {
        if (!this.workspace || typeof this.workspace.getAllBlocks !== 'function') {
            this._knownWorkspaceBlockIds = new Set();
            return;
        }
        const currentBlocks = this.workspace.getAllBlocks(false);
        this._knownWorkspaceBlockIds = new Set(currentBlocks.map((block) => block.id));
    }
    getHintFromWorkspaceDelta () {
        if (!this.workspace || typeof this.workspace.getAllBlocks !== 'function') return null;

        const currentBlocks = this.workspace.getAllBlocks(false);
        const currentIds = new Set(currentBlocks.map(block => block.id));

        let hint = null;
        const step = this.props.currentStep;

        for (let i = 0; i < currentBlocks.length; i++) {
            const block = currentBlocks[i];
            if (this._knownWorkspaceBlockIds.has(block.id)) continue;

            if (step && Array.isArray(step.allowedOpcodes)) {
                // Dynamic hint: block not allowed in this step
                if (step.allowedOpcodes.includes(block.type)) continue;

                const previews = step.previewBlocks || [];
                const svgs = this.props.previewBlockSvgs || [];

                const findLabel = opcode => {
                    const p = previews.find(b => b.opcode === opcode);
                    if (p) return p.label;
                    const s = svgs.find(b => b.opcode === opcode);
                    return s ? s.label : opcode;
                };
                const findSvg = opcode => {
                    const s = svgs.find(b => b.opcode === opcode);
                    return s ? s.svgXml : null;
                };

                // Pick suggested = first required opcode not yet in workspace
                const required = step.requiredOpcodes || [];
                const presentTypes = new Set(currentBlocks.map(b => b.type));
                const suggestedOpcode = required.find(op => !presentTypes.has(op)) || null;

                hint = {
                    detectedOpcode: block.type,
                    detectedLabel: findLabel(block.type),
                    detectedSvgXml: findSvg(block.type),
                    suggestedOpcode,
                    suggestedLabel: suggestedOpcode ? findLabel(suggestedOpcode) : null,
                    suggestedSvgXml: suggestedOpcode ? findSvg(suggestedOpcode) : null,
                    message: 'Este bloco nao faz parte desta atividade. Experimente usar:'
                };
                break;
            }

            // Fallback: static activity-config validator (no active step)
            hint = validateWrongOpcode(block.type);
            if (hint) break;
        }

        this._knownWorkspaceBlockIds = currentIds;
        return hint;
    }
    tryShowBlockHint (hint) {
        if (!hint) return;

        const now = Date.now();
        const COOLDOWN_MS = 10000;
        if (
            hint.detectedOpcode === this._lastBlockHintOpcode &&
            now - this._lastBlockHintShownAt < COOLDOWN_MS
        ) {
            return;
        }
        this._lastBlockHintOpcode = hint.detectedOpcode;
        this._lastBlockHintShownAt = now;
        this.props.onShowBlockHint(hint);
    }
    handleProjectRunStop () {
        if (!this.props.currentStep) return;
        this.props.onVerifyCurrentStep(this.props.vm);
    }
    captureStepPreviews () {
        const step = this.props.currentStep;
        if (!step || !step.previewBlocks || !step.previewBlocks.length) {
            this.props.onSetPreviewBlockSvgs([]);
            return;
        }
        if (!this.workspace) return;

        const needed = step.previewBlocks.map(pb => pb.opcode);
        const svgMap = {};

        const getFlyoutBlocks = () => {
            try {
                const flyout = this.workspace.getFlyout && this.workspace.getFlyout();
                const flyoutWs = flyout && flyout.getWorkspace && flyout.getWorkspace();
                return flyoutWs ? flyoutWs.getAllBlocks(false) : [];
            } catch (_) {
                return [];
            }
        };

        // Capture from whichever category is currently open
        for (const block of getFlyoutBlocks()) {
            if (needed.includes(block.type)) {
                svgMap[block.type] = captureSvgFromBlock(block);
            }
        }

        // For opcodes still missing, switch to their category temporarily
        const stillNeeded = needed.filter(op => !svgMap[op]);
        if (stillNeeded.length > 0) {
            const toolbox = this.workspace.getToolbox ? this.workspace.getToolbox() : null;
            const originalItem = toolbox ? toolbox.getSelectedItem() : null;

            // Group missing opcodes by their target category
            const byCategory = {};
            for (const opcode of stillNeeded) {
                const catId = OPCODE_CATEGORY_MAP[opcode.split('_')[0]];
                if (!catId) continue;
                if (!byCategory[catId]) byCategory[catId] = [];
                byCategory[catId].push(opcode);
            }

            for (const catId of Object.keys(byCategory)) {
                try {
                    const item = toolbox.getToolboxItemById(catId);
                    if (!item) continue;
                    toolbox.setSelectedItem(item);
                    for (const block of getFlyoutBlocks()) {
                        if (byCategory[catId].includes(block.type) && !svgMap[block.type]) {
                            svgMap[block.type] = captureSvgFromBlock(block);
                        }
                    }
                } catch (_) {
                    // noop
                }
            }

            // Restore original category selection
            if (originalItem) {
                try {
                    toolbox.setSelectedItem(originalItem);
                } catch (_) {
                    // noop
                }
            }
        }

        const captured = step.previewBlocks.map(pb => ({
            opcode: pb.opcode,
            label: pb.label,
            svgXml: svgMap[pb.opcode] || null
        }));
        this.props.onSetPreviewBlockSvgs(captured);
    }
    handleBlockValidation (event) {
        if (!event) return;

        // Fase 1: bloco criado no workspace ao pegar do flyout.
        // Nao mostra modal ainda — aguarda o usuario soltar (endDrag).
        const isCreate = (
            event.type === 'create' ||
            event.type === 'blockCreate' ||
            event.type === 'BLOCK_CREATE'
        );
        if (isCreate && event.recordUndo !== false) {
            // Guarda o id do bloco que esta sendo arrastado
            this._pendingHintBlockId = event.blockId ||
                (Array.isArray(event.ids) && event.ids[0]) || null;
            return;
        }

        // Fase 2: usuario soltou o bloco.
        if (event.type !== 'endDrag') return;

        const pendingId = this._pendingHintBlockId;
        this._pendingHintBlockId = null;
        if (!pendingId) return;

        // setTimeout(0): aguarda eventos sincronos de delete (lixeira/flyout) processarem.
        // Se o bloco foi descartado, getBlockById retorna null e nao mostramos o modal.
        const self = this;
        setTimeout(() => {
            if (!self.workspace) return;
            const block = self.workspace.getBlockById(pendingId);
            if (!block) return; // bloco descartado na lixeira ou flyout

            const hint = validateWrongOpcode(block.type);
            if (!hint) return; // bloco correto, nada a mostrar

            // [SVG-B] Obtém blocos do flyout uma única vez (usado para detectado E sugerido).
            // Flyout produz renderização limpa (sem estado de drag/seleção do workspace).
            let flyoutBlocks = [];
            try {
                const flyout = self.workspace.getFlyout && self.workspace.getFlyout();
                if (flyout) {
                    const flyoutWs = flyout.getWorkspace();
                    flyoutBlocks = flyoutWs ? flyoutWs.getAllBlocks(false) : [];
                } else {
                    console.warn(
                        '[HyScratch SVG] getFlyout() retornou null.',
                        'O flyout pode nao estar acessivel neste momento.'
                    );
                }
            } catch (flyoutErr) {
                console.warn(
                    '[HyScratch SVG] Erro ao acessar o flyout:',
                    flyoutErr.message
                );
            }

            // [SVG-B] Bloco detectado: busca no flyout PRIMEIRO (renderiza texto corretamente).
            // Fallback para o bloco do workspace se nao encontrado no flyout.
            // CAUSA CONHECIDA da falha: blocos do workspace têm estado visual diferente após
            // o drag (camada de arrastar, selecao) que pode tornar o texto SVG nao visivel.
            let detectedSvgXml = null;
            const flyoutDetected = flyoutBlocks.find((b) => b.type === block.type);
            if (flyoutDetected) {
                detectedSvgXml = captureSvgFromBlock(flyoutDetected);
                if (!detectedSvgXml) {
                    console.warn(
                        '[HyScratch SVG] Bloco detectado encontrado no flyout mas SVG falhou.',
                        'tipo:', block.type
                    );
                }
            } else {
                console.warn(
                    '[HyScratch SVG] Bloco detectado nao encontrado no flyout — tentando workspace.',
                    'tipo:', block.type,
                    '— verifique se a categoria Motion esta aberta.'
                );
            }
            // Fallback: capturar direto do workspace
            if (!detectedSvgXml) {
                detectedSvgXml = captureSvgFromBlock(block);
                if (!detectedSvgXml) {
                    console.warn(
                        '[HyScratch SVG] Nao foi possivel capturar SVG do bloco detectado.',
                        'tipo:', block.type,
                        '— modal vai exibir label de texto como fallback.'
                    );
                }
            }

            // [SVG-B] Bloco sugerido: busca no flyout.
            let suggestedSvgXml = null;
            if (hint.suggestedOpcode) {
                const suggestedBlock = flyoutBlocks.find((b) => b.type === hint.suggestedOpcode);
                if (suggestedBlock) {
                    suggestedSvgXml = captureSvgFromBlock(suggestedBlock);
                } else {
                    // Causa mais provavel: categoria nao selecionada ou opcode incorreto.
                    console.warn(
                        '[HyScratch SVG] Bloco sugerido nao encontrado no flyout.',
                        'opcode:', hint.suggestedOpcode,
                        '— verifique se a categoria esta aberta ou se o opcode esta correto.'
                    );
                }
            }

            self.tryShowBlockHint(Object.assign({}, hint, {
                detectedSvgXml: detectedSvgXml,
                suggestedSvgXml: suggestedSvgXml
            }));
        }, 0);
    }
    handleDrop (dragInfo) {
        fetch(dragInfo.payload.bodyUrl)
            .then((response) => response.json())
            .then((blocks) => this.props.vm.shareBlocksToTarget(blocks, this.props.vm.editingTarget.id))
            .then(() => {
                this.props.vm.refreshWorkspace();
            });
    }
    render () {
         
        const {
            anyModalVisible,
            canUseCloud,
            customProceduresVisible,
            extensionLibraryVisible,
            options,
            stageSize,
            vm,
            isRtl,
            isVisible,
            onActivateColorPicker,
            onOpenConnectionModal,
            onOpenSoundRecorder,
            updateToolboxState,
            onActivateCustomProcedures,
            onRequestCloseExtensionLibrary,
            onRequestCloseCustomProcedures,
            toolboxXML,
            updateMetrics: updateMetricsProp,
            useCatBlocks,
            workspaceMetrics,
            colorMode,
            ...props
        } = this.props;
         
        return (
            <React.Fragment>
                <DroppableBlocks
                    componentRef={this.setBlocks}
                    onDrop={this.handleDrop}
                    {...props}
                />
                {this.state.prompt ? (
                    <Prompt
                        defaultValue={this.state.prompt.defaultValue}
                        isStage={vm.runtime.getEditingTarget().isStage}
                        showListMessage={this.state.prompt.varType === this.ScratchBlocks.LIST_VARIABLE_TYPE}
                        label={this.state.prompt.message}
                        showCloudOption={this.state.prompt.showCloudOption}
                        showVariableOptions={this.state.prompt.showVariableOptions}
                        title={this.state.prompt.title}
                        vm={vm}
                        onCancel={this.handlePromptClose}
                        onOk={this.handlePromptCallback}
                    />
                ) : null}
                {extensionLibraryVisible ? (
                    <ExtensionLibrary
                        vm={vm}
                        onCategorySelected={this.handleCategorySelected}
                        onRequestClose={onRequestCloseExtensionLibrary}
                    />
                ) : null}
                {customProceduresVisible ? (
                    <CustomProcedures
                        options={{
                            media: options.media
                        }}
                        onRequestClose={this.handleCustomProceduresClose}
                        colorMode={colorMode}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

Blocks.propTypes = {
    anyModalVisible: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    customProceduresVisible: PropTypes.bool,
    extensionLibraryVisible: PropTypes.bool,
    isRtl: PropTypes.bool,
    isVisible: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    messages: PropTypes.objectOf(PropTypes.string),
    onActivateColorPicker: PropTypes.func,
    onActivateCustomProcedures: PropTypes.func,
    onOpenConnectionModal: PropTypes.func,
    onShowBlockHint: PropTypes.func,
    onVerifyCurrentStep: PropTypes.func,
    onCloseActivityModal: PropTypes.func,
    onSetPreviewBlockSvgs: PropTypes.func,
    previewBlockSvgs: PropTypes.arrayOf(PropTypes.shape({
        opcode: PropTypes.string,
        label: PropTypes.string,
        svgXml: PropTypes.string
    })),
    currentStep: PropTypes.object,
    allowedOpcodes: PropTypes.arrayOf(PropTypes.string),
    activityModalOpen: PropTypes.bool,
    captureRequestSeq: PropTypes.number,
    onOpenSoundRecorder: PropTypes.func,
    onRequestCloseCustomProcedures: PropTypes.func,
    onRequestCloseExtensionLibrary: PropTypes.func,
    options: PropTypes.shape({
        media: PropTypes.string,
        zoom: PropTypes.shape({
            controls: PropTypes.bool,
            wheel: PropTypes.bool,
            startScale: PropTypes.number
        }),
        comments: PropTypes.bool,
        collapse: PropTypes.bool
    }),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    colorMode: PropTypes.oneOf(Object.keys(colorModeMap)),
    toolboxXML: PropTypes.string,
    updateMetrics: PropTypes.func,
    updateToolboxState: PropTypes.func,
    useCatBlocks: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired,
    workspaceMetrics: PropTypes.shape({
        targets: PropTypes.objectOf(PropTypes.object)
    })
};

Blocks.defaultOptions = {
    zoom: {
        controls: true,
        wheel: true,
        pinch: true,
        startScale: BLOCKS_DEFAULT_SCALE
    },
    move: {
        wheel: true
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    comments: true,
    collapse: false,
    sounds: false,
    trashcan: false,
    modalInputs: false
};

Blocks.defaultProps = {
    isVisible: true,
    options: Blocks.defaultOptions,
    colorMode: DEFAULT_MODE
};

const getActivityToolboxFilters = (step) => {
    const allowedCategories = step && Array.isArray(step.allowedCategories) ? step.allowedCategories : null;
    const allowedOpcodes = step && Array.isArray(step.allowedOpcodes) ? step.allowedOpcodes : null;

    // Explicit "no blocks" step: keep only Control category shell and zero blocks.
    // This avoids falling back to "show everything".
    if (Array.isArray(allowedCategories) && Array.isArray(allowedOpcodes) &&
        allowedCategories.length === 0 && allowedOpcodes.length === 0) {
        return {
            allowedCategories: ['control'],
            allowedOpcodes: []
        };
    }

    return {
        allowedCategories,
        allowedOpcodes
    };
};

const mapStateToProps = (state) => {
    const currentStep = getCurrentStep(state);
    const {allowedCategories, allowedOpcodes} = getActivityToolboxFilters(currentStep);

    return ({
    anyModalVisible: (
        Object.keys(state.scratchGui.modals).some((key) => state.scratchGui.modals[key]) ||
        state.scratchGui.mode.isFullScreen
    ),
    extensionLibraryVisible: state.scratchGui.modals.extensionLibrary,
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    messages: state.locales.messages,
    toolboxXML: filterToolboxXML(
        state.scratchGui.toolbox.toolboxXML,
        allowedCategories,
        allowedOpcodes
    ),
    allowedOpcodes,
    previewBlockSvgs: state.scratchGui.activity.previewBlockSvgs || [],
    currentStep,
    activityModalOpen: state.scratchGui.activityModal.isOpen,
    captureRequestSeq: state.scratchGui.activity.captureRequestSeq,
    customProceduresVisible: state.scratchGui.customProcedures.active,
    workspaceMetrics: state.scratchGui.workspaceMetrics,
    useCatBlocks: isTimeTravel2020(state) || state.scratchGui.settings.theme === CAT_BLOCKS_THEME
    });
};

const mapDispatchToProps = (dispatch) => ({
    onActivateColorPicker: (callback) => dispatch(activateColorPicker(callback)),
    onActivateCustomProcedures: (data, callback) => dispatch(activateCustomProcedures(data, callback)),
    onOpenConnectionModal: (id) => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onOpenSoundRecorder: () => {
        dispatch(activateTab(SOUNDS_TAB_INDEX));
        dispatch(openSoundRecorder());
    },
    onRequestCloseExtensionLibrary: () => {
        dispatch(closeExtensionLibrary());
    },
    onRequestCloseCustomProcedures: (data) => {
        dispatch(deactivateCustomProcedures(data));
    },
    updateToolboxState: (toolboxXML) => {
        dispatch(updateToolbox(toolboxXML));
    },
    updateMetrics: (metrics) => {
        dispatch(updateMetrics(metrics));
    },
    onShowBlockHint: (hint) => {
        dispatch(showBlockHint(hint));
    },
    onVerifyCurrentStep: vm => dispatch(verifyCurrentStep(vm)),
    onSetPreviewBlockSvgs: svgs => dispatch({type: SET_PREVIEW_BLOCK_SVGS, payload: svgs}),
    onCloseActivityModal: () => dispatch({type: CLOSE_ACTIVITY_MODAL})
});

export {Blocks};
export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
