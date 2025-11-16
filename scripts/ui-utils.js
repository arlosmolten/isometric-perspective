// Utility UI helpers for the Isometric Perspective module

/**
 * Create an adjustable button to tweak inputs by dragging.
 * Returns an array of cleanup functions: [removeDownListener, removeWindowListeners]
 */
export function createAdjustableButton(options) {
  const {
    container,
    buttonSelector,
    inputs,
    adjustmentScale = 0.2,
    valueConstraints = null,
    roundingPrecision = 0
  } = options;

  const adjustButton = container.querySelector(buttonSelector);
  if (!adjustButton) return [];

  Object.assign(adjustButton.style, {
    width: '30px',
    cursor: 'pointer',
    padding: '1px 5px',
    border: '1px solid #888',
    borderRadius: '3px'
  });

  let isAdjusting = false;
  let startX = 0;
  let startY = 0;
  let originalValues = [0, 0];

  const applyAdjustment = (e) => {
    if (!isAdjusting) return;
    const deltaY = e.clientX - startX;
    const deltaX = startY - e.clientY;
    const adjustments = [deltaX * adjustmentScale, deltaY * adjustmentScale];

    inputs.forEach((input, index) => {
      let newValue = originalValues[index] + adjustments[index];
      if (valueConstraints) {
        newValue = Math.max(valueConstraints.min, Math.min(valueConstraints.max, newValue));
      }
      newValue = Math.round(newValue * Math.pow(10, roundingPrecision)) / Math.pow(10, roundingPrecision);
      input.value = newValue.toFixed(roundingPrecision);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  function onMove(e) { applyAdjustment(e); }
  function onUp(e) {
    isAdjusting = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }

  function onDown(e) {
    isAdjusting = true;
    startX = e.clientX;
    startY = e.clientY;
    originalValues = inputs.map(input => parseFloat(input.value));
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    e.preventDefault();
  }

  adjustButton.addEventListener('pointerdown', onDown);

  return [
    () => adjustButton.removeEventListener('pointerdown', onDown),
    () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }
  ];
}

export function cleanupAlignmentLines() {
  const existingLines = canvas.stage.children.filter(child => child.name === 'tokenAlignmentLine');
  existingLines.forEach(line => line.destroy());
}
