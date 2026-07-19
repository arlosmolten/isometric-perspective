import { isometricModuleConfig } from "./consts.js";
import {
  sortPlaceableByPosition,
  // debugCanvasLayer,
  toggleAnchorAxis,
} from "./utils.js";

export function isoDepthSortTileMixin(Base) {
  return class DepthSortTile extends Base {
    _refreshState() {
      super._refreshState();
      const isTileSortable =
        this.document.flags[isometricModuleConfig.MODULE_ID]
          ?.isoTileAutoSortingEnabled || false;
      if (isTileSortable) {
        this.mesh.sortLayer =
          foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
      } else {
        this.mesh.sortLayer =
          foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES;
      }
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      const isTileSortable = this.document.getFlag(
        isometricModuleConfig.MODULE_ID,
        "isoTileAutoSortingEnabled",
      );
      if (isTileSortable) {
        // if(this.controlled){ // show gizmo on selected WIP
        //   toggleAnchorAxis(this.document, true);
        // }

        // if(!this.controlled){ // hide gizmo on unselected WIP
        //   toggleAnchorAxis(this.document, false);
        // }
        applyDepthSort();
      }
    }
  };
}

export function isoDepthSortTokenMixin(Base) {
  return class DepthSortPlaceable extends Base {
    _refreshState() {
      super._refreshState();
      const currentRegions = Array.from(this.document.regions).map(
        (region) => region,
      );
      const currentRegion = currentRegions[0]?._id;
      if (currentRegion) {
        this.document.setFlag(
          isometricModuleConfig.MODULE_ID,
          "currentRegion",
          currentRegion,
        );
      } else {
        this.document.setFlag(
          isometricModuleConfig.MODULE_ID,
          "currentRegion",
          null,
        );
      }
    }

    _onAnimationUpdate(changed, context) {
      super._onAnimationUpdate(changed, context);
      if (changed.x || changed.y) {
        applyDepthSort();
      }
    }
  };
}

export function applyDepthSort() {
  const sortList = sortPlaceableByPosition(); //.map(({sprite}) => sprite);
  sortList.reverse();
  for (let i = 0; i < sortList.length; i++) {
    const currentSprite = sortList[i].object;
    currentSprite.mesh.sort = i; // if this is commented, tokens render above all tiles
    currentSprite.document.sort = i; // if this is commented, tokens render above SW tiles but under se tiles
  }

  canvas.primary.sortDirty = true;
}
