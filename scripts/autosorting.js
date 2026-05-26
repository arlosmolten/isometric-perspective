import { isometricModuleConfig } from './consts.js';
import { 
  sortPlaceableByPosition,
  sortPlaceableByRegion,
  debugCanvasLayer,
  toggleAnchorAxis
} from './utils.js';

export function isoDepthSortTileMixin(Base){
  return class DepthSortTile extends (Base){

    _refreshState() {
      super._refreshState();
      const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;
      if (isTileSortable){
        this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS; 
      } else { 
        this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES; 
      }
      // applyDepthSort(this);
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      const isTileSortable = this.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoTileAutoSortingEnabled');
      if(isTileSortable){
        // if(this.controlled){ // show gizmo on selected WIP
        //   toggleAnchorAxis(this.document, true); 
        // }

        // if(!this.controlled){ // hide gizmo on unselected WIP
        //   toggleAnchorAxis(this.document, false);
        // }
        applyDepthSort(this);
      }      
      
    }
  }
}

export function isoDepthSortTokenMixin(Base){  
  return class DepthSortPlaceable extends Base{

    _refreshState() {
      super._refreshState();
      const currentRegions = Array.from(this.document.regions).map(region => region);
      const currentRegion = currentRegions[0]?._id;
      if(currentRegion){
        this.document.setFlag(isometricModuleConfig.MODULE_ID, 'currentRegion', currentRegion);
      } else {
        this.document.setFlag(isometricModuleConfig.MODULE_ID, 'currentRegion', null);
      }
      // applyDepthSort(this);
    }

    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      applyDepthSort(this);
    }
  }
}

export function applyDepthSort(placeable){
  const sortList = sortPlaceableByPosition(placeable);
  for (let i = 0; i < sortList.length; i++) {
    const currentSprite = sortList[i].sprite;
    
    if(currentSprite.sort !== i){
      console.log("sort changed:", currentSprite.object.document.name, "OLD:", currentSprite.sort,"NEW:", i)
    }

    currentSprite.sort = i; // if this is commented, tokens render above all tiles
    currentSprite.object.document.sort = i; // if this is commented, tokens render above SW tiles but under se tiles 
    currentSprite.zIndex = i;
    currentSprite.object.zIndex = i;

    // console.log("currentSprite", currentSprite.object.document.name,currentSprite.sort)
  }

  // debugCanvasLayer(sortList) //-------------------------------------------------------------------------- DEBUG!!!
}