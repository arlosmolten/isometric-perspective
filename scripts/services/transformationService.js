import { MODULE_ID } from '../main.js';
import { transformationCache } from './transformationCache.js';

export class TransformationService {
  constructor() {
    this.worldSettings = null;
    this.gridCalculations = null;
    this.isoAngle = Math.PI/6;
  }

  initializeWorldSettings() {
    this.worldSettings = {
      isometricEnabled: game.settings.get(MODULE_ID, "worldIsometricFlag"),
      heightAdjustment: game.settings.get(MODULE_ID, "enableHeightAdjustment"),
      debug: game.settings.get(MODULE_ID, "debug")
    };
  }

  updateWorldSettings() {
    if (!this.worldSettings) {
      this.initializeWorldSettings();
      return;
    }
    
    Object.assign(this.worldSettings, {
      isometricEnabled: game.settings.get(MODULE_ID, "worldIsometricFlag"),
      heightAdjustment: game.settings.get(MODULE_ID, "enableHeightAdjustment"),
      debug: game.settings.get(MODULE_ID, "debug")
    });
  }

  getGridCalculations(scene) {
    if (!scene) return null;

    // Recalcula apenas se a cena mudou ou se ainda não foi calculado
    const gridKey = `${scene.id}_${scene.grid.size}_${scene.grid.distance}`;
    if (!this.gridCalculations || this.gridCalculations.gridKey !== gridKey) {
      this.gridCalculations = {
        gridKey,
        gridSize: scene.grid.size,
        gridDistance: scene.grid.distance,
        heightFactor: scene.grid.size / scene.grid.distance,
        isometricFactor: Math.sqrt(3)
      };
    }
    return this.gridCalculations;
  }

  calculateObjectTransformation(object, isIsometric) {
    if (!object || !object.mesh) {
      if (this.worldSettings.debug) {
        console.warn("TransformationService: Invalid object or missing mesh", object);
      }
      return null;
    }

    const scene = object.scene;
    if (!scene) return null;

    // Tenta recuperar do cache primeiro
    const cachedTransform = transformationCache.get(object, this.worldSettings);
    if (cachedTransform) {
      if (this.worldSettings.debug) {
        console.log(`Cache hit for ${object.id}`);
      }
      return cachedTransform;
    }

    const gridCalc = this.getGridCalculations(scene);
    const elevation = this.worldSettings.heightAdjustment ? object.document.elevation : 0;
    const isoScale = object.document.getFlag(MODULE_ID, 'scale') ?? 1;

    // Cálculos base para transformação isométrica
    const baseTransform = {
      rotation: this.worldSettings.isometricEnabled && isIsometric ? Math.PI/4 : 0,
      skew: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      position: { x: object.document.x, y: object.document.y },
      anchor: { x: 0, y: 0 }
    };

    // Se não estiver no modo isométrico, retorna transformação base
    if (!this.worldSettings.isometricEnabled || !isIsometric) {
      transformationCache.set(object, this.worldSettings, baseTransform);
      return baseTransform;
    }

    // Calcula transformações específicas para tokens e tiles
    let transform;
    if (object instanceof Token) {
      transform = this.calculateTokenTransformation(object, baseTransform, elevation, isoScale, gridCalc);
    } else if (object instanceof Tile) {
      transform = this.calculateTileTransformation(object, baseTransform, elevation, isoScale, gridCalc);
    } else {
      transform = baseTransform;
    }

    // Armazena no cache e retorna
    transformationCache.set(object, this.worldSettings, transform);
    return transform;    
  }

  // Adiciona método para invalidar cache quando necessário
  invalidateObjectCache(object) {
    if (object) {
      transformationCache.invalidate(object);
    }
  }

  invalidateSceneCache(sceneId) {
    if (sceneId) {
      transformationCache.invalidateScene(sceneId);
    }
  }

  calculateTokenTransformation(token, baseTransform, elevation, isoScale, gridCalc) {
    const transform = { ...baseTransform };
    
    // Ajusta âncora e escala
    transform.anchor = { x: 0, y: 1 };
    transform.scale = {
      x: token.document.width * isoScale,
      y: token.document.height * isoScale * gridCalc.isometricFactor
    };

    // Calcula offsets
    const offsetX = (token.document.getFlag(MODULE_ID, 'offsetX') ?? 0) + ((elevation * gridCalc.gridSize * Math.sqrt(2)) / gridCalc.gridDistance);
    const offsetY = token.document.getFlag(MODULE_ID, 'offsetY') ?? 0;

    // Converte offset para coordenadas isométricas
    const { x: isoOffsetX, y: isoOffsetY } = this.cartesianToIso(offsetX, offsetY);
    
    // Aplica posição final
    transform.position = {
      x: token.document.x + isoOffsetX,
      y: token.document.y + isoOffsetY
    };

    return transform;
  }

  calculateTileTransformation(tile, baseTransform, elevation, isoScale, gridCalc) {
    const transform = { ...baseTransform };
    
    // Recupera dimensões da textura
    const texture = tile.texture;
    const originalWidth = texture.width;
    const originalHeight = texture.height;
    
    // Calcula escala mantendo proporção
    transform.scale = {
      x: (tile.document.width / originalWidth) * isoScale,
      y: (tile.document.height / originalHeight) * isoScale * gridCalc.isometricFactor
    };

    // Calcula offsets
    const offsetX = tile.document.getFlag(MODULE_ID, 'offsetX') ?? 0;
    const offsetY = tile.document.getFlag(MODULE_ID, 'offsetY') ?? 0;
    const { x: isoOffsetX, y: isoOffsetY } = this.cartesianToIso(offsetX, offsetY);

    // Aplica posição final
    transform.position = {
      x: tile.document.x + (tile.document.width / 2) + isoOffsetX,
      y: tile.document.y + (tile.document.height / 2) + isoOffsetY
    };

    return transform;
  }

  cartesianToIso(x, y) {
    const angle = Math.PI / 4; // 45 graus em radianos
    return {
      x: (x * Math.cos(-angle) - y * Math.sin(-angle)),
      y: (x * Math.sin(-angle) + y * Math.cos(-angle))
    };
  }

  applyTransformation(object, transform) {
    if (!object?.mesh || !transform) return;

    // Aplica as transformações ao mesh
    object.mesh.rotation = transform.rotation;
    object.mesh.skew.set(transform.skew.x, transform.skew.y);
    object.mesh.scale.set(transform.scale.x, transform.scale.y);
    object.mesh.position.set(transform.position.x, transform.position.y);
    object.mesh.anchor.set(transform.anchor.x, transform.anchor.y);

    // Se for um token e tiver elevação, atualiza os visuais
    if (object instanceof Token && this.worldSettings.heightAdjustment) {
      this.updateTokenVisuals(object, transform);
    }
  }

  updateTokenVisuals(token, transform) {
    // Primeiro, remova qualquer representação visual existente, se necessário
    this.removeTokenVisuals(token);

    // Tente encontrar o container de visual do token
    let container = canvas.stage.getChildByName(`${token.id}-visuals`);
    let elevacao = token.document.elevation;
    let gridSize = canvas.scene.grid.size;
    let gridDistance = canvas.scene.grid.distance;

    // define o offset manual para centralizar o token
    let offsetX = token.document.getFlag(MODULE_ID, 'offsetX') ?? 0;
    let offsetY = token.document.getFlag(MODULE_ID, 'offsetY') ?? 0;
    
    // calculo referente a elevação 
    offsetX = offsetX + ((elevacao * gridSize * Math.sqrt(2)) / gridDistance); //(elevation * gridDistance * Math.sqrt(3))
    const isoOffsets = this.cartesianToIso(offsetX, offsetY);
    let positionX = token.document.x + isoOffsets.x;
    let positionY = token.document.y + isoOffsets.y;

    // Se o container não existir, cria um novo e adiciona ao canvas
    if (!container) {
      container = new PIXI.Container();
      container.name = `${token.id}-visuals`;
      container.interactive = false; // Desativar interatividade para o container
      container.interactiveChildren = false; // Garantir que filhos não sejam interativos
      canvas.stage.addChild(container);
    } else {
      // Se o container já existe, limpa qualquer elemento existente para evitar duplicação
      container.removeChildren();
    }

    if (elevacao > 0) {
      // Criar uma sombra circular no chão
      const shadow = new PIXI.Graphics();
      shadow.beginFill(0x000000, 0.3); // Sombra preta com 30% de opacidade
      shadow.drawCircle(0, 0, canvas.grid.size / 2); // Tamanho da sombra baseado no grid
      shadow.endFill();
      shadow.position.set(token.x + canvas.grid.size / 2, token.y + canvas.grid.size / 2); // Centralizar na célula do token
      container.addChild(shadow);

      // Criar uma linha conectando o chão ao token
      const line = new PIXI.Graphics();
      line.lineStyle(2, 0xff0000, 0.5); // Linha vermelha com espessura 2 e alpha 50%
      line.moveTo(
        token.x + canvas.grid.size / 2,
        token.y + canvas.grid.size / 2
      ).lineTo(
        positionX,
        positionY + canvas.grid.size / 2
      );
      container.addChild(line);
    }
  }

  removeTokenVisuals(token) {
    const shadow = canvas.stage.getChildByName(`${token.id}-shadow`);
    if (shadow) {
      canvas.stage.removeChild(shadow);
    }
  
    const line = canvas.stage.getChildByName(`${token.id}-line`);
    if (line) {
      canvas.stage.removeChild(line);
    }
  }
}

// Exporta uma única instância do serviço
export const transformationService = new TransformationService();