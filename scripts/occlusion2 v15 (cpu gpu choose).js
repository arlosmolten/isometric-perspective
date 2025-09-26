// Enhanced Occlusion Layer Module for Foundry VTT

export function registerOcclusionConfig() {
	// Global Hook Registration
	function registerGlobalHooks() {
		const updateTriggers = [ // Update triggers for occlusion layer
			'canvasReady', 
			'canvasPan',
			'canvasTokensRefresh', 
			'updateToken', 
			'controlToken', 
			'refreshToken',
			'preUpdateScene',  // Added to ensure update on scene modifications
			'updateScene'      // Added to ensure update on scene modifications
		];

		updateTriggers.forEach(hookName => {
			Hooks.on(hookName, () => {
				updateOcclusionLayer();
				//updateTokenEffects();
				//debouncedUpdate();
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

	// Initialize on ready
	// Hooks.once('ready', () => {
	// 	if (canvas.ready)
	// 			initializeFilters();
	// });

	// // Initialize on canvas setup
	// Hooks.on('canvasInit', () => {
	// 		initializeFilters();
	// });

	// // Reset on scene change
	// Hooks.on('changeScene', () => {
	// 		resetTokenEffects();
	// });

	// Start the module
	registerGlobalHooks();
}

// Otimização 1: Debounce do updateOcclusionLayer
//const debouncedUpdate = debounce(updateOcclusionLayer, 50);
//const throttledUpdate = throttle(updateOcclusionLayer, 50);





// Store filters globally
const filters = {
	colorMatrix: null,
	outlineFilter: null,
	initialized: false
};

// Initialize filters
function initializeFilters() {
	if (filters.initialized) return;

	// Create outline filter
	filters.outlineFilter = new PIXI.filters.isoOutlineFilter();
	filters.outlineFilter.thickness = 0.005;
	filters.outlineFilter.color = 0x00ff59;

	// Create color matrix filter
	filters.colorMatrix = new PIXI.ColorMatrixFilter();
	filters.colorMatrix.alpha = 1;
	filters.colorMatrix.matrix = [
			0.3, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.3, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.3, 0.0, 0.0,
			0.0, 0.0, 0.0, 1.0, 0.0
	];

	filters.initialized = true;
}

// Reset token effects
function resetTokenEffects() {
	if (!canvas.ready) return;
	
	canvas.tokens.placeables.forEach(token => {
		if (token.mesh) {
			token.mesh.filters = token.mesh.filters?.filter(f => 
				f !== filters.colorMatrix && f !== filters.outlineFilter) || [];
			token.mesh.mask = null;
		}
	});
}

// Update token effects
function updateTokenEffects() {
	if (!canvas.ready || !filters.initialized) return;

	// Get all tokens and tiles
	const tokens = canvas.tokens.placeables;
	const tiles = canvas.tiles.placeables;

	// Reset all tokens first
	resetTokenEffects();

	// Apply effects to tokens that intersect with tiles
	tokens.forEach(token => {
		const intersectingTiles = tiles.filter(tile => 
			checkTokenTileIntersection(token, tile)
		);

		if (intersectingTiles.length > 0) {
			applyTokenEffects(token, intersectingTiles);
		}
	});
}

// Apply effects to token
function applyTokenEffects(token, intersectingTiles) {
	if (!token.mesh) return;

	// Create mask for the token
	const mask = createOcclusionMask(token, intersectingTiles);
	if (mask) {
		token.mesh.mask = mask;
	}

	// Apply filters directly to token mesh
	token.mesh.filters = [...(token.mesh.filters || []).filter(f => f !== filters.colorMatrix && f !== filters.outlineFilter),
		filters.colorMatrix,
		filters.outlineFilter
	];
}










// Persistent occlusion layer configuration
const occlusionConfig = {
	container: null,
	tokensLayer: null,
	initialized: false
};

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

	tokens.forEach(token => {
		// Find tiles that intersect with this token
		const intersectingTiles = tiles.filter(tile => 
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
function checkTokenTileIntersection(token, tile) {
	// Basic intersection check using bounding boxes
	const tokenBounds = token.mesh.getBounds();
	const tileBounds = tile.mesh.getBounds();

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

	// Create a mask for the occlusion
	const mask = createOcclusionMask(token, intersectingTiles);
	
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
	const gpu = 0;
	const chunkSize = 2;
	// 1  = pixel perfect, but cpu intensive;
	// 2  = okish, still cpu intensive with a lot of tokens on scene, kinda pixelated, but work for simple tiles
	// 3  = still heavy on performance, but only with a lot of tokens, pixelated, works only on tiles with straight lines
	// 4+ = light on cpu in zoom out, heavy on cpu on zoom in, really pixelated
	// 8+ = light on cpu on almost all scenarios, works only with rectangle tiles

	if (gpu === 1) {
		return createOcclusionMask_gpu(token, intersectingTiles)
	} else {
		return createOcclusionMask_cpu(token, intersectingTiles, chunkSize)
	}
}

function createOcclusionMask_gpu(token, intersectingTiles) {
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
}



// 1/10 original terrible performance
function createOcclusionMask_cpu1(token, intersectingTiles, chunkSize = 2) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);

	// Create a temporary canvas once
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
	
	const tokenBounds = token.mesh.getBounds();

	intersectingTiles.forEach(tile => {
		const tileBounds = tile.mesh.getBounds();
		
		// Calculate intersection area
		const x = Math.max(tokenBounds.x, tileBounds.x);
		const y = Math.max(tokenBounds.y, tileBounds.y);
		const width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - x;
		const height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - y;

		// Skip if no intersection
		if (width <= 0 || height <= 0) return;

		// Access tile texture
		const tileTexture = tile.texture?.baseTexture?.resource?.source;
		if (!tileTexture || tileTexture.width <= 0 || tileTexture.height <= 0) return;

		// Set canvas size to intersection size
		tempCanvas.width = Math.ceil(width);
		tempCanvas.height = Math.ceil(height);

		// Calculate source and destination rectangles
		const sourceX = (x - tileBounds.x) * (tileTexture.width / tileBounds.width);
		const sourceY = (y - tileBounds.y) * (tileTexture.height / tileBounds.height);
		const sourceWidth = width * (tileTexture.width / tileBounds.width);
		const sourceHeight = height * (tileTexture.height / tileBounds.height);

		// Clear the canvas and Draw the relevant portion of the tile
		tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
		tempCtx.drawImage(tileTexture,
				sourceX, sourceY, sourceWidth, sourceHeight,
				0, 0, tempCanvas.width, tempCanvas.height
		);

		// Get image data for the intersection area
		const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
		const data = imageData.data;

		const width32 = tempCanvas.width;
		const height32 = tempCanvas.height;
		
		const dataU32 = new Uint32Array(imageData.data.buffer);

		for (let cy = 0; cy < height32; cy += chunkSize) {
			for (let cx = 0; cx < width32; cx += chunkSize) {
				let hasOpaquePixel = false;

				// Check the chunk for any non-transparent pixels
				chunkCheck: for (let by = 0; by < chunkSize; by++) {
					const y = cy + by;
					if (y >= height32) break;

					for (let bx = 0; bx < chunkSize; bx++) {
						const x = cx + bx;
						if (x >= width32) break;

						const pixelIndex = y * width32 + x;
						const alphaValue = dataU32[pixelIndex] >>> 24;

						if (alphaValue > 0) {
							hasOpaquePixel = true;
							break chunkCheck;
						}
					}
				}

				// If chunk has any non-transparent pixels, draw it
				if (hasOpaquePixel) {
					maskGraphics.drawRect(
						x + cx, 
						y + cy, 
						Math.min(chunkSize, width32 - cx), 
						Math.min(chunkSize, height32 - cy)
					);
				}
			}
		}
	});

	// Clean up
	tempCanvas.remove();
	return maskGraphics;
}

// 2/10 slightly better cpu version
function createOcclusionMask_cpu2(token, intersectingTiles, chunkSize = 1) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);

	// Get the current scene scale
	const stage = token.mesh.parent;
	const sceneScale = stage?.scale?.x ?? 1;
	
	// Adjust chunk size based on scene scale
	const adjustedChunkSize = chunkSize / sceneScale;

	// Create a single reusable canvas with maximum expected size
	const maxSize = Math.max(
			...intersectingTiles.map(tile => Math.max(tile.mesh.width, tile.mesh.height))
	);
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = maxSize;
	tempCanvas.height = maxSize;
	const tempCtx = tempCanvas.getContext('2d', { 
			willReadFrequently: true,
			alpha: true 
	});

	// Pre-allocate typed arrays for better performance
	const tokenBounds = token.mesh.getBounds(false, undefined); // Get bounds without transform
	const rectangles = [];

	for (const tile of intersectingTiles) {
			const tileBounds = tile.mesh.getBounds(false, undefined); // Get bounds without transform
			
			// Calculate intersection area in global space
			const x = Math.max(tokenBounds.x, tileBounds.x);
			const y = Math.max(tokenBounds.y, tileBounds.y);
			const width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - x;
			const height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - y;
			
			if (width <= 0 || height <= 0) continue;

			const tileTexture = tile.texture?.baseTexture?.resource?.source;
			if (!tileTexture || tileTexture.width <= 0 || tileTexture.height <= 0) continue;

			// Calculate source and destination rectangles
			const sourceX = (x - tileBounds.x) * (tileTexture.width / tileBounds.width);
			const sourceY = (y - tileBounds.y) * (tileTexture.height / tileBounds.height);
			const sourceWidth = width * (tileTexture.width / tileBounds.width);
			const sourceHeight = height * (tileTexture.height / tileBounds.height);

			// Clear only the required portion
			tempCtx.clearRect(0, 0, width, height);
			
			// Draw the relevant portion of the tile
			tempCtx.drawImage(tileTexture,
					sourceX, sourceY, sourceWidth, sourceHeight,
					0, 0, width, height
			);

			// Get image data for the intersection area
			const imageData = tempCtx.getImageData(0, 0, width, height);
			const dataU32 = new Uint32Array(imageData.data.buffer);

			// Process chunks in world space
			const chunksX = Math.ceil(width / adjustedChunkSize);
			const chunksY = Math.ceil(height / adjustedChunkSize);

			for (let cy = 0; cy < chunksY; cy++) {
					const yPos = cy * adjustedChunkSize;
					const chunkHeight = Math.min(adjustedChunkSize, height - yPos);

					for (let cx = 0; cx < chunksX; cx++) {
							const xPos = cx * adjustedChunkSize;
							const chunkWidth = Math.min(adjustedChunkSize, width - xPos);
							
							// Convert chunk position to texture space
							const textureX = Math.floor(xPos * (width / imageData.width));
							const textureY = Math.floor(yPos * (height / imageData.height));
							const textureWidth = Math.ceil(chunkWidth * (width / imageData.width));
							const textureHeight = Math.ceil(chunkHeight * (height / imageData.height));

							// Check if chunk has any non-transparent pixels
							let hasOpaquePixel = false;
							
							for (let py = textureY; py < textureY + textureHeight && py < imageData.height; py++) {
									const rowOffset = py * imageData.width;
									for (let px = textureX; px < textureX + textureWidth && px < imageData.width; px++) {
											if ((dataU32[rowOffset + px] >>> 24) > 0) {
													hasOpaquePixel = true;
													rectangles.push({
															x: x + xPos,
															y: y + yPos,
															width: chunkWidth,
															height: chunkHeight
													});
													py = textureY + textureHeight; // Break outer loop
													break;
											}
									}
							}
					}
			}
	}

	// Apply matrix transform to graphics to handle zoom
	maskGraphics.transform.setFromMatrix(stage.transform.worldTransform);

	// Draw all rectangles individually
	for (const rect of rectangles) {
			// Convert rectangle coordinates to local space
			const localX = rect.x / sceneScale;
			const localY = rect.y / sceneScale;
			const localWidth = rect.width / sceneScale;
			const localHeight = rect.height / sceneScale;
			
			maskGraphics.drawRect(localX, localY, localWidth, localHeight);
	}

	// Reset transform
	maskGraphics.transform.setFromMatrix(new PIXI.Matrix());

	// Clean up
	tempCanvas.remove();
	return maskGraphics;
}

// 4/10 performance cpu version
function createOcclusionMask_cpu4(token, intersectingTiles, chunkSize = 3) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);

	// Get the current scene scale
	const stage = token.mesh.parent;
	const sceneScale = stage?.scale?.x ?? 1;
	
	// Define minimum dimension here so it's available in the entire function scope
	const minDimension = 1 / sceneScale;
	
	// Adjust chunk size based on scene scale
	const adjustedChunkSize = Math.max(chunkSize / sceneScale, 1);

	// Create a single reusable canvas with maximum expected size
	const maxSize = Math.max(
			...intersectingTiles.map(tile => Math.max(tile.mesh.width, tile.mesh.height))
	);
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = maxSize;
	tempCanvas.height = maxSize;
	const tempCtx = tempCanvas.getContext('2d', { 
			willReadFrequently: true,
			alpha: true 
	});

	// Pre-allocate typed arrays for better performance
	const tokenBounds = token.mesh.getBounds(false, undefined);
	const rectangles = [];

	for (const tile of intersectingTiles) {
			const tileBounds = tile.mesh.getBounds(false, undefined);
			
			// Calculate intersection area in global space
			const x = Math.max(tokenBounds.x, tileBounds.x);
			const y = Math.max(tokenBounds.y, tileBounds.y);
			const width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - x;
			const height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - y;
			
			// Validate intersection dimensions
			if (width <= 0 || height <= 0) continue;
			
			// Ensure minimum dimensions
			if (width < minDimension || height < minDimension) continue;

			const tileTexture = tile.texture?.baseTexture?.resource?.source;
			if (!tileTexture || tileTexture.width <= 0 || tileTexture.height <= 0) continue;

			// Calculate source and destination rectangles
			const sourceX = (x - tileBounds.x) * (tileTexture.width / tileBounds.width);
			const sourceY = (y - tileBounds.y) * (tileTexture.height / tileBounds.height);
			const sourceWidth = width * (tileTexture.width / tileBounds.width);
			const sourceHeight = height * (tileTexture.height / tileBounds.height);

			// Validate source dimensions
			if (sourceWidth <= 0 || sourceHeight <= 0) continue;
			if (sourceX >= tileTexture.width || sourceY >= tileTexture.height) continue;

			// Calculate actual canvas dimensions needed
			const canvasWidth = Math.ceil(Math.max(1, width));
			const canvasHeight = Math.ceil(Math.max(1, height));

			// Update canvas size if needed
			if (tempCanvas.width < canvasWidth) tempCanvas.width = canvasWidth;
			if (tempCanvas.height < canvasHeight) tempCanvas.height = canvasHeight;

			// Clear only the required portion
			tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
			
			try {
					// Draw the relevant portion of the tile
					tempCtx.drawImage(tileTexture,
							Math.max(0, sourceX),
							Math.max(0, sourceY),
							Math.min(sourceWidth, tileTexture.width - sourceX),
							Math.min(sourceHeight, tileTexture.height - sourceY),
							0, 0, canvasWidth, canvasHeight
					);

					// Get image data for the intersection area
					const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
					const dataU32 = new Uint32Array(imageData.data.buffer);

					// Process chunks in world space
					const chunksX = Math.ceil(width / adjustedChunkSize);
					const chunksY = Math.ceil(height / adjustedChunkSize);

					for (let cy = 0; cy < chunksY; cy++) {
							const yPos = cy * adjustedChunkSize;
							const chunkHeight = Math.min(adjustedChunkSize, height - yPos);

							for (let cx = 0; cx < chunksX; cx++) {
									const xPos = cx * adjustedChunkSize;
									const chunkWidth = Math.min(adjustedChunkSize, width - xPos);
									
									// Convert chunk position to texture space
									const textureX = Math.floor(xPos * (canvasWidth / width));
									const textureY = Math.floor(yPos * (canvasHeight / height));
									const textureWidth = Math.ceil(chunkWidth * (canvasWidth / width));
									const textureHeight = Math.ceil(chunkHeight * (canvasHeight / height));

									// Validate texture coordinates
									if (textureX >= canvasWidth || textureY >= canvasHeight) continue;
									if (textureWidth <= 0 || textureHeight <= 0) continue;

									// Check if chunk has any non-transparent pixels
									let hasOpaquePixel = false;
									
									for (let py = textureY; py < Math.min(textureY + textureHeight, canvasHeight); py++) {
											const rowOffset = py * canvasWidth;
											for (let px = textureX; px < Math.min(textureX + textureWidth, canvasWidth); px++) {
													if ((dataU32[rowOffset + px] >>> 24) > 0) {
															hasOpaquePixel = true;
															rectangles.push({
																	x: x + xPos,
																	y: y + yPos,
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
			} catch (error) {
					console.warn('Error processing tile:', error);
					continue;
			}
	}

	// Apply matrix transform to graphics to handle zoom
	maskGraphics.transform.setFromMatrix(stage.transform.worldTransform);

	// Draw all rectangles individually
	for (const rect of rectangles) {
			// Convert rectangle coordinates to local space and ensure minimum dimensions
			const localX = rect.x / sceneScale;
			const localY = rect.y / sceneScale;
			const localWidth = Math.max(rect.width / sceneScale, minDimension);
			const localHeight = Math.max(rect.height / sceneScale, minDimension);
			
			maskGraphics.drawRect(localX, localY, localWidth, localHeight);
	}

	// Reset transform
	maskGraphics.transform.setFromMatrix(new PIXI.Matrix());

	// Clean up
	tempCanvas.remove();
	return maskGraphics;
}

// 2/10 versão com LOD, melhor performance, mas muito pixelado
function createOcclusionMask_cpu210(token, intersectingTiles, baseChunkSize = 1) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);

	// Get the current scene scale
	const stage = token.mesh.parent;
	const sceneScale = stage?.scale?.x ?? 1;
	
	// LOD System - Adjust chunk size based on zoom level
	function calculateLODChunkSize(baseSize, scale) {
			// Zoom out (scale < 1) = bigger chunks for better performance
			// Zoom in (scale > 1) = smaller chunks for better detail
			if (scale >= 2) return baseSize; // Maximum detail
			if (scale >= 1) return baseSize * 1.5;
			if (scale >= 0.5) return baseSize * 2;
			if (scale >= 0.25) return baseSize * 4;
			return baseSize * 8; // Minimum detail for very zoomed out views
	}

	// Calculate chunk size based on current zoom level
	const dynamicChunkSize = calculateLODChunkSize(baseChunkSize, sceneScale);
	
	// Define minimum dimension here so it's available in the entire function scope
	const minDimension = 1 / sceneScale;
	
	// Adjust chunk size based on scene scale
	const adjustedChunkSize = Math.max(dynamicChunkSize / sceneScale, 1);

	// Debug LOD level if needed
	// console.debug(`Zoom: ${sceneScale}, Chunk Size: ${dynamicChunkSize}, Adjusted: ${adjustedChunkSize}`);

	// Create a single reusable canvas with maximum expected size
	const maxSize = Math.max(
			...intersectingTiles.map(tile => Math.max(tile.mesh.width, tile.mesh.height))
	);
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = maxSize;
	tempCanvas.height = maxSize;
	const tempCtx = tempCanvas.getContext('2d', { 
			willReadFrequently: true,
			alpha: true 
	});

	// Pre-allocate typed arrays for better performance
	const tokenBounds = token.mesh.getBounds(false, undefined);
	const rectangles = [];

	// Cache for LOD processing
	const processedAreas = new Map();

	for (const tile of intersectingTiles) {
			const tileBounds = tile.mesh.getBounds(false, undefined);
			
			// Calculate intersection area in global space
			const x = Math.max(tokenBounds.x, tileBounds.x);
			const y = Math.max(tokenBounds.y, tileBounds.y);
			const width = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - x;
			const height = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - y;
			
			// Validate intersection dimensions
			if (width <= 0 || height <= 0) continue;
			
			// Ensure minimum dimensions
			if (width < minDimension || height < minDimension) continue;

			const tileTexture = tile.texture?.baseTexture?.resource?.source;
			if (!tileTexture || tileTexture.width <= 0 || tileTexture.height <= 0) continue;

			// Calculate source and destination rectangles
			const sourceX = (x - tileBounds.x) * (tileTexture.width / tileBounds.width);
			const sourceY = (y - tileBounds.y) * (tileTexture.height / tileBounds.height);
			const sourceWidth = width * (tileTexture.width / tileBounds.width);
			const sourceHeight = height * (tileTexture.height / tileBounds.height);

			// Validate source dimensions
			if (sourceWidth <= 0 || sourceHeight <= 0) continue;
			if (sourceX >= tileTexture.width || sourceY >= tileTexture.height) continue;

			// LOD-based sampling rate for texture analysis
			const samplingRate = Math.max(1, Math.floor(4 / sceneScale)); // Increase sampling rate when zoomed out

			// Calculate actual canvas dimensions needed with LOD consideration
			const canvasWidth = Math.ceil(Math.max(1, width / samplingRate));
			const canvasHeight = Math.ceil(Math.max(1, height / samplingRate));

			// Update canvas size if needed
			if (tempCanvas.width < canvasWidth) tempCanvas.width = canvasWidth;
			if (tempCanvas.height < canvasHeight) tempCanvas.height = canvasHeight;

			// Clear only the required portion
			tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
			
			try {
					// Draw the relevant portion of the tile with LOD-based scaling
					tempCtx.drawImage(tileTexture,
							Math.max(0, sourceX),
							Math.max(0, sourceY),
							Math.min(sourceWidth, tileTexture.width - sourceX),
							Math.min(sourceHeight, tileTexture.height - sourceY),
							0, 0, canvasWidth, canvasHeight
					);

					// Get image data for the intersection area
					const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
					const dataU32 = new Uint32Array(imageData.data.buffer);

					// Process chunks in world space
					const chunksX = Math.ceil(width / adjustedChunkSize);
					const chunksY = Math.ceil(height / adjustedChunkSize);

					for (let cy = 0; cy < chunksY; cy++) {
							const yPos = cy * adjustedChunkSize;
							const chunkHeight = Math.min(adjustedChunkSize, height - yPos);

							for (let cx = 0; cx < chunksX; cx++) {
									const xPos = cx * adjustedChunkSize;
									const chunkWidth = Math.min(adjustedChunkSize, width - xPos);

									// LOD-based chunk caching
									const chunkKey = `${Math.floor(x + xPos)},${Math.floor(y + yPos)}`;
									if (processedAreas.has(chunkKey)) continue;
									
									// Convert chunk position to texture space considering LOD sampling
									const textureX = Math.floor(xPos * (canvasWidth / width));
									const textureY = Math.floor(yPos * (canvasHeight / height));
									const textureWidth = Math.ceil(chunkWidth * (canvasWidth / width));
									const textureHeight = Math.ceil(chunkHeight * (canvasHeight / height));

									// Validate texture coordinates
									if (textureX >= canvasWidth || textureY >= canvasHeight) continue;
									if (textureWidth <= 0 || textureHeight <= 0) continue;

									// Check if chunk has any non-transparent pixels with LOD-based sampling
									let hasOpaquePixel = false;
									
									// Adjust sampling step based on zoom level
									const pixelStep = Math.max(1, Math.floor(1 / sceneScale));
									
									for (let py = textureY; py < Math.min(textureY + textureHeight, canvasHeight); py += pixelStep) {
											const rowOffset = py * canvasWidth;
											for (let px = textureX; px < Math.min(textureX + textureWidth, canvasWidth); px += pixelStep) {
													if ((dataU32[rowOffset + px] >>> 24) > 0) {
															hasOpaquePixel = true;
															const rect = {
																	x: x + xPos,
																	y: y + yPos,
																	width: chunkWidth,
																	height: chunkHeight
															};
															rectangles.push(rect);
															processedAreas.set(chunkKey, rect);
															py = canvasHeight; // Break outer loop
															break;
													}
											}
									}
							}
					}
			} catch (error) {
					console.warn('Error processing tile:', error);
					continue;
			}
	}

	// Apply matrix transform to graphics to handle zoom
	maskGraphics.transform.setFromMatrix(stage.transform.worldTransform);

	// Draw all rectangles individually with LOD-based merging
	const mergedRectangles = mergeAdjacentRectangles(rectangles, sceneScale);
	for (const rect of mergedRectangles) {
			// Convert rectangle coordinates to local space and ensure minimum dimensions
			const localX = rect.x / sceneScale;
			const localY = rect.y / sceneScale;
			const localWidth = Math.max(rect.width / sceneScale, minDimension);
			const localHeight = Math.max(rect.height / sceneScale, minDimension);
			
			maskGraphics.drawRect(localX, localY, localWidth, localHeight);
	}

	// Reset transform
	maskGraphics.transform.setFromMatrix(new PIXI.Matrix());

	// Clean up
	tempCanvas.remove();
	processedAreas.clear();
	return maskGraphics;
}
// Helper function to merge adjacent rectangles for LOD optimization
function mergeAdjacentRectangles(rectangles, scale) {
	if (scale >= 1) return rectangles; // Don't merge when zoomed in
	
	const merged = [...rectangles];
	let didMerge;
	
	do {
			didMerge = false;
			for (let i = 0; i < merged.length; i++) {
					for (let j = i + 1; j < merged.length; j++) {
							const r1 = merged[i];
							const r2 = merged[j];
							
							// Check if rectangles are adjacent
							if (areRectanglesAdjacent(r1, r2)) {
									// Merge rectangles
									const mergedRect = {
											x: Math.min(r1.x, r2.x),
											y: Math.min(r1.y, r2.y),
											width: Math.max(r1.x + r1.width, r2.x + r2.width) - Math.min(r1.x, r2.x),
											height: Math.max(r1.y + r1.height, r2.y + r2.height) - Math.min(r1.y, r2.y)
									};
									
									// Replace r1 with merged rectangle and remove r2
									merged[i] = mergedRect;
									merged.splice(j, 1);
									didMerge = true;
									break;
							}
					}
					if (didMerge) break;
			}
	} while (didMerge);
	
	return merged;
}
// Helper function to check if two rectangles are adjacent
function areRectanglesAdjacent(r1, r2) {
	const tolerance = 0.1; // Tolerance for floating point comparisons
	
	// Check if rectangles are touching horizontally
	const horizontallyAdjacent = 
			Math.abs((r1.x + r1.width) - r2.x) < tolerance ||
			Math.abs((r2.x + r2.width) - r1.x) < tolerance;
	
	// Check if rectangles are touching vertically
	const verticallyAdjacent = 
			Math.abs((r1.y + r1.height) - r2.y) < tolerance ||
			Math.abs((r2.y + r2.height) - r1.y) < tolerance;
	
	// Check if rectangles overlap in the other dimension
	const horizontalOverlap = 
			(r1.y <= r2.y + r2.height + tolerance) && 
			(r2.y <= r1.y + r1.height + tolerance);
	
	const verticalOverlap = 
			(r1.x <= r2.x + r2.width + tolerance) && 
			(r2.x <= r1.x + r1.width + tolerance);
	
	return (horizontallyAdjacent && horizontalOverlap) || 
				 (verticallyAdjacent && verticalOverlap);
}

// 4/10 versão otimizada 2 (não senti muita diferença)
function createOcclusionMask_cpu(token, intersectingTiles, chunkSize = 1) {
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

		tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);

		try {
			// Draw tile portion
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
		} catch (error) {
			console.warn('Error processing tile:', error);
			continue;
		}
	}

	// Apply matrix transform
	maskGraphics.transform.setFromMatrix(stage.transform.worldTransform);

	// Draw rectangles
	for (const rect of rectangles) {
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
	console.error('PIXI ou PIXI.filters não estão disponíveis.');
}

// Create new outline filter
const outlineFilter = new PIXI.filters.isoOutlineFilter();
outlineFilter.thickness = 0.005;
outlineFilter.color = 0x00ff59;
		
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