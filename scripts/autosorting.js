import { isometricModuleConfig } from './consts.js';
import { 
  comparePlaceablePosition,
  sortPlaceablePosition,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export function isoDepthSortMixin(Base){  
  return class DepthSortPlaceable extends Base{
    _refreshState() {
      super._refreshState();
      if (this.document.documentName === "Tile"){
        const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;
        if (isTileSortable){ this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS; 
        } else { this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES; }
      }
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      // this.zIndex = this.isPreview ? 3 : this.controlled ? 2 : this.hover ? 1 : 0;
      sortPlaceablePosition(this);
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      sortPlaceablePosition(this);
    }
    // initially i wanst overriding more than _onUpdate but i neded up adding theses to see if it would fix the problematic reordering on
    _onControl(options){
      super._onControl(options)
      sortPlaceablePosition(this);
    }
    _onRelease(options){
      super._onRelease(options);
      sortPlaceablePosition(this);
    }
    _onHoverIn(event, {hoverOutOthers=false, updateLegend=true}={}){
      // console.log("HOVER EVENT", event)
      super._onHoverIn(event, {hoverOutOthers=false, updateLegend=true}={});
      sortPlaceablePosition(this);
    }
    _onHoverOut(event, {updateLegend=true}={}){
      super._onHoverOut(event, {updateLegend=true}={});
      sortPlaceablePosition(this);
    }
    _onClickLeft(event){
      super._onClickLeft(event);
      sortPlaceablePosition(this);
    }
    _onUnclickLeft(event){
      super._onUnclickLeft(event);
      sortPlaceablePosition(this);
    }
    _onClickRight(event){
      super._onClickRight(event);
      sortPlaceablePosition(this);
    }
    _onUnclickRight(event){
      super._onUnclickRight(event);
      sortPlaceablePosition(this);
    }
    _onDragLeftStart(event){
      super._onDragLeftStart(event);
      sortPlaceablePosition(this);
    }
    _onDragLeftMove(event){
      super._onDragLeftMove(event);
      sortPlaceablePosition(this);
    }
    _onDragLeftDrop(event){
      super._onDragLeftDrop(event);
      sortPlaceablePosition(this);
    }
    _onDragRightMove(event){
      super._onDragRightMove(event);
      sortPlaceablePosition(this);
    }
    _onDragRightCancel(event){
      super._onDragRightCancel(event);
      sortPlaceablePosition(this);
    }

  }
}

/**
 * Waits for a token's movement animation to complete.
 * @param {TokenDocument} document 
 */
async function awaitTokenAnimation(document) {
  const token = document.object;
  if (!token) return;
  // wait for the token movement to end
  const movementAnim = token.animation || token.movementAnimationPromise;
  if (movementAnim) {
    try { await movementAnim; } catch (e) { /* Ignore interruptions */ }
  }
  // extra check if the token is moving on another level or between levels.
  if (token.levelIndicator?.animation) {
    try { await token.levelIndicator.animation; } catch (e) { }
  }
}