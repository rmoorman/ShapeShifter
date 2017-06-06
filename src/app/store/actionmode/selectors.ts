import { ActionModeUtil } from '../../actionmode';
import {
  LayerUtil,
  MorphableLayer,
  VectorLayer,
} from '../../scripts/layers';
import { Path } from '../../scripts/paths';
import { PathAnimationBlock } from '../../scripts/timeline';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import { State } from '../reducer';
import {
  createDeepEqualSelector,
  getState,
} from '../selectors';
import { getAnimations } from '../timeline/selectors';
import {
  ActionMode,
  ActionSource,
} from './types';
import * as _ from 'lodash';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

const getActionModeState = createSelector(getState, s => s.actionmode);
const getBlockId = createSelector(getActionModeState, s => s.blockId);
const getBlock =
  createSelector(
    getAnimations,
    getBlockId,
    (animations, blockId) => {
      if (!blockId) {
        return undefined;
      }
      for (const anim of animations) {
        const block = _.find(anim.blocks, b => b.id === blockId);
        if (block instanceof PathAnimationBlock) {
          return block;
        }
      }
      return undefined;
    },
  );
const getBlockLayerId = createSelector(getBlock, b => b ? b.layerId : undefined);

export const isActionMode = createSelector(getBlockId, id => !!id);
export const getActionMode = createSelector(getActionModeState, s => s.mode);
export const getActionHover = createDeepEqualSelector(getActionModeState, s => s.hover);
const getActionSelections = createSelector(getActionModeState, s => s.selections);
const getPairedSubPaths =
  createDeepEqualSelector(getActionModeState, state => new Set(state.pairedSubPaths));
const getUnpairedSubPath =
  createDeepEqualSelector(getActionModeState, state => state.unpairedSubPath);

function getVectorLayerValue(getValueFn: (block: PathAnimationBlock) => Path) {
  return createSelector(
    getVectorLayer,
    getBlock,
    (vl, block) => {
      if (!vl || !block) {
        return undefined;
      }
      const layer = vl.findLayerById(block.layerId).clone() as MorphableLayer;
      layer.pathData = getValueFn(block);
      return LayerUtil.replaceLayerInTree(vl, layer);
    });
}

const getVectorLayerFromValue = getVectorLayerValue(block => block.fromValue);
const getVectorLayerToValue = getVectorLayerValue(block => block.toValue);

type CombinerFunc = (vl: VectorLayer, block: PathAnimationBlock) => VectorLayer;

function getMorphableLayerValue(selector: Reselect.OutputSelector<State, VectorLayer, CombinerFunc>) {
  return createSelector(
    selector,
    getBlockLayerId,
    (vl, blockLayerId) => {
      if (!vl || !blockLayerId) {
        return undefined;
      }
      return vl.findLayerById(blockLayerId) as MorphableLayer;
    });
}

const getMorphableLayerFromValue = getMorphableLayerValue(getVectorLayerFromValue);
const getMorphableLayerToValue = getMorphableLayerValue(getVectorLayerToValue);

const getPathsCompatibleResult =
  createSelector(
    getBlock,
    block => block ? ActionModeUtil.checkPathsCompatible(block) : undefined,
  );

function getHighlightedSubIdxWithError(actionSource: ActionSource) {
  return createSelector(
    getActionMode,
    getActionSelections,
    getPathsCompatibleResult,
    (mode, selections, result) => {
      if (!result) {
        // Then there is no path animation block currently selected.
        return undefined;
      }
      const { areCompatible, errorPath, errorSubIdx } = result;
      if (mode !== ActionMode.Selection || selections.length) {
        // Don't show any highlights if we're not in selection mode, or
        // if there are any existing selections.
        return undefined;
      }
      if (areCompatible || errorPath !== actionSource || errorSubIdx === undefined) {
        return undefined;
      }
      return errorSubIdx;
    },
  );
}

const actionModeBaseSelectors = {
  blockLayerId: getBlockLayerId,
  isActionMode,
  hover: getActionHover,
  selections: getActionSelections,
  pairedSubPaths: getPairedSubPaths,
  unpairedSubPath: getUnpairedSubPath,
  hiddenLayerIds: getHiddenLayerIds,
  selectedLayerIds: getSelectedLayerIds,
};

export const getActionModeStartState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerFromValue,
    subIdxWithError: getHighlightedSubIdxWithError(ActionSource.From),
  });

export const getActionModeEndState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerToValue,
    subIdxWithError: getHighlightedSubIdxWithError(ActionSource.To),
  });

export const getToolbarState =
  createStructuredSelector({
    isActionMode,
    fromMl: getMorphableLayerFromValue,
    toMl: getMorphableLayerToValue,
    mode: getActionMode,
    selections: getActionSelections,
    unpairedSubPath: getUnpairedSubPath,
    block: getBlock,
  });