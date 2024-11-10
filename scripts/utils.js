import { MODULE_ID } from './main.js';

// Função auxiliar para converter coordenadas isométricas para cartesianas
export function isoToCartesian(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: (isoX * cosA - isoY * sinA),
    y: (isoX * sinA + isoY * cosA)
  };
}

// Função auxiliar para converter coordenadas cartesianas para isométricas
export function cartesianToIso2(cartX, cartY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (cartX * Math.cos(-angle) - cartY * Math.sin(-angle)),
    y: (cartX * Math.sin(-angle) + cartY * Math.cos(-angle))
  };
}

// Função auxiliar para calcular a menor diagonal do losango (distância vertical entre vértices)
export function calculateIsometricVerticalDistance(width, height) {
  // Em uma projeção isométrica com rotação de 45°, a distância vertical
  // entre os vértices é a altura do losango formado
  return Math.sqrt(2) * Math.min(width, height);
}

// Função utilitária para debounce
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Função utilitária para verificar se um objeto precisa ser atualizado
export function needsUpdate(oldData, newData, properties) {
  return properties.some(prop => {
    const oldValue = getNestedValue(oldData, prop);
    const newValue = getNestedValue(newData, prop);
    return oldValue !== newValue;
  });
}

// Função auxiliar para obter valores aninhados de um objeto
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, part) => current?.[part], obj);
}

// Função utilitária para logging consistente
export function log(message, type = 'info', data = null) {
  const isDebug = game.settings.get(MODULE_ID, "debug");
  if (!isDebug && type === 'debug') return;

  const prefix = `[${MODULE_ID}]`;
  
  switch (type) {
    case 'error':
      console.error(prefix, message, data);
      break;
    case 'warn':
      console.warn(prefix, message, data);
      break;
    case 'debug':
      console.debug(prefix, message, data);
      break;
    default:
      console.log(prefix, message, data);
  }
}

//Função utilitária para medição de performance
export function measurePerformance(label, func) {
  return async (...args) => {
    const start = performance.now();
    const result = await func(...args);
    const end = performance.now();
    log(`${label} took ${(end - start).toFixed(2)}ms`, 'debug');
    return result;
  };
}