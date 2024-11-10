import { registerSceneConfig } from './scene.js';
import { registerTokenConfig } from './token.js';
import { registerTileConfig } from './tile.js';
import { registerHUDConfig } from './hud.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { transformationService } from './services/transformationService.js';
import { transformationCache } from './services/transformationCache.js';

const MODULE_ID = "isometric-perspective";
export { MODULE_ID };

// Hook para registrar a configuração do módulo no Foundry VTT
Hooks.once("init", function() {
  // Configuração do checkbox para habilitar ou desabilitar o modo isométrico globalmente
  game.settings.register(MODULE_ID, "worldIsometricFlag", {
    name: "Enable Isometric Perspective",
    hint: "Toggle whether the isometric perspective is applied to the canvas.",
    scope: "world",  // "world" = sync to db, "client" = local storage
    config: true,    // false if you dont want it to show in module config
    type: Boolean,   // You want the primitive class, e.g. Number, not the name of the class as a string
    default: true, 
    requiresReload: true, // true if you want to prompt the user to reload
    onChange: () => {
      transformationCache.clear();
      window.location.reload(); // Limpa o cache quando as configurações globais mudam
    }
    //onChange: settings => window.location.reload() // recarrega automaticamente
  });

  game.settings.register(MODULE_ID, 'enableHeightAdjustment', {
    name: 'Enable Height Adjustment',
    hint: 'Toggle whether tokens adjust their position based on their height',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true,
    onChange: () => {
      transformationCache.clear();  // Limpa o cache quando a configuração de altura muda
    }
  });

  game.settings.register(MODULE_ID, 'debug', {
    name: 'Enable Debug Mode',
    hint: 'Enables debug prints',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
    //onChange: settings => window.location.reload()
  });

  // Inicializa o serviço de transformação
  transformationService.initializeWorldSettings();

  // Registra as configurações do módulo
  registerSceneConfig();
  registerTokenConfig();
  registerTileConfig();
  registerHUDConfig();

  transformationService.initializeWorldSettings();
});



// Aplica a perspectiva isométrica aos tokens, tiles e background quando a cena termina de ser renderizada
Hooks.on("canvasReady", (canvas) => {
  const activeScene = game.scenes.active;
  if (!activeScene) return;

  // Limpa o cache quando uma nova cena é carregada
  transformationCache.clear();

  const scene = canvas.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  // Atualiza as configurações do serviço
  transformationService.updateWorldSettings();

  applyIsometricPerspective(scene, isIsometric);
  applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
});



// Aplica a perspectiva isométrica ao background quando a cena for redimensionada
Hooks.on("canvasResize", (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  // Invalida o cache da cena quando ela é redimensionada
  transformationService.invalidateSceneCache(scene.id);

  if (isIsometric && shouldTransformBackground) {
    applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
  }
});





// ---------------------------------------------------------------------------------------------------------------------------------
// ------ AMBIENTE DE TESTES -------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------------------



/*
// Adicionar interface para atribuir wall ao tile na configuração do tile
TileConfig.prototype._updateObject = async function(event, formData) {
  //await super._updateObject(event, formData);
  
  const wallId = formData.wallId; // Supondo que wallId é passado no formData
  this.object.setWallId(wallId);
};

// Código para atribuir tiles a walls e gerenciar visibilidade
Hooks.on("init", () => {
  // Adicionar uma configuração de tile para selecionar uma wall
  Tile.prototype.getWallId = function() {
      return this.flags?.myModule?.wallId || null;
  };

  Tile.prototype.setWallId = function(wallId) {
      if (!this.flags.myModule) {
          this.flags.myModule = {};
      }
      this.flags.myModule.wallId = wallId;
  };
});


// Função para verificar se o token está abaixo de uma wall
function isTokenBelowWall(token, wall) {
  const wallStart = wall.object.bounds.top;
  const wallEnd = wall.object.bounds.bottom;

  const tokenBounds = token.bounds;
  console.log("tokenBounds", tokenBounds);
  const tokenBottomY = tokenBounds.y + tokenBounds.height;
  console.log("wallStart:", wallStart,
              "wallEnd:", wallEnd,
              "tokenBounds:", tokenBounds,
              "tokenBottomY:", tokenBottomY
  );

  return tokenBottomY < wallStart;
}

// Atualizar a visibilidade dos tiles quando um token é selecionado
Hooks.on("updateToken", (token, updates) => {
  console.log("teste 1");
  console.log("TOKEN:", token);
  const tiles = canvas.tiles.placeables;
  const tokenCanvas = canvas.primary.tokens.get(token.id); //??????????????????????????????????????????????????????????????????????????????????????
  console.log("tokenCanvas:", tokenCanvas);
  

  tiles.forEach(tile => {
      console.log("TILE:", tile);
      const wallId = tile.document.getFlag(MODULE_ID, "wallID");
      console.log("wallId", wallId);
      if (wallId) {
          console.log("teste 4");
          const wall = canvas.walls.documentCollection.get(wallId);
          console.log("wall", wall);
          if (wallId) {
              console.log("teste 5");
              const isBelow = isTokenBelowWall(tokenCanvas, wall);
              console.log("teste 6");
              tile.visible = isBelow;
              //tile.update({ visible: tile.visible }, { diff: false });
          }
      }
  });
});
/*
// Atualizar a visibilidade dos tiles quando um token é selecionado
Hooks.on("updateToken", (token, updates) => {
  console.log("teste 1");
  console.log(token);
  if (!updates?.actor) {
      console.log("teste 2");
      const tiles = canvas.tiles.placeables;

      tiles.forEach(tile => {
          console.log("teste 3");
          const wallId = tile.getWallId();
          console.log("wallId", wallId);
          if (!wallId) {
              console.log("teste 4");
              const wall = canvas.walls.get(wallId);
              console.log("wall", wall);
              if (!wall) {
                  console.log("teste 5");
                  const isBelow = isTokenBelowWall(token, wall);
                  tile.visible = isBelow;
                  tile.update({ visible: tile.visible }, { diff: false });
              }
          }
      });
  }
});

Hooks.on("updateToken", (token, updates) => {
  canvas.draw()
})


// Adicionar botão para selecionar wall na configuração do tile
Hooks.on("renderTileConfig", (app, html, data) => {
  const wallDisplay = $('<input type="text" name="wallId" readonly style="width: 100%;">');
  const selectWallButton = $('<button type="button" class="select-wall">Selecionar Wall</button>');

  // Adicionar o campo de texto e o botão na configuração
  html.find("form").prepend(wallDisplay);
  html.find("form").prepend(selectWallButton);

  // Evento para abrir a seleção da wall ao clicar
  selectWallButton.on("click", () => {
      // Ativar a seleção de wall no canvas
      canvas.walls.activate();

      // Registrar o manipulador para capturar cliques na wall
      const selectWallHandler = (event) => {
          const wall = canvas.walls.placeables.find(w => w.hitTest(event.data.global));
          if (wall) {
              const wallId = wall.id;
              wallDisplay.val(wallId); // Exibir o ID da wall selecionada
              app.object.setWallId(wallId); // Atribuir o ID ao tile
              canvas.walls.deactivate(); // Desativar seleção após escolher
              Hooks.off("canvasClick", selectWallHandler); // Remover o manipulador após selecionar
          }
      };

      // Registrar o manipulador de cliques
      Hooks.on("canvasClick", selectWallHandler);
  });
});

// Capturar o evento de controle de wall para identificar qual wall está sendo interagida
Hooks.on("controlWall", (wall) => {
  const activeTile = canvas.tiles.controlled[0]; // Obter o tile atualmente selecionado
  if (activeTile && wall) {
      activeTile.setWallId(wall.id); // Armazenar o ID da wall no tile
  }
});

// Remover a wall associada ao tile
Hooks.on("renderTileConfig", (app, html, data) => {
  const removeWallButton = $('<button type="button" class="remove-wall">Remover Wall</button>');
  html.find("form").prepend(removeWallButton);

  removeWallButton.on("click", () => {
      wallDisplay.val(""); // Limpar o campo de texto
      app.object.setWallId(null); // Remover o ID da wall do tile
  });
});
*/






/*

// Função para aplicar o efeito de brilho difuso e sombra interna ao token
function applyGlowAndShadowEffect(token) {
  const blurFilter = new PIXI.filters.BlurFilter();
  blurFilter.blur = 2; // Ajuste o valor conforme necessário para o efeito desejado
  token.mesh.filters = [blurFilter]; // Aplica o filtro de desfoque ao token

  // Ajusta a opacidade do token para simular uma sombra interna
  token.mesh.alpha = 0.8; // Ajuste o valor conforme necessário para o efeito desejado
}

// Função para remover os efeitos do token
function removeGlowAndShadowEffect(token) {
  token.mesh.filters = [];
  token.mesh.alpha = 1.0;
}

// Função para verificar a sobreposição entre as texturas do token e dos tiles
function checkTokenTileTextureOverlap(token) {
  const tokenTextureBounds = token.mesh.getBounds(); // Obtém as bordas da arte do token
  const tiles = canvas.tiles.placeables;

  for (const tile of tiles) {
    const tileTextureBounds = tile.mesh.getBounds(); // Obtém as bordas da arte do tile

    // Verifica a sobreposição entre as texturas do token e do tile
    if (tokenTextureBounds.left < tileTextureBounds.right &&
        tokenTextureBounds.right > tileTextureBounds.left &&
        tokenTextureBounds.top < tileTextureBounds.bottom &&
        tokenTextureBounds.bottom > tileTextureBounds.top) {
      applyGlowAndShadowEffect(token); // Aplica os efeitos se houver sobreposição
      return;
    }
  }

  // Remove os efeitos se não houver sobreposição
  removeGlowAndShadowEffect(token);
}

// Hook que verifica a sobreposição sempre que um token é atualizado
Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
    checkTokenTileTextureOverlap(token);
  }
});

// Hook que verifica a sobreposição quando a cena é carregada
Hooks.on("canvasReady", () => {
  const tokens = canvas.tokens.placeables;
  for (const token of tokens) {
    checkTokenTileTextureOverlap(token);
  }
});
*/






/* ------------------------ V2 RED TINT -----------------------------
// Função para aplicar o efeito de tint vermelho ao token
function applyRedTintEffect(token) {
  token.mesh.tint = 0xff0000; // Aplica o efeito de tint em vermelho
}

// Função para remover o efeito de tint do token
function removeRedTintEffect(token) {
  token.mesh.tint = 0xffffff; // Remove o tint, restaurando a cor original
}

// Função para verificar a sobreposição entre as texturas do token e dos tiles
function checkTokenTileTextureOverlap(token) {
  const tokenBounds = token.mesh.getBounds(); // Obtém as bordas da arte do token
  const tiles = canvas.tiles.placeables;

  for (const tile of tiles) {
    const tileBounds = tile.mesh.getBounds(); // Obtém as bordas da arte do tile

    // Calcula a área de sobreposição entre token e tile
    const overlapX = Math.max(tokenBounds.x, tileBounds.x);
    const overlapY = Math.max(tokenBounds.y, tileBounds.y);
    const overlapWidth = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - overlapX;
    const overlapHeight = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - overlapY;

    // Verifica se há uma área de sobreposição
    if (overlapWidth > 0 && overlapHeight > 0) {
      applyRedTintEffect(token); // Aplica o efeito de tint vermelho se houver sobreposição
      return;
    }
  }

  // Remove os efeitos se não houver sobreposição
  removeRedTintEffect(token);
}

// Hook que verifica a sobreposição sempre que um token é atualizado
Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
    checkTokenTileTextureOverlap(token);
  }
});

// Hook que verifica a sobreposição quando a cena é carregada
Hooks.on("canvasReady", () => {
  const tokens = canvas.tokens.placeables;
  for (const token of tokens) {
    checkTokenTileTextureOverlap(token);
  }
});
*/



/* --------- V3 DO CHATGPT, TENTANDO COLORIR SOMENTE UMA PARTE -------------------
// Função para aplicar uma máscara vermelha na área de sobreposição do token
function applyRedOverlayEffect(token, overlapBounds) {
  // Cria um gráfico para representar a área de sobreposição com a cor vermelha
  const redOverlay = new PIXI.Graphics();
  redOverlay.beginFill(0xff0000, 0.5); // Vermelho com transparência para sobreposição
  redOverlay.drawRect(overlapBounds.x, overlapBounds.y, overlapBounds.width, overlapBounds.height);
  redOverlay.endFill();

  // Define a posição da sobreposição com base na posição do token
  redOverlay.position.set(overlapBounds.x - token.mesh.x, overlapBounds.y - token.mesh.y);

  // Aplica a máscara ao token
  token.mesh.addChild(redOverlay);

  // Remove a sobreposição após um curto período para evitar acúmulo de overlays
  setTimeout(() => {
    if (redOverlay.parent) {
      redOverlay.parent.removeChild(redOverlay);
    }
  }, 50);
}

// Função para verificar a sobreposição entre as texturas do token e dos tiles
function checkTokenTileTextureOverlap(token) {
  const tokenBounds = token.mesh.getBounds(); // Obtém as bordas da arte do token
  const tiles = canvas.tiles.placeables;

  for (const tile of tiles) {
    const tileBounds = tile.mesh.getBounds(); // Obtém as bordas da arte do tile

    // Calcula a área de sobreposição entre token e tile
    const overlapX = Math.max(tokenBounds.x, tileBounds.x);
    const overlapY = Math.max(tokenBounds.y, tileBounds.y);
    const overlapWidth = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - overlapX;
    const overlapHeight = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - overlapY;

    // Verifica se há uma área de sobreposição
    if (overlapWidth > 0 && overlapHeight > 0) {
      const overlapBounds = new PIXI.Rectangle(overlapX - tokenBounds.x, overlapY - tokenBounds.y, overlapWidth, overlapHeight);
      applyRedOverlayEffect(token, overlapBounds); // Aplica o efeito de overlay vermelho na área de sobreposição
      return;
    }
  }

  // Remove quaisquer efeitos de sobreposição se não houver interseção
  removeRedTintEffect(token);
}

// Função para remover quaisquer overlays
function removeRedTintEffect(token) {
  token.mesh.removeChildren(); // Remove todas as máscaras aplicadas
}

// Hook que verifica a sobreposição sempre que um token é atualizado
Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
    checkTokenTileTextureOverlap(token);
  }
});

// Hook que verifica a sobreposição quando a cena é carregada
Hooks.on("canvasReady", () => {
  const tokens = canvas.tokens.placeables;
  for (const token of tokens) {
    checkTokenTileTextureOverlap(token);
  }
});
*/

















/* ---------- V4 FUNCIONANDO TUDO, MAS SOMENTE NO 2D -----------------------
// Classe para gerenciar o efeito de sobreposição
class TokenOverlapEffect {
  constructor() {
      this.activeEffects = new Map();
  }

  // Aplica o efeito de sobreposição
  applyEffect(token, overlapBounds) {
      // Remove efeito anterior se existir
      this.removeEffect(token);

      // Obtém o sprite do token
      const tokenSprite = token.mesh;

      // Converte as coordenadas globais de sobreposição para coordenadas locais do sprite do token
      const localBounds = this.globalToLocal(overlapBounds, tokenSprite);

      // Cria um novo sprite para o efeito vermelho
      const redEffect = new PIXI.Sprite(tokenSprite.texture);
      redEffect.width = tokenSprite.width;
      redEffect.height = tokenSprite.height;
      redEffect.tint = 0xff0000; // Vermelho
      redEffect.alpha = 0.5;
      console.log("redEffect", redEffect);

      // Cria uma máscara para limitar o efeito à área de sobreposição
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawRect(
          localBounds.x,
          localBounds.y,
          localBounds.width,
          localBounds.height
      );
      mask.endFill();

      // Aplica a máscara ao efeito vermelho
      redEffect.mask = mask;

      // Adiciona tanto o efeito quanto a máscara ao sprite do token
      tokenSprite.addChild(redEffect);
      tokenSprite.addChild(mask);

      // Armazena as referências para remoção posterior
      this.activeEffects.set(token.id, { effect: redEffect, mask: mask });
  }

  // Remove o efeito de sobreposição
  removeEffect(token) {
      const existingEffect = this.activeEffects.get(token.id);
      if (existingEffect) {
          token.mesh.removeChild(existingEffect.effect);
          token.mesh.removeChild(existingEffect.mask);
          this.activeEffects.delete(token.id);
      }
  }

  // Converte coordenadas globais para locais do sprite
  globalToLocal(bounds, sprite) {
      const localPos = sprite.toLocal(new PIXI.Point(bounds.x, bounds.y));
      return new PIXI.Rectangle(
          localPos.x,
          localPos.y,
          bounds.width / sprite.scale.x,
          bounds.height / sprite.scale.y
      );
  }

  // Verifica sobreposição entre token e tiles
  checkOverlap(token) {
      const tokenSprite = token.mesh;
      const tokenTexture = tokenSprite.texture;
      const tokenBounds = tokenSprite.getBounds(true); // true para obter bounds precisos

      const tiles = canvas.tiles.placeables;
      let hasOverlap = false;

      for (const tile of tiles) {
          const tileSprite = tile.mesh;
          const tileTexture = tileSprite.texture;
          const tileBounds = tileSprite.getBounds(true);

          // Log para debug
          console.log("Verificando sobreposição:", {
              token: {
                  x: tokenBounds.x,
                  y: tokenBounds.y,
                  width: tokenBounds.width,
                  height: tokenBounds.height,
                  texture: {
                      width: tokenTexture.width,
                      height: tokenTexture.height
                  }
              },
              tile: {
                  x: tileBounds.x,
                  y: tileBounds.y,
                  width: tileBounds.width,
                  height: tileBounds.height,
                  texture: {
                      width: tileTexture.width,
                      height: tileTexture.height
                  }
              }
          });

          // Calcula a área de sobreposição das texturas
          const overlapBounds = this.calculateTextureOverlap(
              tokenSprite,
              tokenBounds,
              tileSprite,
              tileBounds
          );

          if (overlapBounds) {
              hasOverlap = true;
              this.applyEffect(token, overlapBounds);
              break;
          }
      }

      if (!hasOverlap) {
          this.removeEffect(token);
      }
  }

  // Calcula a área de sobreposição entre duas texturas
  calculateTextureOverlap(tokenSprite, tokenBounds, tileSprite, tileBounds) {
      // Verifica se há interseção entre as bounds
      if (!(tokenBounds.x < tileBounds.x + tileBounds.width &&
            tokenBounds.x + tokenBounds.width > tileBounds.x &&
            tokenBounds.y < tileBounds.y + tileBounds.height &&
            tokenBounds.y + tokenBounds.height > tileBounds.y)) {
          return null;
      }

      // Calcula a área de sobreposição em coordenadas globais
      const x = Math.max(tokenBounds.x, tileBounds.x);
      const y = Math.max(tokenBounds.y, tileBounds.y);
      const width = Math.min(
          tokenBounds.x + tokenBounds.width,
          tileBounds.x + tileBounds.width
      ) - x;
      const height = Math.min(
          tokenBounds.y + tokenBounds.height,
          tileBounds.y + tileBounds.height
      ) - y;

      // Converte as coordenadas de sobreposição para coordenadas locais de cada textura
      const tokenLocal = tokenSprite.toLocal(new PIXI.Point(x, y));
      const tileLocal = tileSprite.toLocal(new PIXI.Point(x, y));

      // Verifica se os pixels nas texturas não são transparentes na área de sobreposição
      const tokenTextureX = Math.floor(tokenLocal.x * (tokenSprite.texture.width / tokenSprite.width));
      const tokenTextureY = Math.floor(tokenLocal.y * (tokenSprite.texture.height / tokenSprite.height));
      const tileTextureX = Math.floor(tileLocal.x * (tileSprite.texture.width / tileSprite.width));
      const tileTextureY = Math.floor(tileLocal.y * (tileSprite.texture.height / tileSprite.height));

      // Log para debug
      console.log("Coordenadas de textura:", {
          token: { x: tokenTextureX, y: tokenTextureY },
          tile: { x: tileTextureX, y: tileTextureY }
      });

      // Verifica se as coordenadas estão dentro das texturas
      if (tokenTextureX >= 0 && tokenTextureX < tokenSprite.texture.width &&
          tokenTextureY >= 0 && tokenTextureY < tokenSprite.texture.height &&
          tileTextureX >= 0 && tileTextureX < tileSprite.texture.width &&
          tileTextureY >= 0 && tileTextureY < tileSprite.texture.height) {
          return new PIXI.Rectangle(x, y, width, height);
      }

      return new PIXI.Rectangle(x, y, width, height); //return null;
  }
}

// Inicializa o gerenciador de efeitos
const tokenOverlapManager = new TokenOverlapEffect();

// Hook para atualização de tokens
Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
      tokenOverlapManager.checkOverlap(token);
  }
});

// Hook para carregamento da cena
Hooks.on("canvasReady", () => {
  canvas.tokens.placeables.forEach(token => {
      tokenOverlapManager.checkOverlap(token);
  });
});

// Hook para movimento de tokens
Hooks.on("refreshToken", (token) => {
  tokenOverlapManager.checkOverlap(token);
});

// Hook para quando um tile é atualizado/movido
Hooks.on("refreshTile", () => {
  canvas.tokens.placeables.forEach(token => {
      tokenOverlapManager.checkOverlap(token);
  });
});*/