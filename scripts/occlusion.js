import { MODULE_ID, isDebugEnabled, logWarn, logError } from './config.js';
import { mergeRectangles } from './utils.js';

// Enhanced Occlusion Layer Module for Foundry VTT
export function registerOcclusionConfig() {
	const occlusionMode = game.settings.get(MODULE_ID, "enableOcclusionTokenSilhouette");
	if (occlusionMode === "off") return;

	// Global Hook Registration
	function registerGlobalHooks() {
		const updateTriggers = [
			'canvasReady', 
			'canvasPan',
			'canvasTokensRefresh', 
			'updateToken', 
			'controlToken', 
			'refreshToken',
			'preUpdateScene',
			'updateScene',
			'updateTile',
			'deleteTile',
			'deleteToken'
		];

		updateTriggers.forEach(hookName => {
			Hooks.on(hookName, (obj, update) => {
				// For events affecting a specific tile or token try invalidating only related cache entries
				if (hookName === 'updateTile' || hookName === 'deleteTile') {
					const tileId = obj?.id ?? (update?.id ?? null);
					if (tileId) invalidateMaskCacheForTile(tileId);
				} else if (hookName === 'updateToken' || hookName === 'deleteToken') {
					const tokenId = obj?.id ?? (update?.id ?? null);
					if (tokenId) invalidateMaskCacheForToken(tokenId);
				}
				scheduleOcclusionUpdate();
			});
		});
	}

	// Initialize on canvas setup
	// Hooks.on('refreshToken', () => { debouncedUpdate(); });
	
	// Initial layer setup
	Hooks.once('ready', () => {
		if (canvas.ready)
			initializeOcclusionLayer();
	});

	// Initialize on canvas setup
	Hooks.on('canvasInit', () => {
		initializeOcclusionLayer();
	});

	// When canvas is destroyed, cleanup occlusion container
	Hooks.on('canvasDestroyed', () => {
		if (occlusionConfig.container) {
			canvas.stage.removeChild(occlusionConfig.container);
			occlusionConfig.container.destroy({ children: true });
			occlusionConfig.container = null;
			occlusionConfig.tokensLayer = null;
			occlusionConfig.initialized = false;
			maskCache.clear();
		}
	});

	// Reset on scene change
	Hooks.on('changeScene', () => {
		if (occlusionConfig.container) {
			canvas.stage.removeChild(occlusionConfig.container);
			occlusionConfig.container.destroy({ children: true });
			occlusionConfig.container = null;
			occlusionConfig.tokensLayer = null;
			occlusionConfig.initialized = false;
		}
	});

	// Start the module
	registerGlobalHooks();
}

// Otimização 1: Debounce do updateOcclusionLayer
//const debouncedUpdate = debounce(updateOcclusionLayer, 50);
//const throttledUpdate = throttle(updateOcclusionLayer, 50);












// Persistent occlusion layer configuration
const occlusionConfig = {
	container: null,
	tokensLayer: null,
	initialized: false
};

// Basic mask cache keyed by 'tokenId|tileIds' to reduce recalculation
const maskCache = new Map();

function invalidateMaskCacheForTile(tileId) {
	if (!tileId) return;
	for (const key of Array.from(maskCache.keys())) {
		if (key.includes(`|${tileId},`) || key.endsWith(`,${tileId}`) || key.endsWith(`|${tileId}`) || key.includes(`,${tileId},`)) {
			maskCache.delete(key);
		}
	}
}

function invalidateMaskCacheForToken(tokenId) {
	if (!tokenId) return;
	for (const key of Array.from(maskCache.keys())) {
		if (key.startsWith(`${tokenId}|`)) {
			maskCache.delete(key);
		}
	}
}

// Initialize or reset the occlusion layer
function initializeOcclusionLayer() {
	// Remove existing container if it exists
	if (occlusionConfig.container) {
		canvas.stage.removeChild(occlusionConfig.container);
		occlusionConfig.container.destroy({ children: true });
	}

	// Create the main occlusion container
	occlusionConfig.container = new PIXI.Container();
	occlusionConfig.container.name = "OcclusionContainer";
	occlusionConfig.container.eventMode = 'passive';

	// Create a layer for occlusion tokens
	occlusionConfig.tokensLayer = new PIXI.Container();
	occlusionConfig.tokensLayer.name = "OcclusionTokens";
	occlusionConfig.tokensLayer.sortableChildren = true;

	// Add the layer to the container
	occlusionConfig.container.addChild(occlusionConfig.tokensLayer);

	// Add to canvas stage
	canvas.stage.addChild(occlusionConfig.container);
	canvas.stage.sortChildren();

	occlusionConfig.initialized = true;
	maskCache.clear();
}



// Comprehensive update mechanism for occlusion layer
function updateOcclusionLayer() {
	// Ensure canvas is ready and layer is initialized
	if (!canvas.ready) return;

	// Reinitialize if not yet set up
	if (!occlusionConfig.initialized) {
		initializeOcclusionLayer();
	}

	// Clear existing occlusion tokens
	occlusionConfig.tokensLayer.removeChildren();

	// Get all tokens and tiles
	const tokens = canvas.tokens.placeables;
	const tiles = canvas.tiles.placeables;

	// Filtra apenas tiles com a flag OccludingTile
	const occludingTiles = tiles.filter(tile => 
		tile.document.getFlag(MODULE_ID, "OccludingTile")
	);

	tokens.forEach(token => {
		// Find tiles that intersect with this token
		const intersectingTiles = occludingTiles.filter(tile => 
			checkTokenTileIntersection(token, tile)
		);

		// If there are intersecting tiles, create an occlusion sprite
		if (intersectingTiles.length > 0) {
			const occlusionSprite = createOcclusionSprite(token, intersectingTiles);
			if (occlusionSprite) {
				occlusionConfig.tokensLayer.addChild(occlusionSprite);
			}
		}
	});
}







// Token-Tile Intersection Check
// function checkTokenTileIntersection(token, tile) {
// 	// Basic intersection check using bounding boxes
// 	const tokenBounds = token.mesh.getBounds();
// 	const tileBounds = tile.mesh.getBounds();
	
// 	if (DEBUG_PRINT) {
// 		let DEBUG_INTERSECTION = true;
// 		debugVisualIntersection(token, tile, DEBUG_INTERSECTION);
// 	}

// 	return (
// 		tokenBounds.x < tileBounds.x + tileBounds.width &&
// 		tokenBounds.x + tokenBounds.width > tileBounds.x &&
// 		tokenBounds.y < tileBounds.y + tileBounds.height &&
// 		tokenBounds.y + tokenBounds.height > tileBounds.y
// 	);
// }
function checkTokenTileIntersection(token, tile) {
	// Get bounding boxes
	const tokenBounds = token.mesh.getBounds();
	const tileBounds = tile.mesh.getBounds();

	// Calculate centers
	const tokenCenter = {
		x: tokenBounds.x + (tokenBounds.width / 2),
		y: tokenBounds.y + (tokenBounds.height / 2)
	};

	const tileCenter = {
		x: tileBounds.x + (tileBounds.width / 2),
		y: tileBounds.y + (tileBounds.height / 2)
	};

	if (isDebugEnabled()) {
		let DEBUG_INTERSECTION = true;
		debugVisualIntersection(token, tile, DEBUG_INTERSECTION);
	}

	// First check if token center is "behind" tile center
	if (tileCenter.y <= tokenCenter.y) return false;

	// Then do the regular intersection check
	return (
		tokenBounds.x < tileBounds.x + tileBounds.width &&
		tokenBounds.x + tokenBounds.width > tileBounds.x &&
		tokenBounds.y < tileBounds.y + tileBounds.height &&
		tokenBounds.y + tokenBounds.height > tileBounds.y
	);
}







// Create Occlusion Sprite with Advanced Masking
function createOcclusionSprite(token, intersectingTiles) {
	if (!token.mesh || !token.mesh.texture) return null;

	// Create a sprite from the token's texture
	const sprite = new PIXI.Sprite(token.mesh.texture);
	sprite.position.set(token.mesh.position.x, token.mesh.position.y);
	sprite.anchor.set(token.mesh.anchor.x, token.mesh.anchor.y);
	sprite.angle = token.mesh.angle;
	sprite.scale.set(token.mesh.scale.x, token.mesh.scale.y);

	// Create or reuse a mask for the interception area
	const key = `${token.id}|${intersectingTiles.map(t => t.id).join(',')}`;
	let mask = maskCache.get(key);
	if (!mask) {
		mask = createOcclusionMask(token, intersectingTiles);
		if (mask) maskCache.set(key, mask);
	}
	
	if (mask) {
		sprite.mask = mask;
	}

	// sprite.filters = [colorMatrix, outlineFilter, alphaFilter];
	sprite.filters = [colorMatrix, outlineFilter]; //filter configs at eof

	//sprite.alpha = 0.75;
	sprite.eventMode = 'passive';

	return sprite;
}














// Advanced Occlusion Mask Creation
const alphaFragmentShader = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;       // Textura do token (não usada aqui)
uniform sampler2D uTileMask;      // Textura do tile
uniform vec4 dimensions;          // [x, y, width, height] da interseção
uniform vec4 tileDimensions;      // [x, y, width, height] do tile

void main(void) {
	// Posição local do fragmento na interseção
	vec2 localPos = gl_FragCoord.xy - dimensions.xy;
	
	// Coordenadas UV normalizadas para a textura do tile
	vec2 tileCoord = vec2(
		(localPos.x / dimensions.z) * (tileDimensions.z / dimensions.z),
		(localPos.y / dimensions.w) * (tileDimensions.w / dimensions.w)
	);

	// Ajuste para considerar a posição do tile no canvas
	tileCoord.x += (dimensions.x - tileDimensions.x) / tileDimensions.z;
	tileCoord.y += (dimensions.y - tileDimensions.y) / tileDimensions.w;

	// Amostra a textura do tile
	vec4 tileColor = texture2D(uTileMask, tileCoord);

	// Amostra a textura do token
	vec4 tokenColor = texture2D(uSampler, vTextureCoord);

	// Se o pixel do tile for opaco, cria uma máscara branca opaca
	if (tileColor.a > 0.1) {
		gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // Branco opaco
	} else {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // Transparente
	}
}

`;

function createOcclusionMask(token, intersectingTiles) {
	// const gpu = 1;
	// const chunkSize = 2;
	// 1  = pixel perfect, but cpu intensive;
	// 2  = okish, still cpu intensive with a lot of tokens on scene, kinda pixelated, but work for simple tiles
	// 3  = still heavy on performance, but only with a lot of tokens, pixelated, works only on tiles with straight lines
	// 4+ = light on cpu in zoom out, heavy on cpu on zoom in, really pixelated
	// 8+ = light on cpu on almost all scenarios, works only with rectangle tiles

	const occlusionMode = game.settings.get(MODULE_ID, "enableOcclusionTokenSilhouette");
	const gpu = occlusionMode === "gpu" ? 1 : 0;
	const chunkSize = occlusionMode.startsWith("cpu") ? parseInt(occlusionMode.slice(3)) : 2;

	if (gpu === 1) {
		return createOcclusionMask_gpu(token, intersectingTiles)
	} else {
		return createOcclusionMask_cpu(token, intersectingTiles, chunkSize)
	}
}

function createOcclusionMask_gpu(token, intersectingTiles) {
	try {
		const maskGraphics = new PIXI.Graphics();
		maskGraphics.beginFill(0xffffff);
		intersectingTiles.forEach(tile => {
		const tokenBounds = token.mesh.getBounds();
		const tileBounds = tile.mesh.getBounds();

		// Calculate intersection area
		const x = Math.max(tokenBounds.x, tileBounds.x);
		const y = Math.max(tokenBounds.y, tileBounds.y);
		const width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - x;
		const height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - y;
			if (width <= 0 || height <= 0) return;

		// Draw intersection area
			maskGraphics.drawRect(x, y, width, height);

		// Create and apply alpha filter
			const alphaFilter = new PIXI.Filter(undefined, alphaFragmentShader, {
			uTileMask: tile.texture,
			dimensions: new Float32Array([x, y, width, height]),
			tileDimensions: new Float32Array([
				tileBounds.x, tileBounds.y, tileBounds.width, tileBounds.height
			])
		});
			maskGraphics.filters = [...(maskGraphics.filters || []), alphaFilter];
	});

		maskGraphics.endFill();
		return maskGraphics;
	} catch (error) {
		logWarn('GPU occlusion mask failed, falling back to CPU mode:', error);
		return createOcclusionMask_cpu(token, intersectingTiles, 2);
	}
}














// 4/10 versão otimizada 2 (não senti muita diferença)
function createOcclusionMask_cpu(token, intersectingTiles, chunkSize) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);

	// Get the current scene scale
	const stage = token.mesh.parent;
	const sceneScale = stage?.scale?.x ?? 1;
	const minDimension = 1 / sceneScale;
	const adjustedChunkSize = Math.max(chunkSize / sceneScale, 1);

	// Create a single reusable canvas
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = 256;  // Start smaller, will grow if needed
	tempCanvas.height = 256;
	const tempCtx = tempCanvas.getContext('2d', { 
		willReadFrequently: true,
		alpha: true 
	});

	// Pre-calculate token bounds once
	const tokenBounds = token.mesh.getBounds(false, undefined);
  
	// Pre-allocate arrays for better memory management
	const rectangles = [];

	// Reusable objects to avoid garbage collection
	const intersection = {x: 0, y: 0, width: 0, height: 0};
	const source = {x: 0, y: 0, width: 0, height: 0};

	for (const tile of intersectingTiles) {
		// Skip invalid tiles early
		const tileTexture = tile.texture?.baseTexture?.resource?.source;
		if (!tileTexture?.width || !tileTexture?.height) continue;

		const tileBounds = tile.mesh.getBounds(false, undefined);

		// Calculate intersection
		intersection.x = Math.max(tokenBounds.x, tileBounds.x);
		intersection.y = Math.max(tokenBounds.y, tileBounds.y);
		intersection.width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - intersection.x;
		intersection.height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - intersection.y;

		// Early rejection tests
		if (intersection.width <= minDimension || intersection.height <= minDimension) continue;

		// Calculate source rectangle
		const scaleX = tileTexture.width / tileBounds.width;
		const scaleY = tileTexture.height / tileBounds.height;
    
		source.x = Math.max(0, (intersection.x - tileBounds.x) * scaleX);
		source.y = Math.max(0, (intersection.y - tileBounds.y) * scaleY);
		source.width = Math.min(intersection.width * scaleX, tileTexture.width - source.x);
		source.height = Math.min(intersection.height * scaleY, tileTexture.height - source.y);

		// Validate source dimensions
		if (source.width <= 0 || source.height <= 0) continue;

		// Calculate canvas dimensions
		const canvasWidth = Math.ceil(intersection.width * scaleX);
		const canvasHeight = Math.ceil(intersection.height * scaleY);

		// Resize canvas if necessary
		if (tempCanvas.width < canvasWidth) tempCanvas.width = canvasWidth;
		if (tempCanvas.height < canvasHeight) tempCanvas.height = canvasHeight;

		// Draw tile portion
		tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
		tempCtx.drawImage(tileTexture,
			source.x,
			source.y,
			source.width,
			source.height,
			0, 0, canvasWidth, canvasHeight
		);

		// Get image data and process in chunks
		const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
		const dataU32 = new Uint32Array(imageData.data.buffer);

		// Process chunks
		const chunksX = Math.ceil(intersection.width / adjustedChunkSize);
		const chunksY = Math.ceil(intersection.height / adjustedChunkSize);

		for (let cy = 0; cy < chunksY; cy++) {
			const yPos = cy * adjustedChunkSize;
			const chunkHeight = Math.min(adjustedChunkSize, intersection.height - yPos);

			for (let cx = 0; cx < chunksX; cx++) {
				const xPos = cx * adjustedChunkSize;
				const chunkWidth = Math.min(adjustedChunkSize, intersection.width - xPos);

				// Convert chunk position to texture space
				const textureX = Math.floor(xPos * (canvasWidth / intersection.width));
				const textureY = Math.floor(yPos * (canvasHeight / intersection.height));
				const textureWidth = Math.ceil(chunkWidth * (canvasWidth / intersection.width));
				const textureHeight = Math.ceil(chunkHeight * (canvasHeight / intersection.height));

				// Check for non-transparent pixels
				let hasOpaquePixel = false;
				
				for (let py = textureY; py < Math.min(textureY + textureHeight, canvasHeight); py++) {
					const rowOffset = py * canvasWidth;
					for (let px = textureX; px < Math.min(textureX + textureWidth, canvasWidth); px++) {
						if ((dataU32[rowOffset + px] >>> 24) > 0) {
							hasOpaquePixel = true;
							rectangles.push({
								x: intersection.x + xPos,
								y: intersection.y + yPos,
								width: chunkWidth,
								height: chunkHeight
							});
							py = canvasHeight; // Break outer loop
							break;
						}
					}
				}
			}
		}
		
	}

	// Apply matrix transform
	maskGraphics.transform.setFromMatrix(stage.transform.worldTransform);

	// Use shared utility function to merge rectangles

	const optimizedRects = mergeRectangles(rectangles);

	// Draw rectangles
	for (const rect of optimizedRects) {
		maskGraphics.drawRect(
			rect.x / sceneScale,
			rect.y / sceneScale,
			Math.max(rect.width / sceneScale, minDimension),
			Math.max(rect.height / sceneScale, minDimension)
		);
	}

	maskGraphics.transform.setFromMatrix(new PIXI.Matrix());
	tempCanvas.remove();
	return maskGraphics;
}













// Definição do isoOutlineFilter
if (typeof PIXI !== 'undefined' && PIXI.filters) {
	const vertexShader =`
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
		constructor(thickness = 0.5, color = 0x000000, alpha = 0.5) {
			super(vertexShader, fragmentShader);

			// Inicialize os uniforms
			this.uniforms.outlineColor = new Float32Array(4);     // Para armazenar RGBA
			this.uniforms.outlineThickness = new Float32Array(2); // Para armazenar X e Y
			this.uniforms.filterArea = new Float32Array(2);       // Para área de filtro
			this.uniforms.alpha = alpha;

			// Configure as propriedades iniciais
			this.color = color;
			this.thickness = thickness;
		}

		get alpha() { return this.uniforms.alpha; }
		set alpha(value) { this.uniforms.alpha = value; }

		get color() { return PIXI.utils.rgb2hex(this.uniforms.outlineColor); }
		set color(value) { PIXI.utils.hex2rgb(value, this.uniforms.outlineColor); }

		get thickness() { return this.uniforms.outlineThickness[0]; }
		set thickness(value) {
			// Certifique-se de que filterArea tenha valores válidos
			const filterAreaX = this.uniforms.filterArea[0] || 1; // Evite divisão por 0
			const filterAreaY = this.uniforms.filterArea[1] || 1; // Evite divisão por 0
			
			this.uniforms.outlineThickness[0] = value / filterAreaX;
			this.uniforms.outlineThickness[1] = value / filterAreaY;
		}
	}

	// Add the isooutlinefilter to the PIXI.filters namepace
	PIXI.filters.isoOutlineFilter = IsoOutlineFilter;
} else {
	logError('PIXI ou PIXI.filters não estão disponíveis.');
}

// Create new outline filter
const outlineFilter = new PIXI.filters.isoOutlineFilter();
outlineFilter.thickness = 0.005;
//outlineFilter.color = 0x00ff59; // lime green
outlineFilter.color = 0x000000; // lime green
		
// Create a greyscale/dimming filter
const colorMatrix = new PIXI.ColorMatrixFilter();
colorMatrix.alpha = 1;
colorMatrix.matrix = [
	0.3,  0.0,  0.0,  0.0,  0.0,
	0.0,  0.3,  0.0,  0.0,  0.0,
	0.0,  0.0,  0.3,  0.0,  0.0,
	0.0,  0.0,  0.0,  1.0,  0.0
];

const alphaFilter = new PIXI.AlphaFilter();
alphaFilter.alpha = 0.5;

















// Adicione esta função
function debugVisualIntersection(token, tile, DEBUG_INTERSECTION) {
		if (!DEBUG_INTERSECTION) return;

		// Create unique identifier for this token-tile pair
		const debugId = `debug-${token.id}-${tile.id}`;

		// Remove old debug graphics for this specific pair
		const existingDebug = canvas.stage.children.find(c => c.name === debugId);
		if (existingDebug) {
				canvas.stage.removeChild(existingDebug);
				existingDebug.destroy();
		}

		// Get bounds
		const tokenBounds = token.mesh.getBounds();
		const tileBounds = tile.mesh.getBounds();

		// Check if there's an intersection at all
		const hasIntersection = (
				tokenBounds.x < tileBounds.x + tileBounds.width &&
				tokenBounds.x + tokenBounds.width > tileBounds.x &&
				tokenBounds.y < tileBounds.y + tileBounds.height &&
				tokenBounds.y + tokenBounds.height > tileBounds.y
		);

		// If no intersection, just remove the debug and return
		if (!hasIntersection) {
				return;
		}

		// Calculate centers
		const tokenCenter = {
				x: tokenBounds.x + (tokenBounds.width / 2),
				y: tokenBounds.y + (tokenBounds.height / 2)
		};
    
		const tileCenter = {
				x: tileBounds.x + (tileBounds.width / 2),
				y: tileBounds.y + (tileBounds.height / 2)
		};

		// Create new debug graphics with unique identifier
		const graphics = new PIXI.Graphics();
		graphics.name = debugId;

		// Draw tile bounds (red)
		graphics.lineStyle(2, 0xFF0000, 1);
		graphics.drawRect(tileBounds.x, tileBounds.y, tileBounds.width, tileBounds.height);
    
		// Draw tile center (red dot)
		graphics.beginFill(0xFF0000);
		graphics.drawCircle(tileCenter.x, tileCenter.y, 5);
		graphics.endFill();

		// Draw token bounds (blue)
		graphics.lineStyle(2, 0x0000FF, 1);
		graphics.drawRect(tokenBounds.x, tokenBounds.y, tokenBounds.width, tokenBounds.height);
    
		// Draw token center (blue dot)
		graphics.beginFill(0x0000FF);
		graphics.drawCircle(tokenCenter.x, tokenCenter.y, 5);
		graphics.endFill();

		// Draw line between centers (green if valid, yellow if invalid)
		const isValid = tokenCenter.x > tileCenter.x && tokenCenter.y > tileCenter.y;
		graphics.lineStyle(2, isValid ? 0x00FF00 : 0xFFFF00, 1);
		graphics.moveTo(tileCenter.x, tileCenter.y);
		graphics.lineTo(tokenCenter.x, tokenCenter.y);

		// Add text labels
		const style = new PIXI.TextStyle({
				fontSize: 12,
				fill: '#FFFFFF',
				stroke: '#000000',
				strokeThickness: 2
		});

		const tokenText = new PIXI.Text(`Token (${token.id})`, style);
		tokenText.position.set(tokenCenter.x + 10, tokenCenter.y + 10);
		graphics.addChild(tokenText);

		const tileText = new PIXI.Text(`Tile (${tile.id})`, style);
		tileText.position.set(tileCenter.x + 10, tileCenter.y + 10);
		graphics.addChild(tileText);

		// Add to canvas stage with high z-index
		graphics.zIndex = 999999;
		canvas.stage.addChild(graphics);
}

// Simple debounce for occlusion updates
let occlusionUpdateTimer = null;
function scheduleOcclusionUpdate(delay = 100) {
	if (occlusionUpdateTimer) clearTimeout(occlusionUpdateTimer);
	occlusionUpdateTimer = setTimeout(() => {
		updateOcclusionLayer();
		occlusionUpdateTimer = null;
	}, delay);
}