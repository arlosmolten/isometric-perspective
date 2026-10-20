import { 
  isometricModuleConfig,
  OCCLUSION_ELEVATION_OFFSET
} from "./consts.js";
import {
  sortPlaceableByPosition,
  toggleAnchorAxis,
} from "./utils.js";
import { applyIsometricTransformation } from "./transform.js";

export function isoDepthSortTileMixin(Base) {
  return class DepthSortTile extends Base {
        
    applyRenderFlags(flags) {
      super.applyRenderFlags(flags);
      if (!this.mesh) return;
      applyIsometricTransformation(this, this.isSceneIsometric);
      if (this.isTileSortable) applyDepthSort();
    }

    _refreshState() {
      super._refreshState();
      if (!this.mesh) return;

      this.mesh.sortLayer = this.isTileSortable
          ? foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS
          : foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES;

      if (this.document.getFlag(isometricModuleConfig.MODULE_ID,"isoOffsetGizmoEnabled",) === true){
        toggleAnchorAxis(this.document, true);
        // if(this.controlled){ // show gizmo on selected WIP
        //    drawWallBoundaries(this.document.mesh);
        // }
      }
    }

    get isTileSortable() {
      return (this.document.getFlag(isometricModuleConfig.MODULE_ID,"isoTileAutoSortingEnabled",) || false);
    }

    get isSceneIsometric() {
      return (this.scene.getFlag(isometricModuleConfig.MODULE_ID,"isometricEnabled",));
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