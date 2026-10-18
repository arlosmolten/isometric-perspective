import { 
  isometricModuleConfig,
  OCCLUSION_ELEVATION_OFFSET
} from "./consts.js";
import {
  sortPlaceableByPosition,
  // debugCanvasLayer,
  toggleAnchorAxis,
} from "./utils.js";

export function isoDepthSortTileMixin(Base) {
  return class DepthSortTile extends Base {
    _refreshState() {
      super._refreshState();
      if (!this.mesh) return;
      const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;

      if (isTileSortable) {
        applyDepthSort();
        this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
      } else {
        if(this.mesh){
          this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES;
        }
      }
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      if (!this.mesh) return;
      const isTileSortable = this.document.getFlag(isometricModuleConfig.MODULE_ID,"isoTileAutoSortingEnabled",);
      if (isTileSortable) {
        applyDepthSort();
      }
    }
  };
}

export function isoDepthSortTokenMixin(Base) {
  return class DepthSortPlaceable extends Base {
    _refreshState() {
      super._refreshState();
      if (!this.mesh) return;
      applyDepthSort();
    }

    _onAnimationUpdate(changed, context) {
      super._onAnimationUpdate(changed, context);
      if (!this.mesh) return;
      if (changed.x || changed.y) {
        applyDepthSort();
      }
    }

  };
}

export function applyDepthSort() {
  const sortList = sortPlaceableByPosition();
  sortList.reverse();

  const anyTokenControlled = canvas.tokens.controlled.length > 0;

  // console.log("sortList",sortList)

  for (let i = 0; i < sortList.length; i++) {
    const currentSprite = sortList[i].object;
    // console.log(currentSprite[i])
    currentSprite.mesh.sort = i; // if this is commented, tokens render above all tiles
    currentSprite.document.sort = i; // if this is commented, tokens render above SW tiles but under se tiles
    if (currentSprite.document.documentName === "Tile" && currentSprite.mesh){
      // this tricks the tile mesh to act as if it was a bit higher then the t
      currentSprite.mesh.elevation = currentSprite.mesh.occlusionMode !== 0? currentSprite.document.elevation + OCCLUSION_ELEVATION_OFFSET: currentSprite.document.elevation;
    }
    // fix the texture elevation bump when a token is controlled , keeping tile sort order uniform so occlusion can trigger without causing visual glitches.
    currentSprite.mesh.elevation = anyTokenControlled? currentSprite.document.elevation + OCCLUSION_ELEVATION_OFFSET: currentSprite.document.elevation;
  }

  canvas.primary.sortDirty = true;
}

export function wrapTileTestOcclusion() {
  const PrimarySpriteMesh = foundry.canvas.primary.PrimarySpriteMesh;
  const originalTestOcclusion = PrimarySpriteMesh.prototype.testOcclusion;

  PrimarySpriteMesh.prototype.testOcclusion = function (token, options) {
    const tileDocument = this.object?.document;
    const isSortableTile =
    tileDocument instanceof CONFIG.Tile.documentClass &&
    this.occlusionMode !== 0 &&
    tileDocument.getFlag(
      isometricModuleConfig.MODULE_ID,
      "isoTileAutoSortingEnabled",
    );

    if (!isSortableTile) {
      return originalTestOcclusion.call(this, token, options);
    }
    // add extra trigger conditions to tiles with occlusion modes when a token is currently selected is sorted "behind the tile"
    if (!token.controlled || !token.mesh) return false;
    if (token.mesh.sort >= this.sort) return false;
    return originalTestOcclusion.call(this, token, options);
  };
}