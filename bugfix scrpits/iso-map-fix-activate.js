const current = canvas.scene.getFlag("isometric-perspective", "isometric") ?? false;
const enable = !current;

await canvas.scene.update({
  flags: {
    "isometric-perspective": {
      isometric: enable,
      isometricEnabled: enable,
      isometricBackground: enable,
      isometricScale: 1,
      projectionType: "True Isometric"
    }
  }
});

ui.notifications.info(`Isometric mode is ${enable ? "ON" : "OFF"}.`);