import { registerSceneConfig } from './scene.js';
import { registerTokenConfig } from './token.js';
import { registerTileConfig } from './tile.js';
import { registerHUDConfig } from './hud.js';
import { registerSortingConfig } from './autosorting.js';
import { registerDynamicTileConfig, increaseTilesOpacity, decreaseTilesOpacity } from './dynamictile.js';

import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { ISOMETRIC_CONST } from './consts.js';
import { isoToCartesian, cartesianToIso } from './utils.js';

//import { registerOcclusionConfig } from './silhouetetoken.js';
import { registerOcclusionConfig } from './occlusion.js';
//import { registerOcclusionConfig } from './occlusion2 v15 (cpu gpu choose).js';  // choose between cpu (working, heavy on performance) and gpu (not fully working)
//import { registerOcclusionConfig } from './occlusion2 v21 (simple test 2).js';   // different approach to solution (not fully working)
//import { registerOcclusionConfig } from './occlusion3.js';                       // has token-token occlusion (not fully working)


// application v2 update
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

// ---------- CONSTANTS ----------
const MODULE_ID = "isometric-perspective";
let DEBUG_PRINT;
let WORLD_ISO_FLAG;
let FOUNDRY_VERSION;

export { MODULE_ID };
export { DEBUG_PRINT };
export { WORLD_ISO_FLAG };
export { FOUNDRY_VERSION };


// Hook to register module configuration in Foundry VTT
Hooks.once("init", function() {
  
  // ------------- Registra as configurações do módulo ------------- 
  // Checkbox configuration to enable or disable isometric mode globally
  game.settings.register(MODULE_ID, "worldIsometricFlag", {
    name: game.i18n.localize('isometric-perspective.settings_main_name'), //name: "Enable Isometric Perspective",
    hint: game.i18n.localize('isometric-perspective.settings_main_hint'), //hint: "Toggle whether the isometric perspective is applied to the canvas.",
    scope: "world",  // "world" = sync to db, "client" = local storage
    config: true,    // false if you dont want it to show in module config
    type: Boolean,   // You want the primitive class, e.g. Number, not the name of the class as a string
    default: true, 
    requiresReload: true // true if you want to prompt the user to reload
    //onChange: settings => window.location.reload() // recarrega automaticamente
  });

  game.settings.register(MODULE_ID, 'enableHeightAdjustment', {
    name: game.i18n.localize('isometric-perspective.settings_height_name'), //name: 'Enable Height Adjustment',
    hint: game.i18n.localize('isometric-perspective.settings_height_hint'), //hint: 'Toggle whether token sprites adjust their position to reflect their elevation',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableTokenVisuals', {
    name: game.i18n.localize('isometric-perspective.settings_visuals_name'), //name: 'Enable Token Visuals',
    hint: game.i18n.localize('isometric-perspective.settings_visuals_hint'), //hint: 'Displays a circular shadow and a vertical red line to indicate token elevation. Requires "Enable Height Adjustment" to be active.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableOcclusionDynamicTile', {
    name: game.i18n.localize('isometric-perspective.settings_dynamic_tile_name'), //name: 'Enable Occlusion: Dynamic Tile',
    hint: game.i18n.localize('isometric-perspective.settings_dynamic_tile_hint'), //hint: '(BETA FEATURE. USE WITH CAUTION) Adjusts the visibility of tiles dynamically with the positioning of tokens. See how this feature works here.',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableAutoSorting', {
    name: game.i18n.localize('isometric-perspective.settings_token_sort_name'), //name: 'Enable Automatic Token Sorting',
    hint: game.i18n.localize('isometric-perspective.settings_token_sort_hint'), //hint: '(BETA FEATURE. USE WITH CAUTION) Automatically adjusts the token\'s sort property value when moving it around the canvas.',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  /*
  game.settings.register(MODULE_ID, 'enableOcclusionTokenSilhouette', {
    name: game.i18n.localize('isometric-perspective.settings_token_silhouette_name'), //name: 'Enable Occlusion: Token Silhouette',
    hint: game.i18n.localize('isometric-perspective.settings_token_silhouette_hint'), //hint: 'Adjusts the visibility of tiles dynamically with the positioning of tokens. See how this feature works here.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });
  */
  
  game.settings.register(MODULE_ID, 'enableOcclusionTokenSilhouette', {
    name: game.i18n.localize('isometric-perspective.settings_token_silhouette_name'), //'Enable Occlusion: Token Silhouette',
    hint: game.i18n.localize('isometric-perspective.settings_token_silhouette_hint'), //'Adjusts the visibility of tiles dynamically with the positioning of tokens.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      "off": "Off",
      "gpu": "GPU Mode",
      "cpu1": "CPU Mode (Chunk Size 1)",
      "cpu2": "CPU Mode (Chunk Size 2)",
      "cpu3": "CPU Mode (Chunk Size 3)", 
      "cpu4": "CPU Mode (Chunk Size 4)",
      "cpu6": "CPU Mode (Chunk Size 6)",
      "cpu8": "CPU Mode (Chunk Size 8)",
      "cpu10": "CPU Mode (Chunk Size 10)"
    },
    default: "off",
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "showWelcome", {
    name: game.i18n.localize('isometric-perspective.settings_welcome_name'),
    hint: game.i18n.localize('isometric-perspective.settings_welcome_hint'),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, 'debug', {
    name: game.i18n.localize('isometric-perspective.settings_debug_name'), //name: 'Enable Debug Mode',
    hint: game.i18n.localize('isometric-perspective.settings_debug_hint'), //hint: 'Enables debug prints.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
    //onChange: settings => window.location.reload()
  });









  // ------------- Registra os atalhos do módulo ------------- 
  
  game.keybindings.register(MODULE_ID, 'increaseTilesOpacity', {
    name: game.i18n.localize('isometric-perspective.keybindings_increase_tile_opacity'), //name: 'Increase Tile Opacity',
    hint: game.i18n.localize('isometric-perspective.keybindings_increase_tile_opacity_hint'), //hint: 'Increases the opacity of always visible tiles.',
    editable: [
        { key: 'NumpadAdd', modifiers: ['Control'] }
    ],
    onDown: () => {
        increaseTilesOpacity();
    },
    restricted: false,
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, 'decreaseTilesOpacity', {
    name: game.i18n.localize('isometric-perspective.keybindings_decrease_tile_opacity'), //name: 'Decrease Tile Opacity',
    hint: game.i18n.localize('isometric-perspective.keybindings_decrease_tile_opacity_hint'), //hint: 'Decreases the opacity of always visible tiles.',
    editable: [
        { key: 'NumpadSubtract', modifiers: ['Control'] }
    ],
    onDown: () => {
        decreaseTilesOpacity();
    },
    restricted: false,
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  




  // ------------- Executa os hooks essenciais do módulo -------------
  registerSceneConfig();
  registerTokenConfig();
  registerTileConfig();
  registerHUDConfig();

  // ------------- Executa os hooks de funcionalidades adicionais do módulo -------------
  registerDynamicTileConfig();
  registerSortingConfig();
  registerOcclusionConfig();

  
  
  
  
  
  // Define global debug print variable
  if (game.settings.get(MODULE_ID, "debug"))
    DEBUG_PRINT = true;
  else DEBUG_PRINT = false;

  if (game.settings.get(MODULE_ID, "worldIsometricFlag"))
    WORLD_ISO_FLAG = true;
  else WORLD_ISO_FLAG = false;

  FOUNDRY_VERSION = parseInt(game.version.split(".")[0]); // Extrai a versão principal

});



// Welcome Message Setup
export class WelcomeScreen extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: ["welcome-screen"],
    position:{
      width: 600,
      height: 620,
    },
    window:{
      resizable: false,
      title: "isometric-perspective.title"
    }
  }

  static PARTS = {
    div: {
      template: "modules/isometric-perspective/templates/welcome.hbs",
    }
  }
}

// Verifica se deve mostrar a tela de boas-vindas
// Checks whether to show the welcome screen

Hooks.once('ready', ()=> {
  if (game.settings.get(MODULE_ID, "showWelcome")) {
    const welcome = new WelcomeScreen();
    welcome.render(true);
  }
});

// Adding the scene config data
Hooks.on('ready', ()=> {
  // Tabs component data
  const label = game.i18n.localize("isometric-perspective.tab_isometric_name");
  const tabGroup = "sheet";
  const tabId = "isometric";
  const icon = "fas fa-cube"
  const isoTemplatePath = 'modules/isometric-perspective/templates/isometric-tab.hbs'

  // Scene config data
  const FoundrySceneConfig = foundry.applications.sheets.SceneConfig;
  const DefaultSceneConfig = Object.values(CONFIG.Scene.sheetClasses.base).find((d) => d.default).cls;
  const SceneConfig = DefaultSceneConfig?.prototype instanceof FoundrySceneConfig ? DefaultSceneConfig : FoundrySceneConfig;

  // Adding the isometric tab data to the scene config parts
  SceneConfig.TABS.sheet.tabs.push({ id: tabId, group: tabGroup, label , icon: icon }); 
  
  // Adding the part template
  SceneConfig.PARTS.isometric = {template: isoTemplatePath};
  
  const footerPart = SceneConfig.PARTS.footer;
  delete SceneConfig.PARTS.footer;
  SceneConfig.PARTS.footer = footerPart;

})


/**
 * @param {----- TESTING AREA / ÁREA DE TESTES -----}
*/
// Wait for movement animation end
// const anim = CanvasAnimation.getAnimation(token.animationName);
// if(anim?.promise) await anim.promise;













/*
// Hook registrations
Hooks.on('changeScene', initializeOcclusionLayer);

Hooks.on('canvasReady',  updateOcclusionLayer);
Hooks.on('canvasPan',    updateOcclusionLayer);
Hooks.on('refreshToken', updateOcclusionLayer);
Hooks.on('updateToken',  updateOcclusionLayer);
Hooks.on('updateTile',   updateOcclusionLayer);

// Module initialization
Hooks.once('ready', () => {
  if (canvas.ready) {
    initializeOcclusionLayer();
  }
});





// Global configuration for occlusion layer
const occlusionConfig = {
  layer: null,
  initialized: false
};

// Core occlusion layer initialization
function initializeOcclusionLayer() {
  // Remove existing layer if present
  if (occlusionConfig.layer) {
    canvas.stage.removeChild(occlusionConfig.layer);
    occlusionConfig.layer.destroy({ children: true });
  }

  // Create new occlusion layer
  occlusionConfig.layer = new PIXI.Container();
  occlusionConfig.layer.name = "OcclusionLayer";
  occlusionConfig.layer.eventMode = 'passive';
  occlusionConfig.layer.interactiveChildren = false;

  canvas.stage.addChild(occlusionConfig.layer);
  occlusionConfig.initialized = true;
}

// Update occlusion layer based on current scene state
function updateOcclusionLayer() {
  if (!canvas?.ready || !occlusionConfig.initialized) {
    return;
  }

  // Clear previous occlusion elements
  occlusionConfig.layer.removeChildren();

  const tokens = canvas.tokens.placeables;
  const tiles = canvas.tiles.placeables;

  tokens.forEach(token => {
    if (!token?.mesh) return;

    const intersectingTiles = tiles.filter(tile => 
      detectTextureIntersectionWithShader(token, tile)
    );

    if (intersectingTiles.length > 0) {
      const occlusionSprite = createOcclusionSprite(token, intersectingTiles);
      occlusionConfig.layer.addChild(occlusionSprite);
    }
  });
}

// Create occlusion sprite with advanced masking
function createOcclusionSprite(token, intersectingTiles) {
  const sprite = new PIXI.Sprite(token.mesh.texture.clone());

  // Copiar transformações exatamente como o token original
  sprite.position.copyFrom(token.mesh.position);
  sprite.anchor.copyFrom(token.mesh.anchor);
  sprite.rotation = token.mesh.rotation;
  sprite.scale.copyFrom(token.mesh.scale);
  sprite.alpha = token.mesh.alpha;
  
  // Aplicar shader de interseção para cada tile intersectante
  const intersectionFilters = intersectingTiles.map(tile => 
    createIntersectionFilter(token.mesh.texture, tile.mesh.texture)
  );

  sprite.filters = [
      ...intersectionFilters, 
      colorMatrixFilter, 
      outlineFilter
  ];
  sprite.eventMode = 'passive';

  return sprite;
}

























// Advanced pixel intersection detection shader
const vertexShader = `
  attribute vec2 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat3 projectionMatrix;
  varying vec2 vTextureCoord;

  void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform sampler2D tokenTexture;
  uniform sampler2D tileTexture;
  uniform vec2 textureSize;
  uniform float transparencyThreshold;

  varying vec2 vTextureCoord;

  void main(void) {
    // Amostragem das texturas nas mesmas coordenadas
    vec4 tokenPixel = texture2D(tokenTexture, vTextureCoord);
    vec4 tilePixel = texture2D(tileTexture, vTextureCoord);

    // Verificação precisa de transparência
    bool tokenTransparent = tokenPixel.a < transparencyThreshold;
    bool tileTransparent = tilePixel.a < transparencyThreshold;

    // Considerar interseção apenas se ambos não forem completamente transparentes
    if (!tokenTransparent && !tileTransparent) {
      // Cálculo de interseção com mesclagem suave
      float intersectionAlpha = min(tokenPixel.a, tilePixel.a);
      vec3 intersectionColor = mix(tokenPixel.rgb, tilePixel.rgb, 0.5);

      gl_FragColor = vec4(intersectionColor, intersectionAlpha);
    } else {
      // Manter transparência original do token
      gl_FragColor = tokenPixel;
    }
  }
`;


// Função para criar filtro de shader de interseção
function createIntersectionFilter(tokenTexture, tileTexture) {
  return new PIXI.Filter(vertexShader, fragmentShader, {
    tokenTexture: tokenTexture,
    tileTexture: tileTexture,
    textureSize: [
      tokenTexture.width,
      tokenTexture.height
    ],
    transparencyThreshold: 0.1  // Limiar de transparência ajustável
  });
}

// Função para detectar interseção de texturas usando shader
function detectTextureIntersectionWithShader(token, tile) {
  const tokenSprite = token.mesh;
  const tileSprite = tile.mesh;

  // Verificar sobreposição de bounding boxes primeiro (otimização)
  if (!isAABBIntersecting(tokenSprite, tileSprite)) 
    return false;
  
  // Criar renderTexture para análise de interseção
  const renderTexture = PIXI.RenderTexture.create({
    width: tokenSprite.width,   // Usar dimensões específicas do token
    height: tokenSprite.height
  });

  const intersectionFilter = createIntersectionFilter(
    tokenSprite.texture, 
    tileSprite.texture
  );
  
  // Criar sprite para processamento
  const intersectionSprite = new PIXI.Sprite(renderTexture);
  intersectionSprite.filters = [intersectionFilter];

  // Renderizar e analisar
  canvas.app.renderer.render(intersectionSprite, {
    renderTexture: renderTexture,
    clear: true
  });

  // Ler pixels da renderTexture
  const pixels = canvas.app.renderer.extract.pixels(renderTexture);
  
  // Contagem de pixels intersectados considerando transparência
  const totalPixels = pixels.length / 4;
  const intersectionPixels = pixels.reduce((count, pixel, index) => {
    // Verifica canal alpha e se é uma interseção significativa
    if (index % 4 === 3 && pixel > 25) {  // Canal alpha
      return count + 1;
    }
    return count;
  }, 0);

  renderTexture.destroy(true);

  // Considerar interseção se mais de 1% dos pixels forem intersectados
  return intersectionPixels / totalPixels > 0.01;
}

// Função auxiliar para verificação rápida de bounding boxes
function isAABBIntersecting(spriteA, spriteB) {
  const boundsA = spriteA.getBounds();
  const boundsB = spriteB.getBounds();

  return !(
    boundsA.right < boundsB.left || 
    boundsA.left > boundsB.right || 
    boundsA.bottom < boundsB.top || 
    boundsA.top > boundsB.bottom
  );
}









// Definição do isoOutlineFilter

const IsoOutlineVertexShader =`
  attribute vec2 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat3 projectionMatrix;
  varying vec2 vTextureCoord;

  void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
  }
`;

const IsoOutlineFragmentShader = `
  varying vec2 vTextureCoord;

  uniform sampler2D uSampler;
  uniform float alpha;
  uniform vec2 outlineThickness;
  uniform vec4 outlineColor;
  uniform vec4 filterArea;
  uniform vec4 filterClamp;

  void main(void) {
    vec4 ownColor = texture2D(uSampler, vTextureCoord);
    vec4 curColor;
    float maxAlpha = 0.0;
    vec2 displaced;
  
    // Outline externo com mais samples e suavização
    for (float angle = 0.0; angle < 6.28318530718; angle += 0.19634954085) {  // Dividido em 32 samples
      // Múltiplas amostras em diferentes distâncias para cada ângulo
      for (float dist = 0.5; dist <= 1.0; dist += 0.25) {
        displaced.x = vTextureCoord.x + (outlineThickness.x * dist) * cos(angle);
        displaced.y = vTextureCoord.y + (outlineThickness.y * dist) * sin(angle);
        curColor = texture2D(uSampler, displaced);
        maxAlpha = max(maxAlpha, curColor.a * (1.0 - dist * 0.5));  // Peso baseado na distância
      }
    }

    // Outline interno com suavização
    float innerAlpha = 0.0;
    for (float angle = 0.0; angle < 6.28318530718; angle += 0.19634954085) {
      for (float dist = 0.25; dist <= 0.75; dist += 0.25) {
        displaced.x = vTextureCoord.x - (outlineThickness.x * dist) * cos(angle);
        displaced.y = vTextureCoord.y - (outlineThickness.y * dist) * sin(angle);
        curColor = texture2D(uSampler, displaced);
        innerAlpha = max(innerAlpha, step(curColor.a, 0.1) * (1.0 - dist * 0.5));
      }
    }
  
    float resultAlpha = max(maxAlpha, ownColor.a);
    float innerEffect = smoothstep(0.0, 0.5, innerAlpha) * ownColor.a;

    // Suaviza a transição entre cores
    vec3 color = ownColor.rgb;
    if (ownColor.a < 0.1) {
      color = outlineColor.rgb * smoothstep(0.0, 0.3, maxAlpha);
    } else if (innerEffect > 0.0) {
      color = mix(color, outlineColor.rgb, innerEffect * 0.5);
    }

    gl_FragColor = vec4(color, resultAlpha);
  }
`;

const fragmentShader22 = `
  varying vec2 vTextureCoord;

  uniform sampler2D uSampler;
  uniform float alpha;
  uniform vec2 outlineThickness;
  uniform vec4 outlineColor;
  uniform vec4 filterArea;
  uniform vec4 filterClamp;

  void main(void) {
    vec4 ownColor = texture2D(uSampler, vTextureCoord);
    vec4 curColor;
    float maxAlpha = 0.0;
    vec2 displaced;

    for (float angle = 0.0; angle < 6.28318530718; angle += 0.78539816339) {
      displaced.x = vTextureCoord.x + outlineThickness.x * cos(angle);
      displaced.y = vTextureCoord.y + outlineThickness.y * sin(angle);
      curColor = texture2D(uSampler, displaced);
      maxAlpha = max(maxAlpha, curColor.a);
    }
    float resultAlpha = max(maxAlpha, ownColor.a);
    gl_FragColor = vec4((ownColor.rgb * ownColor.a + outlineColor.rgb * (1.0 - ownColor.a)) * resultAlpha, resultAlpha);
   }
`;

// Defina a classe isoOutlineFilter
class IsoOutlineFilter extends PIXI.Filter {
  constructor(thickness = 1, color = 0x000000, alpha = 1) {
    super(IsoOutlineVertexShader, fragmentShader22);

    this.uniforms.outlineColor = new Float32Array(4);
    this.uniforms.outlineThickness = new Float32Array(2);
    this.uniforms.filterArea = new Float32Array(2);
    this.uniforms.alpha = alpha;

    this.color = color;
    this.thickness = thickness;
  }

  get alpha() { return this.uniforms.alpha; }
  set alpha(value) { this.uniforms.alpha = value; }

  get color() { return PIXI.utils.rgb2hex(this.uniforms.outlineColor); }
  set color(value) { PIXI.utils.hex2rgb(value, this.uniforms.outlineColor); }

  get thickness() { return this.uniforms.outlineThickness[0]; }
  set thickness(value) {
    const filterAreaX = this.uniforms.filterArea[0] || 1;
    const filterAreaY = this.uniforms.filterArea[1] || 1;
  
    this.uniforms.outlineThickness[0] = value / filterAreaX;
    this.uniforms.outlineThickness[1] = value / filterAreaY;
  }
}
// Adicione o isoOutlineFilter ao namespace PIXI.filters
PIXI.filters.isoOutlineFilter = IsoOutlineFilter;

// Blue ColorMatrix Filter
const colorMatrixFilter = new PIXI.ColorMatrixFilter();
colorMatrixFilter.alpha = 1;
colorMatrixFilter.matrix = [
  0.3,  0.0,  0.0,  0.0,  0.0,
  0.0,  0.3,  0.0,  0.0,  0.0,
  0.0,  0.0,  0.3,  0.0,  0.0,
  0.0,  0.0,  0.0,  1.0,  0.0
];

// Red Outline Filter with thin border
const outlineFilter = new PIXI.filters.isoOutlineFilter();
outlineFilter.thickness = 0.005;
outlineFilter.color = 0x00ff59;
*/