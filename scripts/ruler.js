import { isometricModuleConfig } from './consts.js';
import { cartesianToIso } from './utils.js';

/**
 * Patch the TokenRuler to correctly position labels in isometric scenes.
 */
export function registerRuler() {
  const ParentRuler = CONFIG.Token.rulerClass;
  if (!ParentRuler) return;
  
  // Check if we've already extended it to avoid infinite recursion or multiple layers
  if (ParentRuler.prototype.hasOwnProperty("_isIsometricRuler")) return;

  /**
   * Subclass the currently active TokenRuler to add isometric label positioning.
   */
  class TokenRulerIsometric extends ParentRuler {
    get _isIsometricRuler() { return true; }

    _getWaypointLabelContext(waypoint, state) {
      const ctx = super._getWaypointLabelContext(waypoint, state);
      if (!ctx?.position || !canvas.scene) return ctx;

      const isIsometric = canvas.scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
      const worldIsoEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");
      if (!worldIsoEnabled || !isIsometric) return ctx;

      const token = this.sourceToken;
      
      // 1. Start with the logical grid position
      let x = ctx.position.x;
      let y = ctx.position.y;

      // 2. Apply Token Offsets (Elevation/Art Offset) to match the mesh exactly
      if (token?.document) {
        const doc = token.document;
        const elevationAdjustment = game.settings.get(isometricModuleConfig.MODULE_ID, "enableHeightAdjustment");
        let ox = doc.getFlag(isometricModuleConfig.MODULE_ID, "offsetX") || 0;
        let oy = doc.getFlag(isometricModuleConfig.MODULE_ID, "offsetY") || 0;
        
        if (elevationAdjustment) {
            const elev = doc.elevation || 0;
            const gridSize = canvas.scene.grid.size;
            const gridDist = canvas.scene.grid.distance;
            // Formulas from transform.js to match visual height
            const factor = (gridSize / gridDist) * Math.sqrt(2);
            ox += (elev * factor) / (doc.width || 1);
        }

        if (ox !== 0 || oy !== 0) {
            // Apply projection for height/art offsets as used in transform.js
            const isoOffsets = cartesianToIso(ox, oy);
            x += isoOffsets.x * (doc.width || 1);
            y += isoOffsets.y * (doc.height || 1);
        }
      }

      // 3. Project to Screen Space using the Stage's exact transform
      // This automatically accounts for rotation, skew, and zoom.
      const projected = canvas.stage.toGlobal({x, y});
      
      // 4. Map screen coordinates back to HUD relative coordinates (accounting for zoom scale)
      const hud = document.getElementById("hud");
      if ( hud ) {
          const hudRect = hud.getBoundingClientRect();
          const zoom = canvas.stage.scale.x;

          ctx.position.x = (projected.x - hudRect.left) / zoom;
          ctx.position.y = (projected.y - hudRect.top) / zoom;
      }
      
      if ( !ctx.cssClass ) ctx.cssClass = "";
      const classes = new Set(ctx.cssClass.split(" ").filter(Boolean));
      classes.add("iso-ruler-label");
      ctx.cssClass = Array.from(classes).join(" ");

      return ctx;
    }
  }

  CONFIG.Token.rulerClass = TokenRulerIsometric;
  if (isometricModuleConfig.DEBUG_PRINT) console.log("Isometric Perspective | Extended TokenRuler via subclassing.");
}
