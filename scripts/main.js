import { registerSceneConfig } from './scene.js';
import { registerTokenConfig } from './token.js';
import { registerTileConfig } from './tile.js';
import { registerHUDConfig } from './hud.js';
import { registerOcclusionConfig } from './occlusion.js';
import { registerSortingConfig } from './autosorting.js';
import { registerDynamicTileConfig, increaseTilesOpacity, decreaseTilesOpacity } from './dynamictile.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { cartesianToIso } from './utils.js';


// ---------- CONSTANTS ----------
const MODULE_ID = "isometric-perspective";
let DEBUG_PRINT;
let WORLD_ISO_FLAG;

export { MODULE_ID };
export { DEBUG_PRINT };
export { WORLD_ISO_FLAG };


// Hook to register module configuration in Foundry VTT
Hooks.once("init", function() {
  
  // ------------- Registra as configurações do módulo ------------- 
  // Checkbox configuration to enable or disable isometric mode globally
  game.settings.register(MODULE_ID, "worldIsometricFlag", {
    //name: "Enable Isometric Perspective",
	name: game.i18n.localize('isometric-perspective.settings_main_name'),
    //hint: "Toggle whether the isometric perspective is applied to the canvas.",
	hint: game.i18n.localize('isometric-perspective.settings_main_hint'),
	scope: "world",  // "world" = sync to db, "client" = local storage
    config: true,    // false if you dont want it to show in module config
    type: Boolean,   // You want the primitive class, e.g. Number, not the name of the class as a string
    default: true, 
    requiresReload: true // true if you want to prompt the user to reload
    //onChange: settings => window.location.reload() // recarrega automaticamente
  });

  game.settings.register(MODULE_ID, 'enableHeightAdjustment', {
    //name: 'Enable Height Adjustment',
	name: game.i18n.localize('isometric-perspective.settings_height_name'),
    //hint: 'Toggle whether token sprites adjust their position to reflect their elevation',
	hint: game.i18n.localize('isometric-perspective.settings_height_hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableTokenVisuals', {
    //name: 'Enable Token Visuals',
	name: game.i18n.localize('isometric-perspective.settings_visuals_name'),
    //hint: 'Displays a circular shadow and a vertical red line to indicate token elevation. Requires "Enable Height Adjustment" to be active.',
	hint: game.i18n.localize('isometric-perspective.settings_visuals_hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableOcclusionDynamicTile', {
    //name: 'Enable Occlusion: Dynamic Tile',
	name: game.i18n.localize('isometric-perspective.settings_dynamic_tile_name'),
    //hint: '(BETA FEATURE. USE WITH CAUTION) Adjusts the visibility of tiles dynamically with the positioning of tokens. See how this feature works here.',
	hint: game.i18n.localize('isometric-perspective.settings_dynamic_tile_hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableAutoSorting', {
    //name: 'Enable Automatic Token Sorting',
	name: game.i18n.localize('isometric-perspective.settings_token_sort_name'),
    //hint: '(BETA FEATURE. USE WITH CAUTION) Automatically adjusts the token\'s sort property value when moving it around the canvas.',
	hint: game.i18n.localize('isometric-perspective.settings_token_sort_hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  /*
  game.settings.register(MODULE_ID, 'enableOcclusionTokenSilhouette', {
    //name: 'Enable Occlusion: Token Silhouette',
	name: game.i18n.localize('isometric-perspective.settings_token_silhouette_name'),
    //hint: 'Adjusts the visibility of tiles dynamically with the positioning of tokens. See how this feature works here.',
	hint: game.i18n.localize('isometric-perspective.settings_token_silhouette_hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });
  */
  
  game.settings.register(MODULE_ID, 'debug', {
    //name: 'Enable Debug Mode',
	name: game.i18n.localize('isometric-perspective.settings_debug_name'),
    //hint: 'Enables debug prints.',
	hint: game.i18n.localize('isometric-perspective.settings_debug_hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
    //onChange: settings => window.location.reload()
  });









  // ------------- Registra os atalhos do módulo ------------- 
  
  game.keybindings.register(MODULE_ID, 'increaseTilesOpacity', {
    //name: 'Increase Tile Opacity',
	name: game.i18n.localize('isometric-perspective.keybindings_increase_tile_opacity'),
    //hint: 'Increases the opacity of always visible tiles.',
	hint: game.i18n.localize('isometric-perspective.keybindings_increase_tile_opacity_hint'),
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
    //name: 'Decrease Tile Opacity',
	name: game.i18n.localize('isometric-perspective.keybindings_decrease_tile_opacity'),
    //hint: 'Decreases the opacity of always visible tiles.',
	hint: game.i18n.localize('isometric-perspective.keybindings_decrease_tile_opacity_hint'),
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
  //registerOcclusionConfig();

  
  
  
  
  
  // Define global debug print variable
  if (game.settings.get(MODULE_ID, "debug"))
    DEBUG_PRINT = true;
  else DEBUG_PRINT = false;

  if (game.settings.get(MODULE_ID, "worldIsometricFlag"))
    WORLD_ISO_FLAG = true;
  else WORLD_ISO_FLAG = false;
  
});



// Aplica a perspectiva isométrica aos tokens, tiles e background quando a cena termina de ser renderizada
Hooks.on("canvasReady", (canvas) => {
  const activeScene = game.scenes.active;
  if (!activeScene) return;

  const scene = canvas.scene;
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  applyIsometricPerspective(scene, isSceneIsometric);
  applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  
  // debug print
  if (DEBUG_PRINT) console.log("Hooks.on canvasReady");
});



// Aplica a perspectiva isométrica ao background quando a cena for redimensionada
Hooks.on("canvasResize", (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  if (isSceneIsometric && shouldTransformBackground) {
    applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  }
  
  // debug print
  if (DEBUG_PRINT) console.log("Hooks.on canvasResize");
});











/**
 * @param {----- TESTING AREA / ÁREA DE TESTES -----}
*/


/*
// Registra o hook para quando um token se move
Hooks.on("updateToken", async (token, changes) => {
  // Verifica se houve mudança na posição
  if (!changes.x && !changes.y) return;
  
  // Obtém a cena atual
  const scene = game.scenes.current;
  if (!scene) return;
  
  
  
  // Wait for the movement animation to complete -----------------------------------------------------------------------------------------
  // Wait for the movement animation to complete -----------------------------------------------------------------------------------------
  // Wait for the movement animation to complete -----------------------------------------------------------------------------------------
  // Wait for the movement animation to complete -----------------------------------------------------------------------------------------
  //const token = tokenSprite.document
  const anim = CanvasAnimation.getAnimation(token.animationName);
  if(anim?.promise) await anim.promise;



  
  // Obtém o token atualizado
  const tokenDoc = scene.tokens.get(token.id);
  const tokenSprite = tokenDoc.object;
  
  // Obtém todos os tiles da cena
  const tiles = scene.tiles.contents;
  
  // Variável para controlar se o token está tocando algum tile
  let touchedTiles = [];
  
  // Para cada tile, verifica sobreposição
  for (const tile of tiles) {
    const tileSprite = tile.object;
    
    if (checkBoundsOverlap(tokenSprite, tileSprite)) {
      console.log(`Token "${tokenDoc.name}" está sobreposto com o tile ID: ${tile.id}`);
      touchedTiles.push(tile);
    }
  }

  // Remove máscara anterior se existir
  removeOcclusionMask(scene);

  // Se houver tiles tocados, cria a máscara de oclusão
  if (touchedTiles.length > 0) {
    // Cor da máscara pode ser ajustada aqui (no formato hexadecimal)
    const maskColor = 0xFF00F0;  // Vermelho como padrão, mas pode ser modificado
    const maskAlpha = 0.5;  // Opacidade (0-1)
    
    await createOcclusionMask(scene, tokenSprite, touchedTiles, maskColor, maskAlpha);
    //await createOcclusionMask(scene, tokenSprite, touchedTiles);
    console.log(`Máscara de oclusão criada para o token "${tokenDoc.name}"`);
  } else {
    console.log(`Token "${tokenDoc.name}" NÃO está tocando nenhum tile.`);
  }

});

// Função para verificar sobreposição básica de bounds
function checkBoundsOverlap(token, tile) {
  const tokenSprite = token.mesh;
  const tileSprite = tile.mesh;
	
  // Primeiro faz uma verificação rápida de bounds
  const tokenBounds = tokenSprite.getBounds();
  const tileBounds = tileSprite.getBounds();
  
  return !(tokenBounds.left > tileBounds.right ||
           tokenBounds.right < tileBounds.left ||
           tokenBounds.top > tileBounds.bottom ||
           tokenBounds.bottom < tileBounds.top);
}



// Função para criar máscara de oclusão
async function createOcclusionMask(scene, tokenSprite, touchedTiles, maskColor, maskAlpha) {
  // Verifica se o mundo está em perspectiva isométrica
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  
  // Cria um novo container para a máscara
  const maskContainer = new PIXI.Container();
  maskContainer.name = "occlusion-mask-container";
  
  // Cria um gráfico para desenhar a máscara
  const maskGraphics = new PIXI.Graphics();
  maskGraphics.beginFill(maskColor, maskAlpha);  // Usa a cor e alpha fornecidos
  
  // Obtém os bounds do token
  const tokenBounds = tokenSprite.mesh.getBounds();
  
  // Para cada tile tocado, adiciona sua área de interseção à máscara
  touchedTiles.forEach(tile => {
    const tileBounds = tile.object.mesh.getBounds();
    
    // Calcula a intersecção
    const intersectionLeft = Math.max(tokenBounds.left, tileBounds.left);
    const intersectionRight = Math.min(tokenBounds.right, tileBounds.right);
    const intersectionTop = Math.max(tokenBounds.top, tileBounds.top);
    const intersectionBottom = Math.min(tokenBounds.bottom, tileBounds.bottom);
    
    // Desenha o retângulo de intersecção
    maskGraphics.drawRect(
      intersectionLeft, 
      intersectionTop, 
      intersectionRight - intersectionLeft, 
      intersectionBottom - intersectionTop
    );
  });
  
  maskGraphics.endFill();
  
  // Adiciona o gráfico ao container
  maskContainer.addChild(maskGraphics);
  
  // Adiciona o container à camada de interface do Foundry
  const interfaceLayer = canvas.stage;
  interfaceLayer.addChild(maskContainer);
  
  
  
  
  
  
  

  // Se o mundo estiver em perspectiva isométrica, aplica as mesmas transformações
  if (isometricWorldEnabled && isSceneIsometric) {
    // Aplica a mesma rotação e skew do canvas
    maskContainer.rotation = Math.PI/4;
    maskContainer.skew.set(0, 0);
    
    // Ajusta a escala para corresponder à transformação isométrica
    const gridSize = canvas.scene.grid.size;
    const isoScale = scene.getFlag(MODULE_ID, 'isometricScale') ?? 1;
    maskContainer.scale.set(
      isoScale,
      isoScale * Math.sqrt(3)
    );
    
    // Posiciona a máscara considerando os offsets isométricos
    // Você pode precisar ajustar isso dependendo de como exatamente as outras transformações são aplicadas
    const tokenDoc = tokenSprite.document;
    const scaleX = tokenDoc.width;  // scale for 2x2, 3x3 tokens
    const scaleY = tokenDoc.height; // scale for 2x2, 3x3 tokens
    const elevation = tokenDoc.elevation ?? 0;
    const gridDistance = canvas.scene.grid.distance;
    const gridSizeRatio = gridSize / 100;
    
    // Calcula offsets isométricos (baseado na função cartesianToIso do seu código)
    let offsetX = tokenDoc.texture.anchorX;
    let offsetY = tokenDoc.texture.anchorY;
    
    offsetX += elevation * (1/gridDistance) * 100 * Math.sqrt(2) * (1/scaleX);
    offsetX *= gridSizeRatio;
    offsetY *= gridSizeRatio;
    const isoOffsets = cartesianToIso(offsetX, offsetY);
    
    maskContainer.position.set(
      tokenDoc.x + isoOffsets.x,
      tokenDoc.y + isoOffsets.y
    );
  }
  
  
  
  
  // Posiciona a máscara no topo de todas as outras camadas
  maskContainer.zIndex = Number.MAX_SAFE_INTEGER;
  interfaceLayer.sortChildren();
}

// Função para remover a máscara de oclusão existente
function removeOcclusionMask(scene) {
  const interfaceLayer = canvas.stage;
  const existingMask = interfaceLayer.getChildByName("occlusion-mask-container");
  
  if (existingMask) {
    interfaceLayer.removeChild(existingMask);
  }
}*/

































/*
// Função para criar a máscara de sobreposição
function createOverlayMask(baseObject, overlappingObject) {
  // Obter os bounds dos objetos
  const baseBounds = baseObject.bounds;
  const overlapBounds = overlappingObject.bounds;

  // Verificar se há sobreposição
  if (!baseBounds.intersects(overlapBounds)) return null;
  
  // Criar o container para a máscara
  const maskContainer = new PIXI.Container();

  // Criar sprite para o baseObject
  const baseSprite = new PIXI.Sprite(baseObject.texture);
  baseSprite.position.set(baseBounds.x, baseBounds.y);

  // Extrair a máscara baseada nos pixels não transparentes do overlappingObject
  const texture = overlappingObject.texture;
  const bitmap = texture.baseTexture.resource.source;

  // Criar um canvas para processar os dados de transparência da textura
  const canvas = document.createElement('canvas');
  canvas.width = texture.width;
  canvas.height = texture.height;
  const context = canvas.getContext('2d');
  
  // Desenhar a textura do token no canvas para analisar os pixels
  context.drawImage(bitmap, 0, 0);
  
  // Obter os dados dos pixels (imagem bruta)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  console.log(pixels);

  // Criar a máscara com base nos pixels não transparentes
  const maskGraphics = new PIXI.Graphics();
  maskGraphics.beginFill(0xffffff);

  // Iterar sobre os pixels da textura e identificar áreas não transparentes
  for (let y = 0; y < texture.height; y++) {
    for (let x = 0; x < texture.width; x++) {
      const index = (y * texture.width + x) * 4;
      const alpha = pixels[index + 3]; // Canal alpha
      if (alpha > 0) {
        // Se o pixel não for transparente, desenha na máscara
        maskGraphics.drawRect(x, y, 1, 1);
      }
    }
  }

  maskGraphics.endFill();

  // Aplicar a máscara ao sprite
  baseSprite.mask = maskGraphics;

  // Criar filtro azul (filtro ColorMatrix)
  const blueOverlayFilter = new PIXI.ColorMatrixFilter();
  blueOverlayFilter.matrix = [
    0, 0, 0, 0, 0,    // Vermelho
    0, 0, 0.5, 0, 0,  // Verde
    0, 0, 1, 0, 0,    // Azul
    0, 0, 0, 1, 0     // Alpha
  ];
  baseSprite.filters = [blueOverlayFilter];

  // Adicionar o sprite e a máscara ao container
  maskContainer.addChild(baseSprite);
  maskContainer.addChild(maskGraphics);

  return maskContainer;
}

// Função para atualizar a camada de sobreposição
function updateOverlayLayer() {
  // Remover a camada de sobreposição existente
  if (canvas.overlayLayer) {
    canvas.overlayLayer.removeChildren();
  } else {
    // Criar a camada de sobreposição se não existir
    canvas.overlayLayer = canvas.stage.addChildAt(new PIXI.Container(), canvas.stage.children.length);
  }

  // Obter todos os tiles e tokens no canvas
  const tiles = canvas.tiles.placeables;
  const tokens = canvas.tokens.placeables;
  
  // Verificar sobreposições entre tiles e tokens
  for (const tile of tiles) {
    for (const token of tokens) {
      const overlayMask = createOverlayMask(tile, token);
      if (overlayMask) {
        canvas.overlayLayer.addChild(overlayMask);
      }
    }
  }
}

Hooks.on('canvasReady', updateOverlayLayer);
Hooks.on('updateToken', (document, changes, options) => { updateOverlayLayer() });
Hooks.on('updateTile', (document, changes, options) => { updateOverlayLayer() });

Hooks.on('init', () => { console.log('Overlay Layer Module | Inicializado') });

// Registrar hooks para atualização da camada de sobreposição
Hooks.on('canvasInit', () => {
  if (!canvas.overlayLayer) { // Garantir que a camada de sobreposição seja criada durante a inicialização do canvas
    canvas.overlayLayer = canvas.stage.addChildAt(new PIXI.Container(), canvas.stage.children.length);
  }
});





/*
blueOverlayFilter.alpha = 1;
blueOverlayFilter.matrix = [
  0, 0, 0, 0.5, 0,
  0, 0, 0, 0.5, 0,
  0, 0, 0, 0.5, 0,
  0, 0, 0,   1, 0
];
*/



























/*
class OverlayCanvasLayer extends CanvasLayer {
  constructor() {
      super();
      this.overlayContainer = new PIXI.Container();
      this.addChild(this.overlayContainer);
      this.overlaySprites = new Map();
  }

  // Cria ou atualiza o sprite de sobreposição para um elemento
  createOrUpdateOverlay(element, type) {
      const key = `${type}_${element.id}`;
      let sprite = this.overlaySprites.get(key);

      // Cria novo sprite se não existir
      if (!sprite) {
          sprite = new PIXI.Sprite(element.texture);
          this.overlayContainer.addChild(sprite);
          this.overlaySprites.set(key, sprite);
      }

      // Atualiza posição e propriedades do sprite
      sprite.position.set(element.x, element.y);
      sprite.width = element.width;
      sprite.height = element.height;

      return sprite;
  }

  // Verifica sobreposição considerando pixels transparentes
  checkPixelOverlap(sprite1, sprite2) {
      // Verifica dimensões válidas
      if (!sprite1 || !sprite2 || 
          sprite1.width <= 0 || sprite1.height <= 0 || 
          sprite2.width <= 0 || sprite2.height <= 0) {
          return false;
      }

      try {
          // Converte sprites para renderTextures para processamento de pixel
          const renderTexture1 = PIXI.RenderTexture.create({
              width: Math.floor(sprite1.width),
              height: Math.floor(sprite1.height)
          });
          const renderTexture2 = PIXI.RenderTexture.create({
              width: Math.floor(sprite2.width),
              height: Math.floor(sprite2.height)
          });

          const renderer = canvas.app.renderer;
          renderer.render(sprite1, { renderTexture: renderTexture1 });
          renderer.render(sprite2, { renderTexture: renderTexture2 });

          // Obtém dados de pixel
          const pixels1 = renderer.plugins.extract.pixels(renderTexture1);
          const pixels2 = renderer.plugins.extract.pixels(renderTexture2);

          // Libera recursos
          renderTexture1.destroy(true);
          renderTexture2.destroy(true);

          // Verifica sobreposição de pixels não transparentes
          for (let y = 0; y < Math.min(sprite1.height, sprite2.height); y++) {
              for (let x = 0; x < Math.min(sprite1.width, sprite2.width); x++) {
                  const index1 = (y * Math.floor(sprite1.width) + x) * 4;
                  const index2 = (y * Math.floor(sprite2.width) + x) * 4;

                  // Verifica se ambos os pixels têm alfa > 0 (não transparentes)
                  if (pixels1[index1 + 3] > 0 && pixels2[index2 + 3] > 0) {
                      return true;
                  }
              }
          }

          return false;
      } catch (error) {
          console.error('Erro na verificação de sobreposição de pixels:', error);
          return false;
      }
  }

  // Aplica filtro de sobreposição azul quando tokens sobrepõem tiles
  checkAndApplyOverlay() {
      const tiles = canvas.tiles.placeables;
      const tokens = canvas.tokens.placeables;

      tiles.forEach(tile => {
          // Verifica se o tile é válido e tem dimensões
          if (!tile || !tile.texture) return;

          const tileSprite = this.createOrUpdateOverlay(tile, 'tile');
          
          tokens.forEach(token => {
              // Verifica se o token é válido e tem dimensões
              if (!token || !token.texture) return;

              const tokenSprite = this.createOrUpdateOverlay(token, 'token');
              
              // Verifica sobreposição considerando transparência
              if (this.checkPixelOverlap(tileSprite, tokenSprite)) {
                  const blueOverlayFilter = new PIXI.filters.ColorMatrixFilter();
                  blueOverlayFilter.alpha = 1;
                  blueOverlayFilter.matrix = [
                    0, 0, 0, 0.5, 0,
                    0, 0, 0, 0.5, 0,
                    0, 0, 0, 0.5, 0,
                    0, 0, 0,   1, 0
                  ];
                  //blueOverlayFilter.blue(1.5); // Ajuste a intensidade conforme necessário
                  tokenSprite.filters = [blueOverlayFilter];
              } else {
                  tokenSprite.filters = [];
              }
          });
      });
  }

  // Registra listeners para atualizações
  registerListeners() {
      Hooks.on('updateToken', () => this.checkAndApplyOverlay());
      Hooks.on('updateTile', () => this.checkAndApplyOverlay());
      Hooks.on('canvasPan', () => this.checkAndApplyOverlay());
      Hooks.on('refreshToken', () => this.checkAndApplyOverlay());
      Hooks.on('refreshTile', () => this.checkAndApplyOverlay());
  }
}

// Inicialização da camada customizada
Hooks.on('canvasInit', () => {
  canvas.overlayLayer = canvas.stage.addChild(new OverlayCanvasLayer());
  canvas.overlayLayer.registerListeners();
});
*/





























/*
function createOverlayLayer() {
  const sprites = new Map();

  function updateSpriteForDocument(document) {
      const existingSprite = sprites.get(document.id);
      if (existingSprite) {
          canvas.overlayLayer.removeChild(existingSprite);
          sprites.delete(document.id);
      }

      const sourceSprite = document.object.sprite;
      if (!sourceSprite) return;

      const overlaySprite = new PIXI.Sprite(sourceSprite.texture);
      overlaySprite.position.copyFrom(sourceSprite.position);
      overlaySprite.anchor.copyFrom(sourceSprite.anchor);
      overlaySprite.width = sourceSprite.width;
      overlaySprite.height = sourceSprite.height;

      const blueOverlay = new PIXI.filters.ColorMatrixFilter();
      blueOverlay.tint = 0x0000FF;
      blueOverlay.brightness(0.8);

      const isOverlapped = canvas.tokens.placeables.some(token => 
          checkSpriteOverlap(overlaySprite, token.sprite)
      );

      if (isOverlapped) {
          overlaySprite.filters = [blueOverlay];
      }

      canvas.overlayLayer.addChild(overlaySprite);
      sprites.set(document.id, overlaySprite);
  }

  function checkSpriteOverlap(sprite1, sprite2) {
      const bounds1 = sprite1.getBounds();
      const bounds2 = sprite2.getBounds();
      return !(
          bounds1.right < bounds2.left || 
          bounds1.left > bounds2.right || 
          bounds1.bottom < bounds2.top || 
          bounds1.top > bounds2.bottom
      );
  }

  function initOverlayLayer() {
      canvas.overlayLayer = canvas.stage.addChild(new PIXI.Container());
      
      Hooks.on('updateTile', updateSpriteForDocument);
      Hooks.on('updateToken', updateSpriteForDocument);
  }

  Hooks.once('canvasReady', initOverlayLayer);
}

Hooks.once('init', createOverlayLayer);
*/






















