// Debounce via requestAnimationFrame para o HUD
let _hudRAF = null;
let _hudArgs = null;

function scheduleHUDReposition(hud, html) {
  _hudArgs = { hud, html };
  if (_hudRAF != null) return;
  _hudRAF = requestAnimationFrame(() => {
    const args = _hudArgs; _hudArgs = null; _hudRAF = null;
    if (args) {
      adjustHUDPosition(args.hud, args.html);
    }
  });
}

// Alinha o #hud ao (0,0) do mundo após a transformação isométrica
function alignHudToStage() {
  try {
    const hud = document.getElementById('hud');
    if (!hud || !window.PIXI || !canvas?.stage) return;
    const wt = canvas.stage.worldTransform; // PIXI.Matrix
    // Posição de tela do ponto (0,0) do mundo
    const origin = wt.apply(new PIXI.Point(0, 0));
    const parent = hud.offsetParent || hud.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();
    // Converter screen -> coords locais do offsetParent
    const localX = origin.x - parentRect.left;
    const localY = origin.y - parentRect.top;
    // Aplicar sem mexer no scale (Foundry já define)
    hud.style.position = 'absolute';
    hud.style.transformOrigin = '0 0';
    hud.style.left = `${localX}px`;
    hud.style.top = `${localY}px`;
  } catch (e) {
    /* noop */
  }
}

// Feature flag: alinhamento do #hud ao estágio (desativado por padrão)
const ENABLE_ALIGN_HUD = false;
// Hooks para manter #hud alinhado ao pan/zoom/isometria
if (ENABLE_ALIGN_HUD) {
  Hooks.on('canvasReady', () => requestAnimationFrame(alignHudToStage));
  Hooks.on('canvasPan', () => requestAnimationFrame(alignHudToStage));
  if (canvas?.app?.renderer) {
    canvas.app.renderer.on('resize', () => requestAnimationFrame(alignHudToStage));
  }
}

import { MODULE_ID, DEBUG_PRINT, WORLD_ISO_FLAG } from './main.js';
// Offset extra vertical do Token HUD (px). Mantido em 0 por padrão.
// Caso precise, podemos expor como setting de módulo.
const TOKEN_HUD_Y_OFFSET = 0;
import { ISOMETRIC_CONST, PROJECTION_TYPES, DEFAULT_PROJECTION } from './consts.js';

// Calcula o delta entre a origem do mundo (0,0) na tela e o topo-esquerdo do #hud
function computeHudDelta() {
  try {
    const hud = document.getElementById('hud');
    if (!hud || !window.PIXI || !canvas?.stage) return { dx: 0, dy: 0 };
    const wt = canvas.stage.worldTransform;
    const origin = wt.apply(new PIXI.Point(0, 0));
    const hudRect = hud.getBoundingClientRect();
    // delta > 0 significa que o #hud está mais à direita/baixo do que a origem do mundo
    return { dx: hudRect.left - origin.x, dy: hudRect.top - origin.y };
  } catch { return { dx: 0, dy: 0 }; }
}

export function registerHUDConfig() {
  Hooks.on("renderTokenHUD", handleRenderTokenHUD);
  Hooks.on("renderTileHUD", handleRenderTileHUD);
  // Corrigir posicionamento da caixa da régua (measurement box)
  setupMeasurementObserver();
}

function handleRenderTokenHUD(hud, html, data) {
  // Posiciona o HUD de forma determinística na tela, independente do zoom/pan
  try {
    // Agendar após o render (via rAF) para garantir que o elemento esteja no DOM
    scheduleHUDReposition(hud, html);

    // Reajusta ao movimentar/panar/zoomar
    const rebinder = () => scheduleHUDReposition(hud, html);
    canvas.stage.off("pointerup", rebinder).on("pointerup", rebinder);
    canvas.app.renderer.off("resize", rebinder).on("resize", rebinder);
    Hooks.off("canvasPan", rebinder);
    Hooks.on("canvasPan", rebinder);
  } catch (e) {
    console.error("[Isometric Perspective] TokenHUD position error:", e);
  }
}

function handleRenderTileHUD(hud, html, data) {
  try {
    scheduleHUDReposition(hud, html);

    const rebinder = () => scheduleHUDReposition(hud, html);
    canvas.stage.off("pointerup", rebinder).on("pointerup", rebinder);
    canvas.app.renderer.off("resize", rebinder).on("resize", rebinder);
    Hooks.off("canvasPan", rebinder);
    Hooks.on("canvasPan", rebinder);
  } catch (e) {
    console.error("[Isometric Perspective] TileHUD position error:", e);
  }
}


// Observa o contêiner de medições do Foundry e reposiciona caixas/labels
function setupMeasurementObserver() {
  let container = document.getElementById('measurement');
  if (!container) { /* fallback via body */ }

  // Tenta obter o Ruler ativo (best-effort; totalmente defensivo)
  const getActiveRuler = () => {
    try {
      const candidates = [
        canvas?.controls?.ruler,
        ui?.ruler,
        game?.mouse?.measurement, // em algumas versões
        canvas?.hud?.ruler,
        canvas?.tokens?.ruler,
      ];
      for (const r of candidates) {
        if (r && typeof r === 'object') return r;
      }
    } catch {}
    return null;
  };

  // Resolve o waypoint associado a um elemento de label (por índice no container .waypoint-label)
  const resolveWaypointForElement = (el) => {
    try {
      const wpContainer = el.closest?.('.waypoint-label');
      if (!wpContainer) return { waypoint: null, index: -1 };
      let idx = Number.NaN;
      const ds = wpContainer.dataset || {};
      if (ds.index != null) idx = parseInt(ds.index, 10);
      if (Number.isNaN(idx)) {
        const m = (wpContainer.className || '').toString().match(/waypoint-(\d+)/);
        if (m) idx = parseInt(m[1], 10);
      }
      if (Number.isNaN(idx)) {
        // fallback: posição entre irmãos
        const siblings = Array.from(wpContainer.parentElement?.querySelectorAll?.('.waypoint-label') || []);
        idx = siblings.indexOf(wpContainer);
      }
      const ruler = getActiveRuler();
      const list = ruler?.waypoints || ruler?.state?.waypoints || ruler?.path || [];
      const waypoint = Array.isArray(list) && idx >= 0 && idx < list.length ? list[idx] : null;
      return { waypoint, index: Number.isFinite(idx) ? idx : -1 };
    } catch {
      return { waypoint: null, index: -1 };
    }
  };

  // Core de reposicionamento para um único elemento
  const doFix = (el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.id === 'measurement') return; // não processe o container em si
    const cls = (el.className || '').toString();
    // Mirar nós singulares e, como fallback, os contêineres "...-labels"
    const isSingular = /(?:\bruler-label\b|\btoken-ruler-label\b|\bdistance-rule-label\b|\btotal-measurement\b)/i.test(cls);
    const isContainer = /(\bruler-labels\b|\bdistance-ruler-labels\b|\btoken-ruler-labels\b)/i.test(cls);
    const inContainer = !!el.closest?.('.ruler-labels, .token-ruler-labels, .distance-ruler-labels');
    const looksLikeLabel = isSingular || (inContainer && !isContainer);
    if (!looksLikeLabel) return;
    // Ignorar e ocultar o ícone da régua (Font Awesome) que sobrepõe o texto
    if ((el.tagName === 'I' || /\bicon\b/i.test(cls) || /\bfa-/.test(cls)) && /\bfa-ruler\b/i.test(cls)) {
      try { el.style.display = 'none'; } catch {}
      return;
    }
    // Não toque no container de waypoint; só processe o span interno total-measurement
    if (/\bwaypoint-label\b/i.test(cls) && !/\btotal-measurement\b/i.test(cls)) return;
    // ignorar imagens/decorativos (e ocultar o ícone/"img" dentro de waypoint)
    if (/\bimg\b/.test(cls)) { try { el.style.display = 'none'; } catch {}; return; }
    // NÃO reposicionar contêineres
    if (isContainer) { return; }
    const csEl = window.getComputedStyle(el);
    // Ignore labels ocultas
    if (/hidden/.test(cls) || csEl?.display === 'none' || csEl?.visibility === 'hidden') return;
    // Alguns elementos internos podem não ser labels; prossiga apenas se tiver left/top explicitados
    let left = parseFloat(el.style.left);
    let top = parseFloat(el.style.top);
    const csLeft = parseFloat(csEl.left);
    const csTop = parseFloat(csEl.top);
    const csTransform = csEl.transform || 'none';
    // Fallback para computed style quando inline está ausente
    if ((Number.isNaN(left) || Number.isNaN(top)) && Number.isFinite(csLeft) && Number.isFinite(csTop)) {
      left = csLeft; top = csTop;
    }
    // Alguns temas/módulos posicionam via transform: translate(...)
    if (Number.isNaN(left) || Number.isNaN(top)) {
      const tr = el.style.transform || '';
      const m = tr.match(/translate(?:3d)?\(([-0-9.]+)px\s*,\s*([-0-9.]+)px/);
      if (m) {
        left = parseFloat(m[1]);
        top = parseFloat(m[2]);
      }
    }
    // fallback para computed (alguns temas definem via CSS)
    if (Number.isNaN(left)) left = csLeft;
    if (Number.isNaN(top)) top = csTop;
    // Se ainda sem coordenadas, derive da posição real na tela (bounding rect)
    let fallbackRect = null;
    if (Number.isNaN(left) || Number.isNaN(top)) {
      fallbackRect = el.getBoundingClientRect();
      if (fallbackRect && fallbackRect.width >= 0) {
        // Usar o centro do elemento como referência de ancoragem
        left = fallbackRect.left + fallbackRect.width / 2;
        top  = fallbackRect.top + fallbackRect.height; // base inferior para ancoragem da label
      }
    }

    const hud = document.getElementById('hud');
    const insideHud = !!(hud && el.closest('#hud'));

    // Determina escala CSS do HUD (matrix(a,b,c,d,tx,ty) => a/d ~ scaleX/scaleY)
    let hudScaleX = 1, hudScaleY = 1;
    if (insideHud) {
      const cs = window.getComputedStyle(hud);
      const m = cs.transform && cs.transform !== 'none' ? cs.transform : '';
      // Expect "matrix(a, b, c, d, tx, ty)" ou "matrix3d(...)"
      const match2d = m.match(/^matrix\(([-0-9.,\s]+)\)$/);
      if (match2d) {
        const parts = match2d[1].split(',').map(v => parseFloat(v.trim()));
        const a = parts[0], d = parts[3];
        hudScaleX = Math.abs(a) || 1; hudScaleY = Math.abs(d) || 1;
      }
      const match3d = m.match(/^matrix3d\(([-0-9.,\s]+)\)$/);
      if (match3d) {
        const p = match3d[1].split(',').map(v => parseFloat(v.trim()));
        const sx = Math.hypot(p[0], p[1], p[2]);
        const sy = Math.hypot(p[4], p[5], p[6]);
        hudScaleX = sx || hudScaleX; hudScaleY = sy || hudScaleY;
      }
    }

    // Determine em qual espaço o elemento está
    const insideMeasurement = !!el.closest('#measurement');
    // Corrigir deslocamento global do HUD apenas para nós dentro do HUD
    const delta = computeHudDelta();
    let screen;
    let screenIsViewport = false; // true quando coordenadas já estão em espaço de viewport
    let usedWaypoint = false;
    let waypointIndex = -1;
    let isTokenMoveLabel = false;
    if (insideMeasurement) {
      // Se for um label de waypoint, prefira o x/y do waypoint (mundo) -> tela
      const { waypoint, index } = resolveWaypointForElement(el);
      waypointIndex = index;
      if (waypoint && Number.isFinite(waypoint.x) && Number.isFinite(waypoint.y)) {
        const s = canvas.stage.worldTransform.apply(new PIXI.Point(waypoint.x, waypoint.y));
        screen = { x: s.x, y: s.y };
        usedWaypoint = true;
      } else {
        // Valores de left/top já são coordenadas de tela do container de medição
        screen = { x: left, y: top };
        screenIsViewport = true;
      }

      // Caso especial: labels de movimento do token devem ancorar no token (bottom-center)
      try {
        const tokenLabelsContainer = el.closest('.token-ruler-labels');
        if (tokenLabelsContainer && tokenLabelsContainer.id && tokenLabelsContainer.id.startsWith('token-ruler-')) {
          const tokenId = tokenLabelsContainer.id.slice('token-ruler-'.length);
          const token = canvas?.tokens?.get?.(tokenId) || canvas?.tokens?.placeables?.find?.(t => t.id === tokenId);
          if (token) {
            const display = token.mesh ?? token.icon ?? token;
            const b = (display && display.getBounds) ? display.getBounds() : null;
            if (b) {
              screen.x = b.x + b.width / 2;
              screen.y = b.y + b.height; // bottom-center
              usedWaypoint = false; // vamos centralizar abaixo do token
              isTokenMoveLabel = true;
              screenIsViewport = true; // bounds já estão em coords de viewport
            } else {
              // fallback: worldTransform do centro
              const world = token.center || token.document?.center || token;
              const s2 = canvas.stage.worldTransform.apply(new PIXI.Point(world.x, world.y));
              screen.x = s2.x; screen.y = s2.y;
              isTokenMoveLabel = true;
            }
          }
        }
      } catch {}
    } else if (insideHud) {
      // Nó no HUD: ajustar pelo delta do HUD
      screen = { x: left - delta.dx, y: top - delta.dy };
      screenIsViewport = true; // HUD é sempre em viewport
    } else {
      // Nó em espaço de mundo: converter mundo->tela
      const world = new PIXI.Point(left, top);
      const s = canvas.stage.worldTransform.apply(world);
      screen = { x: s.x, y: s.y };
    }
    // offsetParent chain for debugging
    const chain = [];
    let p = el.offsetParent;
    while (p) { chain.push({ tag: p.tagName, id: p.id, class: p.className }); p = p.offsetParent; }
    

    // Se for label de waypoint, aplicar deslocamento perpendicular à linha medida para evitar sobreposição
    if (!isTokenMoveLabel && insideMeasurement && usedWaypoint && waypointIndex >= 0) {
      try {
        const ruler = getActiveRuler();
        const list = ruler?.waypoints || ruler?.state?.waypoints || ruler?.path || [];
        const curr = list[waypointIndex];
        const prev = list[waypointIndex - 1];
        const next = list[waypointIndex + 1];
        const valid = (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y);
        if (valid(curr)) {
          const toScreen = (pt) => canvas.stage.worldTransform.apply(new PIXI.Point(pt.x, pt.y));
          const sCurr = toScreen(curr);
          let baseA = null, baseB = null;
          if (valid(prev)) { baseA = toScreen(prev); baseB = sCurr; }
          else if (valid(next)) { baseA = sCurr; baseB = toScreen(next); }

          let dirX = 0, dirY = -1; // fallback: para cima
          let tanX = 1, tanY = 0;  // fallback: eixo x
          if (baseA && baseB) {
            const dx = baseB.x - baseA.x;
            const dy = baseB.y - baseA.y;
            const len = Math.hypot(dx, dy) || 1;
            tanX = dx / len; tanY = dy / len;          // tangente do segmento
            dirX = -tanY; dirY = tanX;                 // normal à direita
          }
          // Escalonar afastamento pela altura do label para evitar cruzar o texto
          let labelH = 0;
          try { const r = el.getBoundingClientRect(); labelH = (r && r.height) ? r.height : 0; } catch {}
          const nOffset = Math.max(18, (labelH / 2) + 10); // separação perpendicular mais forte
          const tOffset = 12;  // afastar do ponto ao longo da linha
          screen.x = sCurr.x + dirX * nOffset + tanX * tOffset;
          screen.y = sCurr.y + dirY * nOffset + tanY * tOffset;
        }
      } catch (e) {
        console.warn('[Isometric Perspective] waypoint normal offset failed', e);
      }
    } else if (!isTokenMoveLabel && insideMeasurement) {
      // Tentar deslocar com base no último segmento ativo (p/ total-measurement ou labels genéricos)
      try {
        const ruler = getActiveRuler();
        const list = ruler?.waypoints || ruler?.state?.waypoints || ruler?.path || [];
        const valid = (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y);
        // encontrar os dois últimos pontos válidos
        let a = null, b = null;
        for (let i = list.length - 1; i >= 1; i--) {
          if (valid(list[i]) && valid(list[i-1])) { b = list[i]; a = list[i-1]; break; }
        }
        if (a && b) {
          const toScreen = (pt) => canvas.stage.worldTransform.apply(new PIXI.Point(pt.x, pt.y));
          const sA = toScreen(a); const sB = toScreen(b);
          const dx = sB.x - sA.x; const dy = sB.y - sA.y; const len = Math.hypot(dx, dy) || 1;
          const tanX = dx / len, tanY = dy / len;
          const dirX = -tanY, dirY = tanX; // normal à direita
          let labelH = 0; try { const r = el.getBoundingClientRect(); labelH = (r && r.height) ? r.height : 0; } catch {}
          const nOffset = Math.max(20, (labelH / 2) + 12);
          const tOffset = 14;
          // usar a posição de tela previamente calculada como base
          screen.x += dirX * nOffset + tanX * tOffset;
          screen.y += dirY * nOffset + tanY * tOffset;
        }
      } catch (e) { /* noop */ }
    }

    // Converter screen -> coordenadas locais do offsetParent (mesma lógica do Token HUD)
    let ref = el.offsetParent || el.parentElement || document.body;
    const refRect = ref.getBoundingClientRect();
    const scaleX = ref.offsetWidth ? (refRect.width / ref.offsetWidth) : 1;
    const scaleY = ref.offsetHeight ? (refRect.height / ref.offsetHeight) : 1;
    const anchorIsMeasurement = !!(ref && ref.id === 'measurement');
    // Sanity guards: evite números absurdos
    const MAX_PIX = 100000; // 100k px como limite razoável
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y) || Math.abs(screen.x) > MAX_PIX || Math.abs(screen.y) > MAX_PIX) {
      console.warn('[Isometric Perspective] Abort label reposition (insane screen coords)', { screenX: screen.x, screenY: screen.y, cls });
      return;
    }
    // Converter para coordenadas de viewport e depois para o espaço local do offsetParent
    let viewX = screen.x;
    let viewY = screen.y;
    if (!screenIsViewport) {
      try {
        const cRect = canvas.app.view.getBoundingClientRect();
        viewX = cRect.left + screen.x;
        viewY = cRect.top + screen.y;
      } catch {}
    }
    const useFixed = false;
    const localX = (viewX - refRect.left) / (scaleX || 1);
    let localY = (viewY - refRect.top) / (scaleY || 1);
    

    // Deslocamento adicional sutil (fallback ou afinamento fino)
    // Y offset para manter diretamente abaixo do token (sem deslocamento extra)
    const extraYOffset = isTokenMoveLabel ? 4 : 0; // leve empurrão p/ baixo
    // Aplicar com alta precedência para não ser sobrescrito por tema/Foundry
    if (insideMeasurement && el.style && typeof el.style.setProperty === 'function') {
      el.style.setProperty('left', `${localX}px`, 'important');
      el.style.setProperty('top', `${localY + extraYOffset}px`, 'important');
      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('z-index', '10000', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    } else {
      el.style.left = `${localX}px`;
      el.style.top = `${localY + extraYOffset}px`;
      el.style.position = 'absolute';
    }
    const existing = el.style.transform || '';
    // Para labels de medição, centralize no ponto calculado e não dependa de transform prévio do tema
    if (insideMeasurement) {
      const tr = isTokenMoveLabel ? 'translate(-50%, 0)' : 'translate(-50%, -50%)';
      if (typeof el.style.setProperty === 'function') el.style.setProperty('transform', tr, 'important');
      else el.style.transform = tr;
    } else {
      if (!/translate\(/.test(existing)) {
        el.style.transform = `${existing} translate(-50%, 0)` .trim();
      }
    }
    // Manter número e unidade na mesma linha e permitir largura suficiente
    try {
      el.style.whiteSpace = 'nowrap';
      el.style.width = 'auto';
      el.style.maxWidth = 'none';
      el.style.minWidth = '0';
      el.style.display = 'inline-block';
    } catch {}
    
  };

  // Debounce via requestAnimationFrame para labels
  let labelsRAF = null;
  const pending = new Set();
  const scheduleLabel = (el) => {
    if (el) pending.add(el);
    if (labelsRAF != null) return;
    labelsRAF = requestAnimationFrame(() => {
      const items = Array.from(pending); pending.clear(); labelsRAF = null;
      for (const it of items) doFix(it);
    });
  };

  // Aplica ao carregar os já existentes (agendado) — selecione only labels
  const rootA = container || document.body;
  const labelSel = [
    '.ruler-label:not(.ruler-labels):not([class*="ruler-labels"])',
    '.token-ruler-label:not(.ruler-labels):not([class*="ruler-labels"])',
    '.distance-ruler-label:not(.ruler-labels):not([class*="ruler-labels"])',
    '.waypoint-label',
    '.total-measurement',
    // fallback para contêineres quando o Foundry ainda não criou nodos singulares
    '.ruler-labels',
    '.token-ruler-labels',
    '.distance-ruler-labels',
    // filhos internos dentro dos contêineres (labels reais podem estar aninhadas)
    '.ruler-labels *',
    '.token-ruler-labels *',
    '.distance-ruler-labels *',
    '.ruler .label',
    '.ruler .ruler-text',
    '.ruler .ruler-distance'
  ].join(', ');
  const initialNodes = rootA.querySelectorAll(labelSel);
  
  Array.from(initialNodes).forEach(scheduleLabel);

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes?.forEach(n => {
        if (n.nodeType === 1) {
          if (n.matches?.(labelSel)) scheduleLabel(n);
          n.querySelectorAll?.(labelSel).forEach(scheduleLabel);
        }
      });
      if (m.type === 'attributes' && (m.attributeName === 'style')) {
        const t = m.target;
        if (t.matches?.(labelSel)) scheduleLabel(t);
      }
    }
  });
  const rootB = container || document.body;
  obs.observe(rootB, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
}

// Utilitário: extrai scaleX/Y de um transform CSS
function parseScaleFromTransform(transform) {
  if (!transform || transform === 'none') return { sx: 1, sy: 1 };
  const m2d = transform.match(/^matrix\(([-0-9.,\s]+)\)$/);
  if (m2d) {
    const parts = m2d[1].split(',').map(v => parseFloat(v.trim()));
    return { sx: Math.abs(parts[0]) || 1, sy: Math.abs(parts[3]) || 1 };
  }
  const m3d = transform.match(/^matrix3d\(([-0-9.,\s]+)\)$/);
  if (m3d) {
    const p = m3d[1].split(',').map(v => parseFloat(v.trim()));
    const sx = Math.hypot(p[0], p[1], p[2]) || 1;
    const sy = Math.hypot(p[4], p[5], p[6]) || 1;
    return { sx, sy };
  }
  return { sx: 1, sy: 1 };
}

// debug logger removido
// Function to calculate the isometric position, it is like an isoToCartesian
export function calculateIsometricPosition(x, y) {
  // Get rotation values
  const rotation = ISOMETRIC_CONST.HudAngle; //ISOMETRIC_CONST.rotation;  // in rad

  // Apply rotation to the distorted coordinates
  const isoX =        (x + y) * Math.cos(rotation); // Aplique rotação ao eixo X
  const isoY = (-1) * (x - y) * Math.sin(rotation); // Aplique rotação ao eixo Y

  return { x: isoX, y: isoY };
}

export function adjustHUDPosition(hud, html) {
    const object = hud.object;
    if (!object?.document) return;

    // Step 1: Get the token's center in world coordinates.
    const worldPosition = object.center;

    // Preferir os bounds reais do display (coordenadas de tela em PIXI)
    let screenX, screenY;
    try {
      const display = object.mesh ?? object.icon ?? object;
      const b = (display && display.getBounds) ? display.getBounds() : null;
      if (b) {
        // Âncora para o HUD: centro visual do token
        screenX = b.x + b.width / 2;
        screenY = b.y + b.height / 2;
        
      }
    } catch (e) {
      /* noop */
    }

    if (screenX === undefined || screenY === undefined) {
      // Fallback: usar worldTransform + canvas rect
      const canvasPosition = canvas.stage.worldTransform.apply(worldPosition);
      const canvasRect = canvas.app.view.getBoundingClientRect();

      screenX = canvasRect.left + canvasPosition.x;
      screenY = canvasRect.top + canvasPosition.y;
    }
    

    // Converta para o sistema de coordenadas do offsetParent (pai pode ter transform/scale)
    const $el = (window.jQuery && html instanceof jQuery) ? html : (window.jQuery ? window.jQuery(html) : null);
    const el = $el ? $el[0] : (html instanceof Element ? html : (hud?.element ? hud.element[0] : null));
    if (!el) {
      console.warn('[Isometric Perspective] HUD element not found to position');
      return;
    }
    

    // offsetParent é o contêiner usado para posicionamento absoluto
    const parent = el.offsetParent || el.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();

    // Detectar escala CSS do pai (quando há transform: scale(...))
    const scaleX = parent.offsetWidth ? (parentRect.width / parent.offsetWidth) : 1;
    const scaleY = parent.offsetHeight ? (parentRect.height / parent.offsetHeight) : 1;
    

    // Converte coordenadas de tela (viewport) para o espaço do pai
    const localX = (screenX - parentRect.left) / (scaleX || 1);
    const localY = ((screenY - parentRect.top) / (scaleY || 1)) + TOKEN_HUD_Y_OFFSET;
    

    const styles = {
        left: `${localX}px`,
        top: `${localY}px`,
        // Centraliza o HUD ao redor do ponto âncora (centro do token)
        transform: 'translate(-50%, -50%)',
        position: 'absolute',
        margin: 0
    };

    if ($el && typeof $el.css === 'function') {
        $el.css(styles);
    } else if (el && el.style) {
        el.style.left = styles.left;
        el.style.top = styles.top;
        el.style.transform = styles.transform;
        el.style.position = styles.position;
        el.style.margin = styles.margin;
    } else if (hud?.element && typeof hud.element.css === 'function') {
        hud.element.css(styles);
    } else {
        console.warn('[Isometric Perspective] Unable to apply HUD CSS; unknown html type', html);
    }
}



/*
// Função para calcular a posição isométrica
export function calculateIsometricPosition_not(x, y) {
  // Obter valores de rotação e skew
  const rotation = ISOMETRIC_CONST.HudAngle; //ISOMETRIC_CONST.rotation;  // em graus
  const skewX = 0;//ISOMETRIC_CONST.skewX;       // em graus
  const skewY = 0;//ISOMETRIC_CONST.skewY;       // em graus

  // Converter ângulos de graus para radianos
  const rotationRad = rotation * (Math.PI / 180);
  const skewXRad = skewX * (Math.PI / 180);
  const skewYRad = skewY * (Math.PI / 180);

  // 1. Aplicar distorções de skew
  const skewedX = x + y * Math.tan(skewXRad);  // Distorção no eixo X devido ao skewX
  const skewedY = y + x * Math.tan(skewYRad);  // Distorção no eixo Y devido ao skewY

  // 2. Aplicar rotação nas coordenadas distorcidas
  const isoX =        (skewedX + skewedY) * Math.cos(rotationRad);   // Aplique rotação ao eixo X
  const isoY = (-1) * (skewedX - skewedY) * Math.sin(rotationRad); // Aplique rotação ao eixo Y

  // Retornar a posição isométrica calculada
  return { x: isoX, y: isoY };
}

function isometricToCartesianGPT(x_iso, y_iso) {
  // Extrair os parâmetros de transformação
  const rotation = Math.abs(ISOMETRIC_CONST.rotation);
  const skewX = Math.abs(ISOMETRIC_CONST.skewX);
  const skewY = Math.abs(ISOMETRIC_CONST.skewY);
  
  // Cria uma matriz de transformação com base nas rotações e distorções fornecidas
  // Criando um objeto "dummy" para aplicar a transformação
  const obj = new PIXI.Graphics();
  console.log("obj", obj);

  // Aplica a transformação com setTransform
  obj.setTransform(x_iso, y_iso, 0, 0, 1, 1, -rotation, skewX, skewY);

  // A matriz de transformação do objeto agora contém rotação e skew
  const matrix = obj.transform.worldTransform;

  // Inverter a matriz para reverter a transformação
  const invertedMatrix = matrix.invert();
  console.log(matrix);
  console.log(invertedMatrix);

  // Aplicar a inversa da matriz nas coordenadas isométricas
  const cartesian = invertedMatrix.apply({ x: x_iso, y: y_iso });

  return { x: cartesian.x, y: cartesian.y };
}

function isometricToCartesian(isoX, isoY) {
  // Definir parâmetros de transformação
  const rotation = ISOMETRIC_CONST.rotation;
  const skewX = -ISOMETRIC_CONST.skewX;
  const skewY = -ISOMETRIC_CONST.skewY;
  
  // Etapa 1: Reverter a rotação
  const unrotatedX = isoX * Math.cos(rotation) - isoY * Math.sin(rotation);
  const unrotatedY = isoX * Math.sin(rotation) + isoY * Math.cos(rotation);

  // Etapa 2: Reverter o skew em X
  const unskewedX = unrotatedX - unrotatedY * Math.tan(skewX);

  // Etapa 3: Reverter o skew em Y
  const cartesianY = unrotatedY - unskewedX * Math.tan(skewY);
  const cartesianX = unskewedX;

  return { x: cartesianX, y: cartesianY };
}

function isometricToCartesianGPT4o(x, y) {
  const angle = 30; //ISOMETRIC_CONST.rotation;
  const skewX = ISOMETRIC_CONST.skewX;
  const skewY = ISOMETRIC_CONST.skewY;
  const scale = 1; //-ISOMETRIC_CONST.ratio;
  
  // Ajuste de escala
  let adjustedX = x * scale;
  let adjustedY = y * scale;

  // Cálculo dos valores da matriz composta T (com rotação + skewX + skewY)
  const cosTheta = Math.cos(angle);
  const sinTheta = Math.sin(angle);

  // Componentes da matriz composta T
  const a = cosTheta + sinTheta * skewY;
  const b = cosTheta * skewX + sinTheta;
  const c = -sinTheta + cosTheta * skewY;
  const d = -sinTheta * skewX + cosTheta;

  // Determinante de T
  const detT = a * d - b * c;

  if (detT === 0) {
      throw new Error("A matriz de transformação não é invertível");
  }

  // Inversão da matriz T^-1
  const invDetT = 1 / detT;

  // Matrizes inversas
  const a_inv = d * invDetT;
  const b_inv = -b * invDetT;
  const c_inv = -c * invDetT;
  const d_inv = a * invDetT;

  // Aplicando a matriz inversa para encontrar as coordenadas cartesianas
  let cartesianX = a_inv * adjustedX + b_inv * adjustedY;
  let cartesianY = c_inv * adjustedX + d_inv * adjustedY;

  // Retornar as coordenadas cartesianas
  return { x: cartesianX, y: cartesianY };
}
*/