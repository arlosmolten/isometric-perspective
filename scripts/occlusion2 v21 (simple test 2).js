// Enhanced Occlusion Layer Module for Foundry VTT

export function registerOcclusionConfig() {
  Hooks.once('ready', () => {
    TokenOcclusionManager.initialize();
  });
}












// Função principal para gerenciar a oclusão
class TokenOcclusionManager {
  static initialize() {
    // Registra o hook para atualizar a oclusão quando tokens são atualizados
    Hooks.on("refreshToken", (token) => {
      this.updateTokenOcclusion(token);
    });
  }

  constructor() {
    this.renderer = canvas.app.renderer;
    this.renderTexture = PIXI.RenderTexture.create({
        width: canvas.dimensions.width, height: canvas.dimensions.height
    });
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    this.tileToIndexer = new Map();
    this.renderTextureSprite = null;
    this.rendered=false;
    this.generateAlphaMaskIndex = this._generateAlphaMaskIndex;
  }

  static updateTokenOcclusion(token) {
    // Remove filtros antigos de oclusão
    token.mesh.filters = token.mesh.filters?.filter(f => !(f instanceof TokenOcclusionFilter)) || [];
        
    // Obtém todos os tiles da cena atual
    const tiles = canvas.tiles.placeables;



    // calculate token center position normalized
    let x = token.center.x;
    let y = token.center.x;

    if (x < 0) x = 0;
    if (x > canvas.dimensions.width) x = canvas.dimensions.width;
    if (y < 0) y = 0;
    if (y > canvas.dimensions.height) y = canvas.dimensions.height;

    x = x / canvas.dimensions.width;
    y = y / canvas.dimensions.height;

    // console.log('x, y :>> ', x, y);



        
    // Verifica sobreposição com cada tile
    for (const tile of tiles) {
      if (this.checkTextureOverlap(token, tile)) {
        const renderer = this.renderer;
        const occlusionFilter = new TokenOcclusionFilter(token, tile, x, y, renderer);
        // console.log('occlusionFilter :>> ', occlusionFilter);
        token.mesh.filters.push(occlusionFilter);
      }
    }
  }

  static checkTextureOverlap(token, tile) {
    // Obtém os bounds das texturas
    const tokenTextureBounds = token.mesh.getBounds();
    const tileTextureBounds = tile.mesh.getBounds();
      
    // Verifica sobreposição usando os bounds das texturas
    const hasOverlap = !(
        tokenTextureBounds.right < tileTextureBounds.left ||
        tokenTextureBounds.left > tileTextureBounds.right ||
        tokenTextureBounds.bottom < tileTextureBounds.top ||
        tokenTextureBounds.top > tileTextureBounds.bottom
    );

    // Verifica se ambas as texturas têm conteúdo visível
    const tokenHasContent = token.texture && token.texture.valid;
    const tileHasContent = tile.texture && tile.texture.valid;

    return hasOverlap && tokenHasContent && tileHasContent;
  }
}















// Shader personalizado para detectar sobreposição de pixels
const vertexShader = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 otherMatrix;

varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
    vMaskCoord = (otherMatrix * vec3(aTextureCoord, 1.0)).xy;
    // vMaskCoord = aTextureCoord;
}
`

const occlusionShader = `
uniform sampler2D uSampler;
uniform sampler2D mask;
uniform vec4 uColorMatrix;
uniform float x;
uniform float y;
varying vec2 vTextureCoord;
varying vec2 vMaskCoord;

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    vec4 mask = texture2D(mask, vMaskCoord);
    
    // Aplica a oclusão com base na opacidade da máscara
    if (mask.a >= x) {
        float output_alpha = uColorMatrix.a;
        vec3 output_color = uColorMatrix.rgb * output_alpha;
        gl_FragColor = vec4(output_color.rgb * color.rgb, output_alpha) * (color.a);
    } else {
        gl_FragColor = color;
    }
}
`;




class TokenOcclusionFilter extends PIXI.Filter {
  maskMatrix;
  maskTexture;

  constructor(token, tile, x, y, renderer) {
    super(vertexShader, occlusionShader);
    this.token = token;
    this.tile = tile;
    this.maskMatrix = new PIXI.Matrix();
    this.uniforms.tileTexture = tile.texture;
    this.uniforms.uColorMatrix = new Float32Array([0.2, 0.3, 0.9, 1.0]);
    this.uniforms.x = x;

    this.maskTexture = renderer;

    this.updateTileArea();
  }

  updateTileArea() {
    // Obtém os bounds da textura do tile
    const tileBounds = this.tile.mesh.getBounds();
    const tileTexture = this.tile.texture;
    
    // Calcula as coordenadas UV baseadas nos bounds da textura
    const textureFrame = tileTexture.frame;
    const textureWidth = textureFrame.width;
    const textureHeight = textureFrame.height;
    
    this.uniforms.tileArea = new Float32Array([
        tileBounds.x / textureWidth,
        tileBounds.y / textureHeight,
        tileBounds.width / textureWidth,
        tileBounds.height / textureHeight
    ]);
  }

  calculatePosition(token, tile) {
    let {x, y} = token.center;

    // Passo 1: Ajustar para os limites do canvas
    if (x < 0) x = 0;
    if (x > canvas.dimensions.width) x = canvas.dimensions.width;
    if (y < 0) y = 0;
    if (y > canvas.dimensions.height) y = canvas.dimensions.height;

    // Passo 2: Normalizar para o intervalo [0, 1]
    x = x / canvas.dimensions.width;
    y = y / canvas.dimensions.height;

    return {x, y};
  }

  calculateSpriteMatrix(outputMatrix, texture, filterManager) {
    const {sourceFrame, destinationFrame} = filterManager.activeState;
    const {orig} = texture;
    
    // Cria a matriz de transformação com base nas dimensões da textura
    const newSpriteMatrix = outputMatrix.set(
      destinationFrame.width, 0, 0, destinationFrame.height, sourceFrame.x, sourceFrame.y
    );
    
    // Obtém a transformação global (mundo) da cena
    const worldTransform = canvas.stage.worldTransform.copyTo(PIXI.Matrix.TEMP_MATRIX);
    worldTransform.invert();
    
    // Aplica a transformação de mundo e escalonamento
    newSpriteMatrix.prepend(worldTransform);
    newSpriteMatrix.scale(1.0 / orig.width, 1.0 / orig.height);
    
    return newSpriteMatrix;
  }

  calculateAndSetOtherMatrix(token, filterManager) {
    const matrix = new PIXI.Matrix();
    this.uniforms.otherMatrix = this.calculateSpriteMatrix(matrix, this.tile.texture, filterManager);
  }

  // Função para ser chamada ao atualizar o filtro
  apply(filterManager, input, output, clearMode) {
    //const tex = this.maskTexture;
    const tex = this.tile.texture;
    // const tex = PIXI.RenderTexture.create({
    //   width: canvas.dimensions.width, height: canvas.dimensions.height
    // });
    
    if (!tex || !tex.valid || !tex.baseTexture || tex.baseTexture.destroyed) {
      console.warn("Máscara de textura inválida.");
      return;
    }

    if (!tex.uvMatrix) {
      tex.uvMatrix = new PIXI.TextureMatrix(tex, 0.0);
    }
    tex.uvMatrix.update();

    this.calculateAndSetOtherMatrix(input, filterManager);
    
    this.uniforms.mask = tex;
    this.uniforms.otherMatrix = this.uniforms.otherMatrix || new PIXI.Matrix();
    
    filterManager.applyFilter(this, input, output, clearMode);
  }
}








