import { openIsoSidebar } from './apps/sidebar-app.js';

const STACK_ID = 'custom-sidebar-buttons';
const STACK_STYLE_ID = 'custom-sidebar-button-stack-style';
const BUTTON_ID = 'iso-sidebar-button';
const BUTTON_STYLE_ID = 'iso-sidebar-button-styles';
// Kept your legacy support
const LEGACY_STACKS = ['iso-sidebar-button-stack', 'ragnarok-sidebar-button-stack', 'crimson-blood-buttons'];

export function registerSidebarButton() {
  if (typeof window === 'undefined') return;

  // 1. ATTEMPT ATTACH
  const tryAttach = () => {
    try {
      return ensureSidebarButton();
    } catch (error) {
      console.warn('[isometric-perspective] Failed to render sidebar button', error);
      return false;
    }
  };

  // 2. OBSERVER LOGIC (Kept from your original file)
  let observer = null;
  const stopObserver = () => {
    if (!observer) return;
    try { observer.disconnect(); } catch (error) { /* ignore */ }
    observer = null;
  };

  const startObserver = () => {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(() => {
      // If we successfully attach, we don't necessarily stop,
      // because Foundry might re-render the sidebar and kill our button.
      // We keep observing but debounce slightly?
      // For safety, we just run tryAttach.
      tryAttach();
    });
    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      stopObserver();
    }
  };

  // 3. HOOKS - This was the missing piece.
  // 'renderSidebar' fires when the sidebar is fully redrawn.
  Hooks.on('renderSidebar', (app, html) => {
    tryAttach();
  });

  Hooks.once('ready', () => {
    tryAttach();
    startObserver();
  });

  Hooks.on('renderSidebarTab', tryAttach);
  Hooks.on('canvasReady', tryAttach);

  // Increased timeout to 60s, but relies more on Hooks now.
  setTimeout(() => stopObserver(), 60000);
}

function ensureSidebarButton() {
  if (typeof document === 'undefined') return false;

  const tabs = resolveSidebarTabs();
  if (!tabs) return false;

  // 1. Get the container
  const stack = getOrCreateStack(tabs);
  if (!stack) return false;

  // 2. Create or Find Button
  let button = document.getElementById(BUTTON_ID);
  if (!button) {
    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.classList.add('iso-sidebar-stack-button');

    const label = game.i18n.localize('isometric-perspective.sidebar_tooltip');
    button.title = label;
    button.setAttribute('aria-label', label);

    // Using innerHTML for the icon
    button.innerHTML = `<i class="fas fa-cubes" aria-hidden="true"></i>`;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add('active');
      setTimeout(() => button.classList.remove('active'), 200);
      void openIsoSidebar();
    });
  }

  // 3. Insert Button into Stack
  // If the button isn't the first child, move it there (or append if you prefer)
  if (stack.firstChild !== button) {
    stack.prepend(button);
  }

  // 4. Ensure CSS
  ensureStackStyles();
  ensureButtonStyles();

  return true;
}

function resolveSidebarTabs() {
  const sidebar = document.querySelector('#sidebar');
  return sidebar?.querySelector('#sidebar-tabs') ?? document.querySelector('#sidebar-tabs');
}

function getOrCreateStack(tabs) {
  if (!tabs) return null;

  // Try to find existing stack
  let stack = tabs.querySelector(`#${STACK_ID}`);

  // Check Legacy
  if (!stack) {
    for (const legacyId of LEGACY_STACKS) {
      const legacy = tabs.querySelector(`#${legacyId}`);
      if (legacy) {
        stack = legacy;
        // Update ID to modern standard if found?
        // No, keep it as is to avoid breaking legacy css, or just use it.
        // We will just use it as the stack.
        break;
      }
    }
  }

  // Create if missing
  if (!stack) {
    stack = document.createElement('div');
    stack.id = STACK_ID;
    // Added z-index and flex-shrink to prevent it from being hidden or crushed
    stack.style.cssText = `
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 4px !important;
      padding: 4px 0 !important;
      pointer-events: auto !important;
      width: 52px !important;
      flex: 0 0 auto !important;
      z-index: 10 !important;
    `;

    // Insertion Logic:
    // We try to put it AFTER the settings tab, or at the very end.
    const settingsTab = tabs.querySelector('.item[data-tab="settings"]');
    const collapseBtn = tabs.querySelector('.collapse'); // The collapse arrow

    if (settingsTab) {
      settingsTab.insertAdjacentElement('afterend', stack);
    } else if (collapseBtn) {
      // If no settings tab (unlikely), put it before the collapse arrow
      collapseBtn.before(stack);
    } else {
      tabs.appendChild(stack);
    }
  }

  // Legacy Cleanup (Runar/Deck buttons)
  const orphanContainers = ['#runar-buttons', '#deck-buttons'];
  for (const selector of orphanContainers) {
    const container = tabs.querySelector(selector);
    if (container && container !== stack) {
      while (container.firstChild) stack.appendChild(container.firstChild);
      container.remove();
    }
  }

  return stack;
}

function ensureStackStyles() {
  if (document.getElementById(STACK_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STACK_STYLE_ID;
  style.textContent = `
    #${STACK_ID} {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 4px 0 !important;
      pointer-events: auto !important;
      width: 50px !important;
      margin-top: 5px;
    }
    /* Ensure flex container allows it to sit nicely */
    #sidebar-tabs {
        flex-wrap: wrap;
    }
  `;
  document.head?.appendChild(style);
}

function ensureButtonStyles() {
  if (document.getElementById(BUTTON_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BUTTON_STYLE_ID;
  style.textContent = `
    .iso-sidebar-stack-button {
      width: 42px;
      height: 42px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.65);
      color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
      font-size: 1.2rem; /* Slightly larger icon */
      line-height: 1;
      padding: 0;
      margin: 0;
    }
    .iso-sidebar-stack-button:hover,
    .iso-sidebar-stack-button.active {
      border-color: rgba(255, 255, 255, 0.9);
      background: rgba(50, 50, 50, 0.8);
      transform: translateY(-1px);
      box-shadow: 0 0 5px rgba(255,255,255,0.3);
    }
    .iso-sidebar-stack-button i {
        margin: 0;
    }
  `;
  document.head?.appendChild(style);
}