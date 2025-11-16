// utils.js: pure math helpers - avoid runtime imports to ease unit testing

// Função auxiliar para converter coordenadas isométricas para cartesianas
export function isoToCartesian(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (isoX * Math.cos(angle) - isoY * Math.sin(angle)),
    y: (isoX * Math.sin(angle) + isoY * Math.cos(angle))
  };
}

// Função auxiliar para converter coordenadas cartesianas para isométricas
export function cartesianToIso(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (isoX * Math.cos(-angle) - isoY * Math.sin(-angle)),
    y: (isoX * Math.sin(-angle) + isoY * Math.cos(-angle))
  };
}

// Função auxiliar para calcular a menor diagonal do losango (distância vertical entre vértices)
export function calculateIsometricVerticalDistance(width, height) {
  // Em uma projeção isométrica com rotação de 45°, a distância vertical
  // entre os vértices é a altura do losango formado
  return Math.sqrt(2) * Math.min(width, height);
}

// Merge overlapping or adjacent rectangles (rect: {x, y, width, height})
export function mergeRectangles(rects) {
  if (!rects || rects.length === 0) return [];
  const merged = [];
  for (const r of rects) {
    let found = false;
    for (let i = 0; i < merged.length; i++) {
      const m = merged[i];
      // Check if rectangles intersect or are adjacent within 1 pixel
      if (!(r.x + r.width < m.x - 1 || r.x > m.x + m.width + 1 || r.y + r.height < m.y - 1 || r.y > m.y + m.height + 1)) {
        // Merge
        const x = Math.min(m.x, r.x);
        const y = Math.min(m.y, r.y);
        const right = Math.max(m.x + m.width, r.x + r.width);
        const bottom = Math.max(m.y + m.height, r.y + r.height);
        merged[i] = { x, y, width: right - x, height: bottom - y };
        found = true;
        break;
      }
    }
    if (!found) merged.push({ ...r });
  }
  return merged;
}