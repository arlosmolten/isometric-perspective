export class TransformationCache {
	constructor() {
	  this.cache = new Map();
	  this.maxEntries = 1000; // Limite máximo de entradas no cache
	}
 
	// Gera uma chave única para o cache baseada nas propriedades do objeto
	getKey(object, settings) {
	  if (!object?.document) return null;
 
	  const baseKey = `${object.id}_${object.document.x}_${object.document.y}`;
	  const elevationKey = `_elev${object.document.elevation || 0}`;
	  const scaleKey = `_scale${object.document.getFlag('isometric-perspective', 'scale') || 1}`;
	  const offsetKey = `_offset${object.document.getFlag('isometric-perspective', 'offsetX') || 0}_${
		 object.document.getFlag('isometric-perspective', 'offsetY') || 0}`;
	  
	  if (object instanceof Token) {
		 return `token_${baseKey}${elevationKey}${scaleKey}${offsetKey}`;
	  } else if (object instanceof Tile) {
		 const sizeKey = `_size${object.document.width}_${object.document.height}`;
		 return `tile_${baseKey}${sizeKey}${scaleKey}${offsetKey}`;
	  }
	  
	  return null;
	}
 
	// Recupera uma transformação do cache
	get(object, settings) {
	  const key = this.getKey(object, settings);
	  if (!key) return null;
 
	  const cached = this.cache.get(key);
	  if (!cached) return null;
 
	  // Verifica se o cache expirou (5 segundos)
	  if (Date.now() - cached.timestamp > 5000) {
		 this.cache.delete(key);
		 return null;
	  }
 
	  return cached.transform;
	}
 
	// Armazena uma transformação no cache
	set(object, settings, transform) {
	  const key = this.getKey(object, settings);
	  if (!key) return;
 
	  // Se o cache estiver cheio, remove as entradas mais antigas
	  if (this.cache.size >= this.maxEntries) {
		 const entriesToDelete = Math.floor(this.maxEntries * 0.2); // Remove 20% das entradas
		 const entries = Array.from(this.cache.entries())
			.sort((a, b) => a[1].timestamp - b[1].timestamp)
			.slice(0, entriesToDelete);
		 
		 entries.forEach(([key]) => this.cache.delete(key));
	  }
 
	  this.cache.set(key, {
		 transform: transform,
		 timestamp: Date.now()
	  });
	}
 
	// Invalida o cache para um objeto específico
	invalidate(object) {
	  if (!object?.id) return;
 
	  const prefix = object instanceof Token ? `token_${object.id}` : `tile_${object.id}`;
	  for (const key of this.cache.keys()) {
		 if (key.startsWith(prefix)) {
			this.cache.delete(key);
		 }
	  }
	}
 
	// Invalida o cache para uma cena específica
	invalidateScene(sceneId) {
	  if (!sceneId) return;
	  
	  for (const key of this.cache.keys()) {
		 if (key.includes(sceneId)) {
			this.cache.delete(key);
		 }
	  }
	}
 
	// Limpa todo o cache
	clear() {
	  this.cache.clear();
	}
 
	// Retorna estatísticas do cache
	getStats() {
	  return {
		 size: this.cache.size,
		 maxSize: this.maxEntries
	  };
	}
 }
 
 // Exporta uma única instância do cache
 export const transformationCache = new TransformationCache();