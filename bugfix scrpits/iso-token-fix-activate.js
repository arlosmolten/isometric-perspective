const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn("Selecione um token primeiro.");
  return;
}

(async () => {
  const fx = await token.document.getFlag('isometric-perspective', 'offsetX');
  const fy = await token.document.getFlag('isometric-perspective', 'offsetY');
  const curX = Number.isFinite(Number(fx)) ? Number(fx) : 0;
  const curY = Number.isFinite(Number(fy)) ? Number(fy) : 0;

  new Dialog({
    title: "Ajustar Offset Isométrico",
    content: `
      <form>
        <div class="form-group">
          <label>Offset X:</label>
          <input type="number" name="offsetX" value="${curX}"/>
        </div>
        <div class="form-group">
          <label>Offset Y:</label>
          <input type="number" name="offsetY" value="${curY}"/>
        </div>
      </form>
    `,
    buttons: {
      aplicar: {
        label: "Aplicar",
        callback: async (html) => {
          const offsetX = Number(html.find('[name="offsetX"]').val());
          const offsetY = Number(html.find('[name="offsetY"]').val());
          await token.document.update({
            "flags.isometric-perspective.offsetX": offsetX,
            "flags.isometric-perspective.offsetY": offsetY
          });
          ui.notifications.info(`Offset aplicado: X=${offsetX}, Y=${offsetY}`);
        }
      },
      reset: {
        label: "Resetar",
        callback: async () => {
          await token.document.update({
            "flags.isometric-perspective.-=offsetX": null,
            "flags.isometric-perspective.-=offsetY": null
          });
          ui.notifications.info("Offsets removidos (usará padrão automático).");
        }
      },
      cancelar: { label: "Cancelar" }
    },
    default: 'aplicar'
  }).render(true);
})();