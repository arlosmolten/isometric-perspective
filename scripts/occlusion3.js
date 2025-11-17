// WORKING

export function registerOcclusionConfig() {
	// Only enable if the setting is turned on
	//const enableOcclusionLayer = game.settings.get(MODULE_ID, "enableOcclusionLayer");
	//if (!enableOcclusionLayer) return;
 
	// Hook into canvas initialization
	Hooks.on('canvasInit', () => {
	  // Remove existing container if it exists
	  if (occlusionContainer) {
			canvas.stage.removeChild(occlusionContainer);
			occlusionContainer.destroy({ children: true });
	  }
 
	  // Create the main occlusion container
	  occlusionContainer = new PIXI.Container();
	  occlusionContainer.name = "OcclusionContainer";
	  occlusionContainer.eventMode = 'passive';
 
	  // Create a layer for occlusion tokens
	  occlusionTokensLayer = new PIXI.Container();
	  occlusionTokensLayer.name = "OcclusionTokens";
	  occlusionTokensLayer.sortableChildren = true;
 
	  // Add the layer to the container
	  occlusionContainer.addChild(occlusionTokensLayer);
 
	  // Add to canvas stage
	  canvas.stage.addChild(occlusionContainer);
	  canvas.stage.sortChildren();
	});
 
	// Reset container on scene change
	Hooks.on('changeScene', () => {
		if (occlusionContainer) {
			canvas.stage.removeChild(occlusionContainer);
			occlusionContainer.destroy({ children: true });
			occlusionContainer = null;
			occlusionTokensLayer = null;
		}
	});
 
	// Update occlusion layer when relevant events occur
	const updateTriggers = [
	  'canvasReady', 
	  'canvasTokensRefresh', 
	  'updateToken', 
	  'controlToken', 
	  'refreshToken',
	  'canvasPan'
	];
 
	updateTriggers.forEach(hookName => {
	  Hooks.on(hookName, () => {
			updateOcclusionLayer();
	  });
	});
 
 
	
}






// Occlusion layer container
let occlusionContainer;
let occlusionTokensLayer;
 
function updateOcclusionLayer() {
	if (!canvas.ready || !occlusionContainer) return;
	
	// Clear existing occlusion tokens
	occlusionTokensLayer.removeChildren();
	
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
				occlusionTokensLayer.addChild(occlusionSprite);
			}
		}
	});
	
	// Rastreia tokens que já receberam máscara de oclusão
	const occludedTokens = new Set();
	
	// Agora, processa oclusão entre tokens
	for (let i = 0; i < tokens.length; i++) {
		for (let j = i + 1; j < tokens.length; j++) {
			const tokenA = tokens[i];
			const tokenB = tokens[j];
	
			// Verifica se os tokens estão se sobrepondo
			if (checkTokenTokenIntersection(tokenA, tokenB)) {
				// Determina qual token deve ser ocluído
				const [occludedToken, occludingToken] = determineOcclusionPriority(tokenA, tokenB);
		
				// Cria sprite de oclusão se o token ainda não foi ocluído
				if (!occludedTokens.has(occludedToken.id)) {
					const occlusionSprite = createOcclusionSpriteFromTokens(occludedToken, [occludingToken]);
		
					if (occlusionSprite) {
						occlusionTokensLayer.addChild(occlusionSprite);
						occludedTokens.add(occludedToken.id);
					}
				}
			}
		}
	}
		


}
 
function checkTokenTileIntersection(token, tile) {
	// Basic intersection check using bounding boxes
	const tokenBounds = token.mesh.getBounds();
	const tileBounds = tile.mesh.getBounds();
	
	return (
		tokenBounds.x  <  tileBounds.x        +  tileBounds.width  &&
		tokenBounds.x  +  tokenBounds.width   >  tileBounds.x      &&
		tokenBounds.y  <  tileBounds.y        +  tileBounds.height &&
		tokenBounds.y  +  tokenBounds.height  >  tileBounds.y
	);
}
 
function createOcclusionSprite(token, intersectingTiles) {
	if (!token.mesh || !token.mesh.texture) return null;
	
	try {
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
	
		const colorMatrix = new PIXI.ColorMatrixFilter();
		colorMatrix.matrix = [
			0, 0, 0, 0, 0,
			0, 0, 0, 0, 0,
			1, 1, 1, 0, 0,
			0, 0, 0, 1, 0
		];
		sprite.filters = [colorMatrix];
	
		sprite.alpha = 0.75;
		sprite.eventMode = 'passive';
	
		return sprite;
	} catch (error) {
		console.error("Error creating occlusion sprite:", error);
		return null;
	}
}
 
function createOcclusionMask(token, intersectingTiles) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);
	
	intersectingTiles.forEach(tile => {
		const tokenBounds = token.mesh.getBounds();
		const tileBounds = tile.mesh.getBounds();
		
		// Calcular a área de interseção entre o token e o tile
		const intersectionX = Math.max(tokenBounds.x, tileBounds.x);
		const intersectionY = Math.max(tokenBounds.y, tileBounds.y);
		const intersectionWidth = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - intersectionX;
		const intersectionHeight = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - intersectionY;

		// Se a interseção for válida (não negativa)
		if (intersectionWidth > 0 && intersectionHeight > 0) {
			// Criar uma textura de máscara com base na transparência
			const tileTexture = tile.texture.baseTexture.resource.source;
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			// Desenhando a textura no canvas
			canvas.width = intersectionWidth; //tileTexture.width;
			canvas.height = intersectionHeight; //tileTexture.height;
			ctx.drawImage(tileTexture, 0, 0);

			// Obter dados de imagem da área de interseção
			// const imageData = ctx.getImageData(
			// 	intersectionX - tileBounds.x,
			// 	intersectionY - tileBounds.y,
			// 	intersectionWidth,
			// 	intersectionHeight
			// );
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			// Criar uma área de desenho eficiente utilizando a transparência
			let transparentArea = false;
			for (let i = 0; i < data.length; i += 4) {
				const alpha = data[i + 3]; // Canal alpha (transparência)
				if (alpha === 0) {
					transparentArea = true;
					break;
				}
			}

			// Se o tile tem uma área de transparência, desenhe a interseção
			if (transparentArea) {
				maskGraphics.drawRect(
					intersectionX,
					intersectionY,
					intersectionWidth,
					intersectionHeight
				);
			}
				
		}
	});
	
	maskGraphics.endFill();
	return maskGraphics;
}




	
	
	
	
	
	
	
	
	
// Token-Token Occlusion
/*function checkTokenTokenIntersection(tokenA, tokenB) {
	const boundsA = tokenA.mesh.getBounds();
	const boundsB = tokenB.mesh.getBounds();
	
	return (
		boundsA.x < boundsB.x + boundsB.width &&
		boundsA.x + boundsA.width > boundsB.x &&
		boundsA.y < boundsB.y + boundsB.height &&
		boundsA.y + boundsA.height > boundsB.y
	);
}*/

function determineOcclusionPriority(tokenA, tokenB) {
	// Compara o valor de sort dos tokens
	// O token com maior valor de sort será o que oculta o outro
	return tokenA.document.sort > tokenB.document.sort  ?  [tokenB, tokenA]  :  [tokenA, tokenB];
}

function createTokenOcclusionMask(occludedToken, occludingTokens) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);
	
	occludingTokens.forEach(occludingToken => {
		const tokenBounds = occludedToken.mesh.getBounds();
		const occludingBounds = occludingToken.mesh.getBounds();
	
		const intersectionX = Math.max(tokenBounds.x, occludingBounds.x);
		const intersectionY = Math.max(tokenBounds.y, occludingBounds.y);
		const intersectionWidth = Math.min(
			tokenBounds.x + tokenBounds.width, 
			occludingBounds.x + occludingBounds.width
		) - intersectionX;
		const intersectionHeight = Math.min(
			tokenBounds.y + tokenBounds.height, 
			occludingBounds.y + occludingBounds.height
		) - intersectionY;
	
		// Desenha a área de intersecção
		maskGraphics.drawRect(
			intersectionX, 
			intersectionY, 
			intersectionWidth, 
			intersectionHeight
		);
	});
	
	maskGraphics.endFill();
	return maskGraphics;
}

// Token to Token Occlusion
function createOcclusionSpriteFromTokens(occludedToken, occludingTokens) {
	if (!occludedToken.mesh || !occludedToken.mesh.texture) return null;
	
	try {
		// Cria um sprite do token ocluído
		const sprite = new PIXI.Sprite(occludedToken.mesh.texture);
		sprite.position.set(
			occludedToken.mesh.position.x, 
			occludedToken.mesh.position.y
		);
		sprite.anchor.set(
			occludedToken.mesh.anchor.x, 
			occludedToken.mesh.anchor.y
		);
		sprite.angle = occludedToken.mesh.angle;
		sprite.scale.set(
			occludedToken.mesh.scale.x, 
			occludedToken.mesh.scale.y
		);
	
		// Cria máscara de oclusão baseada nos tokens que o estão cobrindo
		const mask = createTokenOcclusionMask(occludedToken, occludingTokens);
		if (mask) {
			sprite.mask = mask;
		}
	
		const colorMatrix = new PIXI.ColorMatrixFilter();
		colorMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 
			0, 0, 0, 0, 0, 
			1, 0, 0, 1, 0
		];
		sprite.filters = [colorMatrix];
	
		sprite.alpha = 0.5;
		sprite.eventMode = 'passive';
	
		return sprite;
	} catch (error) {
		console.error("Erro ao criar sprite de oclusão entre tokens:", error);
		return null;
	}
}
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
// Substitua a função de intersecção existente
function checkTokenTokenIntersection(tokenA, tokenB) {
	return checkNonTransparentIntersection(tokenA, tokenB);
}
	
function checkNonTransparentIntersection(tokenA, tokenB) {
	// Verifica se as texturas dos tokens existem
	if (!tokenA.mesh?.texture || !tokenB.mesh?.texture) return false;
	
	// Obtém os bounds dos tokens
	const boundsA = tokenA.mesh.getBounds();
	const boundsB = tokenB.mesh.getBounds();
	
	// Verifica intersecção básica de bounding box primeiro
	if (!(
		boundsA.x < boundsB.x      + boundsB.width  &&
		boundsA.x + boundsA.width  > boundsB.x      &&
		boundsA.y < boundsB.y      + boundsB.height &&
		boundsA.y + boundsA.height > boundsB.y
	)) {
		return false;
	}
	
	// Cria um canvas temporário para comparação de pixels
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	
	// Define o tamanho do canvas para cobrir a intersecção
	const intersectionX = Math.max(boundsA.x, boundsB.x);
	const intersectionY = Math.max(boundsA.y, boundsB.y);
	const intersectionWidth = Math.min(boundsA.x + boundsA.width, boundsB.x + boundsB.width) - intersectionX;
	const intersectionHeight = Math.min(boundsA.y + boundsA.height, boundsB.y + boundsB.height) - intersectionY;
	
	canvas.width = intersectionWidth;
	canvas.height = intersectionHeight;
	
	// Desenha as texturas dos tokens na posição de intersecção
	function drawTokenTexture(token, offsetX, offsetY) {
		const texture = token.mesh.texture;
		const sprite = new PIXI.Sprite(texture);
		
		// Converte a textura do PIXI para imagem de canvas
		const baseTexture = texture.baseTexture;
		const image = baseTexture.resource.source;
	
		context.drawImage(
			image, 
			token.mesh.getBounds().x - intersectionX + offsetX, 
			token.mesh.getBounds().y - intersectionY + offsetY,
			token.mesh.width, 
			token.mesh.height
		);
	}
	
	// Desenha ambos os tokens
	drawTokenTexture(tokenA, 0, 0);
	drawTokenTexture(tokenB, 0, 0);
	
	// Verifica pixels na área de intersecção
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	const pixels = imageData.data;
	
	// Conta pixels não transparentes
	let nonTransparentPixels = 0;
	for (let i = 3; i < pixels.length; i += 4) {
		// Se o pixel alfa for maior que um limiar (por exemplo, 10)
		if (pixels[i] > 10) {
			nonTransparentPixels++;
		}
	}
	
	// Libera recursos
	canvas.remove();
	
	// Retorna true se houver pixels não transparentes significativos
	return nonTransparentPixels > (canvas.width * canvas.height * 0.01); // 1% de pixels não transparentes
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
		constructor(thickness = 1, color = 0x000000, alpha = 1) {
			super(vertexShader, fragmentShader);

			// Inicialize os uniforms
			this.uniforms.outlineColor = new Float32Array(4); // Para armazenar RGBA
			this.uniforms.outlineThickness = new Float32Array(2); // Para armazenar X e Y
			this.uniforms.filterArea = new Float32Array(2); // Para área de filtro
			this.uniforms.alpha = alpha;

			// Configure as propriedades iniciais
			this.color = color;
			this.thickness = thickness;
		}

		get alpha() {
			return this.uniforms.alpha;
		}
		set alpha(value) {
			this.uniforms.alpha = value;
		}

		get color() {
			return PIXI.utils.rgb2hex(this.uniforms.outlineColor);
		}
		set color(value) {
			PIXI.utils.hex2rgb(value, this.uniforms.outlineColor);
		}

		get thickness() {
			return this.uniforms.outlineThickness[0];
		}
		set thickness(value) {
			// Certifique-se de que filterArea tenha valores válidos
			const filterAreaX = this.uniforms.filterArea[0] || 1; // Evite divisão por 0
			const filterAreaY = this.uniforms.filterArea[1] || 1; // Evite divisão por 0
			
			this.uniforms.outlineThickness[0] = value / filterAreaX;
			this.uniforms.outlineThickness[1] = value / filterAreaY;
		}
	}

	// Adicione o isoOutlineFilter ao namespace PIXI.filters
	PIXI.filters.isoOutlineFilter = IsoOutlineFilter;
} else {
	console.error('PIXI ou PIXI.filters não estão disponíveis.');
}
// WORKING

export function registerOcclusionConfig() {
	// Only enable if the setting is turned on
	//const enableOcclusionLayer = game.settings.get(MODULE_ID, "enableOcclusionLayer");
	//if (!enableOcclusionLayer) return;
 
	// Hook into canvas initialization
	Hooks.on('canvasInit', () => {
	  // Remove existing container if it exists
	  if (occlusionContainer) {
			canvas.stage.removeChild(occlusionContainer);
			occlusionContainer.destroy({ children: true });
	  }
 
	  // Create the main occlusion container
	  occlusionContainer = new PIXI.Container();
	  occlusionContainer.name = "OcclusionContainer";
	  occlusionContainer.eventMode = 'passive';
 
	  // Create a layer for occlusion tokens
	  occlusionTokensLayer = new PIXI.Container();
	  occlusionTokensLayer.name = "OcclusionTokens";
	  occlusionTokensLayer.sortableChildren = true;
 
	  // Add the layer to the container
	  occlusionContainer.addChild(occlusionTokensLayer);
 
	  // Add to canvas stage
	  canvas.stage.addChild(occlusionContainer);
	  canvas.stage.sortChildren();
	});
 
	// Reset container on scene change
	Hooks.on('changeScene', () => {
		if (occlusionContainer) {
			canvas.stage.removeChild(occlusionContainer);
			occlusionContainer.destroy({ children: true });
			occlusionContainer = null;
			occlusionTokensLayer = null;
		}
	});
 
	// Update occlusion layer when relevant events occur
	const updateTriggers = [
	  'canvasReady', 
	  'canvasTokensRefresh', 
	  'updateToken', 
	  'controlToken', 
	  'refreshToken',
	  'canvasPan'
	];
 
	updateTriggers.forEach(hookName => {
	  Hooks.on(hookName, () => {
			updateOcclusionLayer();
	  });
	});
 
 
	
}






// Occlusion layer container
let occlusionContainer;
let occlusionTokensLayer;
 
function updateOcclusionLayer() {
	if (!canvas.ready || !occlusionContainer) return;
	
	// Clear existing occlusion tokens
	occlusionTokensLayer.removeChildren();
	
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
				occlusionTokensLayer.addChild(occlusionSprite);
			}
		}
	});
	
	// Rastreia tokens que já receberam máscara de oclusão
	const occludedTokens = new Set();
	
	// Agora, processa oclusão entre tokens
	for (let i = 0; i < tokens.length; i++) {
		for (let j = i + 1; j < tokens.length; j++) {
			const tokenA = tokens[i];
			const tokenB = tokens[j];
	
			// Verifica se os tokens estão se sobrepondo
			if (checkTokenTokenIntersection(tokenA, tokenB)) {
				// Determina qual token deve ser ocluído
				const [occludedToken, occludingToken] = determineOcclusionPriority(tokenA, tokenB);
		
				// Cria sprite de oclusão se o token ainda não foi ocluído
				if (!occludedTokens.has(occludedToken.id)) {
					const occlusionSprite = createOcclusionSpriteFromTokens(occludedToken, [occludingToken]);
		
					if (occlusionSprite) {
						occlusionTokensLayer.addChild(occlusionSprite);
						occludedTokens.add(occludedToken.id);
					}
				}
			}
		}
	}
		


}
 
function checkTokenTileIntersection(token, tile) {
	// Basic intersection check using bounding boxes
	const tokenBounds = token.mesh.getBounds();
	const tileBounds = tile.mesh.getBounds();
	
	return (
		tokenBounds.x  <  tileBounds.x        +  tileBounds.width  &&
		tokenBounds.x  +  tokenBounds.width   >  tileBounds.x      &&
		tokenBounds.y  <  tileBounds.y        +  tileBounds.height &&
		tokenBounds.y  +  tokenBounds.height  >  tileBounds.y
	);
}
 
function createOcclusionSprite(token, intersectingTiles) {
	if (!token.mesh || !token.mesh.texture) return null;
	
	try {
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
	
		const colorMatrix = new PIXI.ColorMatrixFilter();
		colorMatrix.matrix = [
			0, 0, 0, 0, 0,
			0, 0, 0, 0, 0,
			1, 1, 1, 0, 0,
			0, 0, 0, 1, 0
		];
		sprite.filters = [colorMatrix];
	
		sprite.alpha = 0.75;
		sprite.eventMode = 'passive';
	
		return sprite;
	} catch (error) {
		console.error("Error creating occlusion sprite:", error);
		return null;
	}
}
 
function createOcclusionMask(token, intersectingTiles) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);
	
	intersectingTiles.forEach(tile => {
		const tokenBounds = token.mesh.getBounds();
		const tileBounds = tile.mesh.getBounds();
		
		// Calcular a área de interseção entre o token e o tile
		const intersectionX = Math.max(tokenBounds.x, tileBounds.x);
		const intersectionY = Math.max(tokenBounds.y, tileBounds.y);
		const intersectionWidth = Math.min(tokenBounds.x + tokenBounds.width, tileBounds.x + tileBounds.width) - intersectionX;
		const intersectionHeight = Math.min(tokenBounds.y + tokenBounds.height, tileBounds.y + tileBounds.height) - intersectionY;

		// Se a interseção for válida (não negativa)
		if (intersectionWidth > 0 && intersectionHeight > 0) {
			// Criar uma textura de máscara com base na transparência
			const tileTexture = tile.texture.baseTexture.resource.source;
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			// Desenhando a textura no canvas
			canvas.width = intersectionWidth; //tileTexture.width;
			canvas.height = intersectionHeight; //tileTexture.height;
			ctx.drawImage(tileTexture, 0, 0);

			// Obter dados de imagem da área de interseção
			// const imageData = ctx.getImageData(
			// 	intersectionX - tileBounds.x,
			// 	intersectionY - tileBounds.y,
			// 	intersectionWidth,
			// 	intersectionHeight
			// );
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			// Criar uma área de desenho eficiente utilizando a transparência
			let transparentArea = false;
			for (let i = 0; i < data.length; i += 4) {
				const alpha = data[i + 3]; // Canal alpha (transparência)
				if (alpha === 0) {
					transparentArea = true;
					break;
				}
			}

			// Se o tile tem uma área de transparência, desenhe a interseção
			if (transparentArea) {
				maskGraphics.drawRect(
					intersectionX,
					intersectionY,
					intersectionWidth,
					intersectionHeight
				);
			}
				
		}
	});
	
	maskGraphics.endFill();
	return maskGraphics;
}




	
	
	
	
	
	
	
	
	
// Token-Token Occlusion
/*function checkTokenTokenIntersection(tokenA, tokenB) {
	const boundsA = tokenA.mesh.getBounds();
	const boundsB = tokenB.mesh.getBounds();
	
	return (
		boundsA.x < boundsB.x + boundsB.width &&
		boundsA.x + boundsA.width > boundsB.x &&
		boundsA.y < boundsB.y + boundsB.height &&
		boundsA.y + boundsA.height > boundsB.y
	);
}*/

function determineOcclusionPriority(tokenA, tokenB) {
	// Compara o valor de sort dos tokens
	// O token com maior valor de sort será o que oculta o outro
	return tokenA.document.sort > tokenB.document.sort  ?  [tokenB, tokenA]  :  [tokenA, tokenB];
}

function createTokenOcclusionMask(occludedToken, occludingTokens) {
	const maskGraphics = new PIXI.Graphics();
	maskGraphics.beginFill(0xffffff);
	
	occludingTokens.forEach(occludingToken => {
		const tokenBounds = occludedToken.mesh.getBounds();
		const occludingBounds = occludingToken.mesh.getBounds();
	
		const intersectionX = Math.max(tokenBounds.x, occludingBounds.x);
		const intersectionY = Math.max(tokenBounds.y, occludingBounds.y);
		const intersectionWidth = Math.min(
			tokenBounds.x + tokenBounds.width, 
			occludingBounds.x + occludingBounds.width
		) - intersectionX;
		const intersectionHeight = Math.min(
			tokenBounds.y + tokenBounds.height, 
			occludingBounds.y + occludingBounds.height
		) - intersectionY;
	
		// Desenha a área de intersecção
		maskGraphics.drawRect(
			intersectionX, 
			intersectionY, 
			intersectionWidth, 
			intersectionHeight
		);
	});
	
	maskGraphics.endFill();
	return maskGraphics;
}

// Token to Token Occlusion
function createOcclusionSpriteFromTokens(occludedToken, occludingTokens) {
	if (!occludedToken.mesh || !occludedToken.mesh.texture) return null;
	
	try {
		// Cria um sprite do token ocluído
		const sprite = new PIXI.Sprite(occludedToken.mesh.texture);
		sprite.position.set(
			occludedToken.mesh.position.x, 
			occludedToken.mesh.position.y
		);
		sprite.anchor.set(
			occludedToken.mesh.anchor.x, 
			occludedToken.mesh.anchor.y
		);
		sprite.angle = occludedToken.mesh.angle;
		sprite.scale.set(
			occludedToken.mesh.scale.x, 
			occludedToken.mesh.scale.y
		);
	
		// Cria máscara de oclusão baseada nos tokens que o estão cobrindo
		const mask = createTokenOcclusionMask(occludedToken, occludingTokens);
		if (mask) {
			sprite.mask = mask;
		}
	
		const colorMatrix = new PIXI.ColorMatrixFilter();
		colorMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 
			0, 0, 0, 0, 0, 
			1, 0, 0, 1, 0
		];
		sprite.filters = [colorMatrix];
	
		sprite.alpha = 0.5;
		sprite.eventMode = 'passive';
	
		return sprite;
	} catch (error) {
		console.error("Erro ao criar sprite de oclusão entre tokens:", error);
		return null;
	}
}
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
// Substitua a função de intersecção existente
function checkTokenTokenIntersection(tokenA, tokenB) {
	return checkNonTransparentIntersection(tokenA, tokenB);
}
	
function checkNonTransparentIntersection(tokenA, tokenB) {
	// Verifica se as texturas dos tokens existem
	if (!tokenA.mesh?.texture || !tokenB.mesh?.texture) return false;
	
	// Obtém os bounds dos tokens
	const boundsA = tokenA.mesh.getBounds();
	const boundsB = tokenB.mesh.getBounds();
	
	// Verifica intersecção básica de bounding box primeiro
	if (!(
		boundsA.x < boundsB.x      + boundsB.width  &&
		boundsA.x + boundsA.width  > boundsB.x      &&
		boundsA.y < boundsB.y      + boundsB.height &&
		boundsA.y + boundsA.height > boundsB.y
	)) {
		return false;
	}
	
	// Cria um canvas temporário para comparação de pixels
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	
	// Define o tamanho do canvas para cobrir a intersecção
	const intersectionX = Math.max(boundsA.x, boundsB.x);
	const intersectionY = Math.max(boundsA.y, boundsB.y);
	const intersectionWidth = Math.min(boundsA.x + boundsA.width, boundsB.x + boundsB.width) - intersectionX;
	const intersectionHeight = Math.min(boundsA.y + boundsA.height, boundsB.y + boundsB.height) - intersectionY;
	
	canvas.width = intersectionWidth;
	canvas.height = intersectionHeight;
	
	// Desenha as texturas dos tokens na posição de intersecção
	function drawTokenTexture(token, offsetX, offsetY) {
		const texture = token.mesh.texture;
		const sprite = new PIXI.Sprite(texture);
		
		// Converte a textura do PIXI para imagem de canvas
		const baseTexture = texture.baseTexture;
		const image = baseTexture.resource.source;
	
		context.drawImage(
			image, 
			token.mesh.getBounds().x - intersectionX + offsetX, 
			token.mesh.getBounds().y - intersectionY + offsetY,
			token.mesh.width, 
			token.mesh.height
		);
	}
	
	// Desenha ambos os tokens
	drawTokenTexture(tokenA, 0, 0);
	drawTokenTexture(tokenB, 0, 0);
	
	// Verifica pixels na área de intersecção
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	const pixels = imageData.data;
	
	// Conta pixels não transparentes
	let nonTransparentPixels = 0;
	for (let i = 3; i < pixels.length; i += 4) {
		// Se o pixel alfa for maior que um limiar (por exemplo, 10)
		if (pixels[i] > 10) {
			nonTransparentPixels++;
		}
	}
	
	// Libera recursos
	canvas.remove();
	
	// Retorna true se houver pixels não transparentes significativos
	return nonTransparentPixels > (canvas.width * canvas.height * 0.01); // 1% de pixels não transparentes
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
		constructor(thickness = 1, color = 0x000000, alpha = 1) {
			super(vertexShader, fragmentShader);

			// Inicialize os uniforms
			this.uniforms.outlineColor = new Float32Array(4); // Para armazenar RGBA
			this.uniforms.outlineThickness = new Float32Array(2); // Para armazenar X e Y
			this.uniforms.filterArea = new Float32Array(2); // Para área de filtro
			this.uniforms.alpha = alpha;

			// Configure as propriedades iniciais
			this.color = color;
			this.thickness = thickness;
		}

		get alpha() {
			return this.uniforms.alpha;
		}
		set alpha(value) {
			this.uniforms.alpha = value;
		}

		get color() {
			return PIXI.utils.rgb2hex(this.uniforms.outlineColor);
		}
		set color(value) {
			PIXI.utils.hex2rgb(value, this.uniforms.outlineColor);
		}

		get thickness() {
			return this.uniforms.outlineThickness[0];
		}
		set thickness(value) {
			// Certifique-se de que filterArea tenha valores válidos
			const filterAreaX = this.uniforms.filterArea[0] || 1; // Evite divisão por 0
			const filterAreaY = this.uniforms.filterArea[1] || 1; // Evite divisão por 0
			
			this.uniforms.outlineThickness[0] = value / filterAreaX;
			this.uniforms.outlineThickness[1] = value / filterAreaY;
		}
	}

	// Adicione o isoOutlineFilter ao namespace PIXI.filters
	PIXI.filters.isoOutlineFilter = IsoOutlineFilter;
} else {
	console.error('PIXI ou PIXI.filters não estão disponíveis.');
}