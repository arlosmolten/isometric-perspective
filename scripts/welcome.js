const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
import { isometricModuleConfig } from './consts.js';

// Welcome Message Setup
export class WelcomeScreen extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: ["welcome-screen"],
    position:{
      width: 600,
      height: 620,
    },
    window:{
      resizable: false,
      title: "isometric-perspective.title"
    }
  }

  static PARTS = {
    div: {
      template: "modules/isometric-perspective/templates/welcome.hbs",
    }
  }
}

export function addWelcomeScreen(){
    if (game.settings.get(isometricModuleConfig.MODULE_ID, "showWelcome")) {
        const welcome = new WelcomeScreen();
        welcome.render(true);
    }
}