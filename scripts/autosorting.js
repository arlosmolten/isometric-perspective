import { 
  isometricModuleConfig,
  OCCLUSION_ELEVATION_OFFSET,
  DEFAULT_TILE_FACING,
  fastFlipCompatiility
} from "./consts.js";
import {
  toggleAnchorAxis,
  getWallDimensions,
  getSpriteAnchorPoint,
  getPlaceableGeometry, // used later in depth sort
  renderPlaceableGeometry,
} from "./utils.js";
import { applyIsometricTransformation } from "./transform.js";

export function isoDepthSortTileMixin(Base) {
  return class DepthSortTile extends Base {
        
    // used to be in refreshState but caused too many updates and desync , see https://foundryvtt.com/api/v14/classes/foundry.canvas.interaction.RenderFlags.html
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

    applyRenderFlags(flags) {
      super.applyRenderFlags(flags);
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
  for (let i = 0; i < sortList.length; i++) {
    const currentSprite = sortList[i].object;
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

// filter the sort layer into a new array of sortables, copy that array , sort the copy and return the result.
export function sortPlaceableByPosition() {
  const placeableMeshLayer =
    foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
  const canvasLayer = canvas.primary.children;

  const filteredLayer = canvasLayer.filter((sprite) => {
    return sprite.sortLayer === placeableMeshLayer;
  }); // only need DepthSortPlaceables
  
  let layerToSort = filteredLayer.map((sprite) => Object.assign({}, sprite));

  layerToSort.sort((sprite, sibling) => {
    const currentSprite = new SortableSprite(sprite);
    const currentSibling = new SortableSprite(sibling);
    return currentSprite.sortByDepth(currentSibling);
  });

  layerToSort.sort((sprite, sibling) => {
    const currentSprite = new SortableSprite(sprite);
    const currentSibling = new SortableSprite(sibling);
    return currentSprite.getSortByFacing(currentSibling);
  });
  
  return layerToSort;
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

// SortableSprite is a data class with some utility methods to avoid long chains of sprite.object.document.someValue in the code and overall make the
// sorting code a bit more readable. Also help isolate cases and avoid endless nesting comparaison, the utility methods always check for validiy as well.
// isFacing() if its a tile, return the right facing state, taking in account if its flipped for SW and SE facings.
// isTile() return true if its a tile, a bit shorter than doing a full comparaison everytime its needed.
// isToken() return true if its a token, a bit shorter than doing a full comparaison everytime its needed.
// isFlipped() return true if the tile is either flipped via the tileFlipped flag or if fast flip is installed , based on tileMirrorHorizontal in that case.
// isNotNull() in case an invalid object is passed in the constructor, dosent break but marked as null , used when during the token sort correction when traversing the
// layerToSort if the token is at index 0 or at index layerToSort.length , again, used to make code a bit more readable and to rely less on "===" checks clutters everywhere.
// getDebugData([args,...]) display SortableSprite props in a nice table for debugging purpose
// getSortByFacing(sibling) take another adjacent SortableSprite and compare their x , y or iso depth based on facing rules and return a positive or negative value to determine sort order:
// a negative value indicate that the sibling should be sorted below
// a positive value indicate that the sibling should be sorted above
// zero or NaN indicate a tie , no changes need to happen.
//
export class SortableSprite {
  constructor(placeable) {
    if (placeable) {
      this.mesh = placeable.object.mesh;
      this.id = placeable.object.document.id;
      this.type = placeable.object.document.documentName;
      this.name = placeable.object.document.name
        ? placeable.object.document.name
        : "no name";

      this.width = placeable.object.mesh.width ?? 0;
      this.height = placeable.object.mesh.height ?? 0;
      this.x = placeable.object.document.x;
      this.y = placeable.object.document.y;

      this.facingConfig =
        placeable.object.document.getFlag(
          isometricModuleConfig.MODULE_ID,
          "tileFacing",
        ) ?? DEFAULT_TILE_FACING;
      this.sort = placeable.object.document.sort;

      this.preview = placeable.object.previewType;
      if (game.modules.get(fastFlipCompatiility.MODULE_ID)?.active) {
        this.tileMirrorHorizontal = placeable.object.document.getFlag(
          fastFlipCompatiility.MODULE_ID,
          fastFlipCompatiility.TILE_MIRROR_HORIZONTAL,
        );
      }

      this.geometry = getSpriteAnchorPoint(this.mesh);
      if (this.type === "Tile") {
        const wallDimensions = getWallDimensions(this.mesh, this.isFacing());
        if (wallDimensions) this.geometry = wallDimensions;
      }
      const anchorPoint = this.geometry.anchorPoint ?? this.geometry;
      this.isoDepth = (anchorPoint.y - anchorPoint.x) * 0.5;

    } else {
      this.isNull = true;
    }
  }
  // status checks
  isFacing() {
    let currentFacing = null;
    if (this.type !== "Tile") return null;
    switch (this.facingConfig) {
      case "south west":
        currentFacing = this.isFlipped() ? "south east" : "south west";
        break;
      case "south east":
        currentFacing = this.isFlipped() ? "south west" : "south east";
        break;
      case "south":
        currentFacing = "south";
        break;
      case "side":
        currentFacing = "side";
        break;
      default:
        currentFacing = null;
    }
    return currentFacing;
  }

  isTile() {
    return this.type === "Tile";
  }
  isToken() {
    return this.type === "Token";
  }
  isNotNull() {
    return !this.isNull;
  }
  isPreview() {
    return this.preview !== null;
  }

  isFlipped() {
    let result = false;
    if (this.mesh) {
      const scaleFlipped = this.mesh.scale.x < 0;
      const textureFlipped = this.mesh.texture.rotate >= 8;
      if (scaleFlipped !== textureFlipped) {
        result = true;
      }
    }
    return result;
  }

  // a more precise detection area for depth sort that use the new geometry area calculation 
  isWithinDetectionArea(sibling) {
    const area = this.geometry.detectionArea;
    if (!area) return false;
    const origin = area[3];
    const across = { x: area[0].x - origin.x, y: area[0].y - origin.y };
    const along = { x: area[2].x - origin.x, y: area[2].y - origin.y };
    const delta = { x: sibling.geometry.x - origin.x, y: sibling.geometry.y - origin.y };
    const determinant = across.x * along.y - across.y * along.x;
    if (determinant === 0) return false;
    const acrossAmount = (delta.x * along.y - delta.y * along.x) / determinant;
    const alongAmount = (across.x * delta.y - across.y * delta.x) / determinant;
    return acrossAmount >= 0 && acrossAmount <= 1 && alongAmount >= 0 && alongAmount <= 1;
  }

  sortByDepth(sibling) {
    const depthDifference = sibling.isoDepth - this.isoDepth;
    // tie breaker , tokens remain sorted behind tiles by default, not the ebst case but better than the opposite.
    // a better solution should be researched later.
    if (depthDifference !== 0) return depthDifference;
    if (this.isTile() && sibling.isToken()) return 1;
    if (this.isToken() && sibling.isTile()) return -1;
    return this.id < sibling.id ? 1 : -1;
  }

  getSortByFacing(sibling) {
    let depthScore = 0;
    if (this.isTile() && sibling.isToken()) {
      
    // renderPlaceableGeometry([this, sibling]); // for debugging

      const anchorPoint = this.geometry.anchorPoint;
      switch (this.isFacing()) {
        case "south west":
          if (this.isWithinDetectionArea(sibling)) {
            depthScore = anchorPoint.x - sibling.geometry.x;
          }
          break;
        case "south east":
          if (this.isWithinDetectionArea(sibling)) {
            depthScore = sibling.geometry.y - anchorPoint.y;
          }
          break;
        default: break;
      }
    } else if (this.isToken() && sibling.isTile()) {
      depthScore = -sibling.getSortByFacing(this);
    }
    return depthScore;
  }

  getDebugData(data) {
    const debugData = {};
    for (const [key, value] of Object.entries(this)) {
      data.map((entry) => {
        if (entry === key) {
          debugData[key] = value;
        }
      });
    }
    console.table(debugData);
  }
}