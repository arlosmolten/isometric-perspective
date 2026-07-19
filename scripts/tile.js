import {
  isometricModuleConfig,
  TILE_FACINGS,
  DEFAULT_TILE_FACING,
} from "./consts.js";
import { applyIsometricTransformation } from "./transform.js";
import {
  adjustInputWithMouseDrag,
  parseNum,
  patchConfig,
  createAdjustableButton,
  toggleAnchorAxis,
} from "./utils.js";

export async function createTileIsometricTab(app, html, data) {
  const tileTabConfig = {
    moduleConfig: isometricModuleConfig,
    label: game.i18n.localize("isometric-perspective.tab_isometric_name"),
    tabGroup: "sheet",
    tabId: "isometric",
    icon: "fas fa-cube",
    templatePath: "modules/isometric-perspective/templates/tile-config.hbs",
  };

  // Tile config data
  const FoundryTileConfig = foundry.applications.sheets.TileConfig;
  const DefaultTileConfig = Object.values(CONFIG.Tile.sheetClasses.base).find(
    (d) => d.default,
  )?.cls;
  const TileConfig =
    DefaultTileConfig?.prototype instanceof FoundryTileConfig
      ? DefaultTileConfig
      : FoundryTileConfig;

  const tileFacings = TILE_FACINGS.map((obj) => obj.facing);
  const currentTileFacing =
    TileConfig.object?.getFlag(isometricModuleConfig.MODULE_ID, "tileFacing") ??
    DEFAULT_TILE_FACING;

  const wallFacingConfig = {
    tileFacing: tileFacings,
    document: currentTileFacing,
  };

  patchConfig(TileConfig, tileTabConfig, wallFacingConfig);

  // set the depht sort settings to false by default on game ready ( prevent the toggled state to remain active on reload )
  game.settings.set(isometricModuleConfig.MODULE_ID,"depthSortActiveFlag",false);
}

export function initTileForm(app, html, context, options) {
  //Tile art offset
  createAdjustableButton({
    buttonElement: html.querySelector(".fine-adjust"),
    inputs: [
      html.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
      html.querySelector('input[name="flags.isometric-perspective.offsetY"]'),
    ],
    adjustmentScale: [0.1, 0.1],
    roundingPrecision: 2,
  });

  //Dynamic tile and wall linking
  const selectWallButton = html.querySelector(".select-wall");
  const clearWallButton = html.querySelector(".clear-wall");
  const linkedWallsIdInput = html.querySelector(
    'input[name="flags.isometric-perspective.linkedWallIds"]',
  );
  const gizmoEnabledCheckbox = html.querySelector(
    'input[name="flags.isometric-perspective.isoOffsetGizmoEnabled"]',
  );

  // Initialize values
  const currentOffsetX = app.document.getFlag(
    isometricModuleConfig.MODULE_ID,
    "offsetX",
  );
  const currentOffsetY = app.document.getFlag(
    isometricModuleConfig.MODULE_ID,
    "offsetY",
  );
  const currentScale = app.document.getFlag(
    isometricModuleConfig.MODULE_ID,
    "scale",
  );

  // Art offset
  // since the introduction of placeable palettes tools , adding references to UI elements like this cause an error if there is no checker to see if the
  // ui element reference exist.
  if (gizmoEnabledCheckbox) {
    gizmoEnabledCheckbox.addEventListener("change", (event) => {
      const tileDocument = context.document;
      if (event.target.checked) {
        tileDocument.setFlag(
          isometricModuleConfig.MODULE_ID,
          "isoOffsetGizmoEnabled",
          true,
        );
        toggleAnchorAxis(tileDocument, true);
      } else {
        tileDocument.setFlag(
          isometricModuleConfig.MODULE_ID,
          "isoOffsetGizmoEnabled",
          false,
        );
        toggleAnchorAxis(tileDocument, false);
      }
    });
  }

  const inputOffsetX = html.querySelector(
    'input[name="flags.isometric-perspective.offsetX"]',
  );
  const inputOffsetY = html.querySelector(
    'input[name="flags.isometric-perspective.offsetY"]',
  );
  const inputScale = html.querySelector(
    'range-picker[name="flags.isometric-perspective.scale"]',
  );

  if (inputOffsetX) inputOffsetX.value = currentOffsetX ?? 0;
  if (inputOffsetY) inputOffsetY.value = currentOffsetY ?? 0;
  if (inputScale) inputScale.value = currentScale ?? 1;

  selectWallButton?.addEventListener("click", selectWall);
  clearWallButton?.addEventListener("click", clearWall);

  // Tile config data
  const FoundryTileConfig = foundry.applications.sheets.TileConfig;
  const DefaultTileConfig = Object.values(CONFIG.Tile.sheetClasses.base).find(
    (d) => d.default,
  )?.cls;
  const TileConfig =
    DefaultTileConfig?.prototype instanceof FoundryTileConfig
      ? DefaultTileConfig
      : FoundryTileConfig;

  function selectWall(event) {
    Object.values(ui.windows)
      .filter((w) => w instanceof TileConfig)
      .forEach((j) => j.minimize());
    canvas.walls.activate();

    Hooks.once("controlWall", async (wall) => {
      const selectedWallId = wall.id.toString();
      const flagIds =
        tile.document.getFlag("isometric-perspective", "linkedWallIds") || [];
      const currentWallIds = [].concat(flagIds);

      // Add the new ID only if it is not already in the list.
      if (!currentWallIds.includes(selectedWallId)) {
        const newWallIds = [...currentWallIds, selectedWallId];
        await app.document.setFlag(
          isometricModuleConfig.MODULE_ID,
          "linkedWallIds",
          newWallIds,
        );
      }

      // Returns the window to its original position and activates the TileLayer layer.
      Object.values(ui.windows)
        .filter((w) => w instanceof TileConfig)
        .forEach((j) => j.maximize());
      canvas.tiles.activate();
    });
  }

  async function clearWall() {
    await app.document.setFlag(
      isometricModuleConfig.MODULE_ID,
      "linkedWallIds",
      [],
    );
    if (linkedWallsIdInput) linkedWallsIdInput.value = "";
  }
}

export function closeConfig(app) {
  const tileDocument = app.options.document;
  if (
    tileDocument.getFlag(
      isometricModuleConfig.MODULE_ID,
      "isoOffsetGizmoEnabled",
    ) === true
  ) {
    tileDocument.setFlag(
      isometricModuleConfig.MODULE_ID,
      "isoOffsetGizmoEnabled",
      false,
    );
    toggleAnchorAxis(tileDocument, false);
  }
}

export function handleCreateTile(tileDocument) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(
    isometricModuleConfig.MODULE_ID,
    "isometricEnabled",
  );
  requestAnimationFrame(() =>
    applyIsometricTransformation(tile, isSceneIsometric),
  );

  const isDepthSortEnabled = game.settings.get(
    isometricModuleConfig.MODULE_ID,
    "depthSortActiveFlag",
  );

  console.log("isDepthSortEnabled", isDepthSortEnabled);

  if (isDepthSortEnabled) {
    tile.document.setFlag(
      isometricModuleConfig.MODULE_ID,
      "isoTileAutoSortingEnabled",
      true,
    );
  } else {
    tile.document.setFlag(
      isometricModuleConfig.MODULE_ID,
      "isoTileAutoSortingEnabled",
      false,
    );
  }
}

export function handleUpdateTile(tileDocument, updateData, options, userId) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  const scene = tile.scene;

  const isSceneIsometric = scene.getFlag(
    isometricModuleConfig.MODULE_ID,
    "isometricEnabled",
  );
  if (
    updateData.x !== undefined ||
    updateData.y !== undefined ||
    updateData.width !== undefined ||
    updateData.height !== undefined ||
    updateData.texture !== undefined
  ) {
    requestAnimationFrame(() =>
      applyIsometricTransformation(tile, isSceneIsometric),
    );
  }

  if (
    tileDocument.getFlag(
      isometricModuleConfig.MODULE_ID,
      "isoOffsetGizmoEnabled",
    ) === true
  ) {
    toggleAnchorAxis(tileDocument, true);
  }
}

export function handleRefreshTile(tile) {
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(
    isometricModuleConfig.MODULE_ID,
    "isometricEnabled",
  );
  applyIsometricTransformation(tile, isSceneIsometric);

  if (
    tile.document.getFlag(
      isometricModuleConfig.MODULE_ID,
      "isoOffsetGizmoEnabled",
    ) === true
  ) {
    toggleAnchorAxis(tile.document, true);
  }
}

export function addDepthSortControls(controls) {
  controls.tiles.tools.toggleDephtSort = {
    name: "toggleDephtSort",
    title: "Toggle depth sort",
    icon: "fa-solid fa-sort",
    order: Object.keys(controls.tiles.tools).length,
    toggle: true,
    visible: game.user.isGM,
    onChange: (event, toggled) => {
      game.settings.set(
        isometricModuleConfig.MODULE_ID,
        "depthSortActiveFlag",
        toggled,
      );
    },
  };
}

export function createTileIsometricPaletteConfig(app, html, data){
  
  const doc = app.document;
  const scope = isometricModuleConfig.MODULE_ID;
  const videoSection = html.querySelector('details[data-sync="details-video"]');
  
  // offsetX input config
  const offsetXInputLabel = document.createElement("label");
  offsetXInputLabel.innerHTML = '<label>X</label>'
  
  const offsetXInput = foundry.applications.fields.createNumberInput({
    name: `flags.${scope}."offsetY"`, 
    value:doc.getFlag(scope, "offsetY") ?? 0 
  });

  // offsetY input config
  const offsetYInputLabel = document.createElement("label");
  offsetYInputLabel.innerHTML = '<label>Y</label>'

  const offsetYInput = foundry.applications.fields.createNumberInput({
    name:`flags.${scope}.offsetX`, 
    value:doc.getFlag(scope, "offsetX") ?? 0 
  });

  // tileFacing input config
  const tileFacings = TILE_FACINGS.map((obj) => obj.facing);
  const tileFacingsOptions = [];
  tileFacings.map( facing => {
    tileFacingsOptions.push({
      label: facing,
      value: facing
    })
  })
  
  const tileFacinginput = foundry.applications.fields.createSelectInput({
    name: `flags.${scope}.tileFacing`,
    value: doc.getFlag(scope, "tileFacing" ?? DEFAULT_TILE_FACING),
    options: tileFacingsOptions,
    blank: ""
  });

  // form groups
  const offsetGroup = foundry.applications.fields.createFormGroup({ 
    input:[offsetYInputLabel,offsetXInput,offsetXInputLabel,offsetYInput,], 
    label: "isometric-perspective.tile_artOffset_name", 
    localize: true
  });

  const facingGroup = foundry.applications.fields.createFormGroup({ 
    input:[tileFacinginput], 
    label: "isometric-perspective.tile_set_tile_facing", 
    localize: true
  });

  videoSection.insertAdjacentElement("afterend", facingGroup);
  videoSection.insertAdjacentElement("afterend", offsetGroup);
  
}