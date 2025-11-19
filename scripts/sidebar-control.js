import { openIsoSidebar } from './apps/sidebar-app.js';

export function registerSidebarControl() {
  Hooks.on('getSceneControlButtons', (controls) => {
    const tokenControls = resolveTokenControls(controls);
    const tool = buildIsoSidebarTool();

    if (tokenControls) {
      tokenControls.tools = tokenControls.tools || [];
      if (!tokenControls.tools.find((existing) => existing?.name === tool.name)) {
        tokenControls.tools.push(tool);
      }
      return;
    }

    addStandaloneControl(controls, tool);
  });
}

function buildIsoSidebarTool() {
  return {
    name: 'isometric-perspective-sidebar',
    title: game.i18n.localize('isometric-perspective.sidebar_tooltip'),
    icon: 'fas fa-cubes',
    button: true,
    visible: true,
    onClick: () => openIsoSidebar()
  };
}

function resolveTokenControls(controls) {
  if (Array.isArray(controls)) {
    return controls.find((control) => control?.name === 'token');
  }
  if (controls && typeof controls === 'object') {
    return controls.token || controls['token'] || null;
  }
  return null;
}

function addStandaloneControl(controls, tool) {
  if (Array.isArray(controls)) {
    controls.push({
      name: 'isometric-perspective',
      title: game.i18n.localize('isometric-perspective.sidebar_title'),
      icon: 'fas fa-cubes',
      layer: 'tokens',
      tools: [tool]
    });
    return;
  }

  controls['isometric-perspective'] = {
    name: 'isometric-perspective',
    title: game.i18n.localize('isometric-perspective.sidebar_title'),
    icon: 'fas fa-cubes',
    tools: [tool],
    layer: 'tokens'
  };
}
