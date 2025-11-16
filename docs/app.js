// Configuração inicial do PixiJS
const app = new PIXI.Application({
    resizeTo: document.getElementById('pixiApp'),
    backgroundColor: 0x1099bb,
    antialias: true, // Habilita antialiasing
});
document.getElementById('pixiApp').appendChild(app.view);

// Redimensionar canvas dinamicamente
window.addEventListener('resize', () => {
    app.renderer.resize(app.view.offsetWidth, app.view.offsetHeight);
    updateCanvasElements();
});

// Função para atualizar posições relativas ao canvas
function updateCanvasElements() {
    rectangle.position.set(app.screen.width / 2, app.screen.height / 2);
    if (pivotPoint) {
        updatePivotPoint();
    }
    if (imageSprite) {
        imageSprite.position.set(app.screen.width / 2, app.screen.height / 2);
    }
    drawGrid();
}

// Carregando elementos do DOM
const imageLoader = document.getElementById('imageLoader');
const clearImage = document.getElementById('clearImage');
const togglePivot = document.getElementById('togglePivot');
const sliders = {
    scale: document.getElementById('scaleX'), // Unificado como "scale"
    rotation: document.getElementById('rotation'),
    skewX: document.getElementById('skewX'),
    skewY: document.getElementById('skewY'),
    positionX: document.getElementById('positionX'), // Nova referência
    positionY: document.getElementById('positionY'), // Nova referência
};
const values = {
    scale: document.getElementById('scaleXValue'), // Unificado como "scale"
    rotation: document.getElementById('rotationValue'),
    skewX: document.getElementById('skewXValue'),
    skewY: document.getElementById('skewYValue'),
    positionX: document.getElementById('positionXValue'), // Novo valor
    positionY: document.getElementById('positionYValue'), // Novo valor
};

// Container principal
const container = new PIXI.Container();
app.stage.addChild(container);

// Adicionando o quadrado semi-transparente
const rectangle = new PIXI.Graphics();
rectangle.beginFill(0xffffff, 0.5);
rectangle.drawRect(0, 0, 200, 200);
rectangle.endFill();
rectangle.pivot.set(0, 0); // Inicializa o pivot no ponto top-left
rectangle.position.set(app.screen.width / 2, app.screen.height / 2);
container.addChild(rectangle);
rectangle.scale.set(0.5, 0.5); // Escalas iniciais ajustadas para 0.5

sliders.positionX.value = rectangle.position.x;
sliders.positionY.value = rectangle.position.y;
sliders.scale.value = 0.5;

values.scale.value = 0.5;
values.positionX.value = rectangle.position.x;
values.positionY.value = rectangle.position.y;

// Criando o ponto de rotação
const pivotPoint = new PIXI.Graphics();
pivotPoint.beginFill(0xff0000);
pivotPoint.drawCircle(0, 0, 5); // Pequeno ponto vermelho
pivotPoint.endFill();
pivotPoint.visible = false; // Inicia oculto
container.addChild(pivotPoint);

// Linha horizontal fixa no ponto de pivot
const pivotLine = new PIXI.Graphics();
pivotLine.lineStyle(2, 0xff0000);
pivotLine.moveTo(-app.screen.width, 0);
pivotLine.lineTo(app.screen.width, 0);
pivotLine.visible = false;
app.stage.addChild(pivotLine);

// Função para atualizar a posição do ponto de rotação
function updatePivotPoint() {
    const globalPivot = rectangle.toGlobal(new PIXI.Point(rectangle.pivot.x, rectangle.pivot.y));
    pivotPoint.position.set(globalPivot.x, globalPivot.y);
    pivotLine.position.set(globalPivot.x, globalPivot.y);
}

// Evento para mostrar/ocultar o ponto de rotação e a linha diagonal
togglePivot.addEventListener('click', () => {
    const visibility = !pivotPoint.visible;
    pivotPoint.visible = visibility;
    pivotLine.visible = visibility;
    diagonalLine.visible = visibility; // Sincronizar a visibilidade da linha azul navy
    togglePivot.classList.toggle('active', visibility); // Adicionar ou remover a classe 'active'
    if (visibility) {
        updatePivotPoint();
        updateDiagonalLine();
    }
});

// Linha azul navy que conecta o ponto pivô ao vértice oposto do quadrado
const diagonalLine = new PIXI.Graphics();
diagonalLine.lineStyle(2, 0x000080, 0.5); // Linha azul navy
diagonalLine.visible = false; // Inicia oculto
app.stage.addChild(diagonalLine);

// Função para atualizar a linha diagonal
function updateDiagonalLine() {
    // Coordenadas globais do pivô
    const globalPivot = rectangle.toGlobal(new PIXI.Point(rectangle.pivot.x, rectangle.pivot.y));

    // Determinar o vértice oposto ao pivô
    const oppositeVertexX = rectangle.pivot.x === 0 ? rectangle.width : 0;
    const oppositeVertexY = rectangle.pivot.y === 0 ? rectangle.height : 0;
    const globalOppositeVertex = rectangle.toGlobal(new PIXI.Point(oppositeVertexX, oppositeVertexY));

    // Calcular o vetor de direção
    const dx = globalOppositeVertex.x - globalPivot.x;
    const dy = globalOppositeVertex.y - globalPivot.y;

    // Extender a linha para além dos dois pontos
    const lengthMultiplier = 1000; // Define o comprimento da linha
    const extendedStartX = globalPivot.x - dx * lengthMultiplier;
    const extendedStartY = globalPivot.y - dy * lengthMultiplier;
    const extendedEndX = globalOppositeVertex.x + dx * lengthMultiplier;
    const extendedEndY = globalOppositeVertex.y + dy * lengthMultiplier;

    // Atualizar a linha diagonal
    diagonalLine.clear();
    diagonalLine.lineStyle(2, 0x000080); // Linha azul navy
    diagonalLine.moveTo(extendedStartX, extendedStartY);
    diagonalLine.lineTo(extendedEndX, extendedEndY);
}

// Atualizar a linha diagonal sempre que o pivô ou transformação mudar
function updateGraphics() {
    if (pivotPoint.visible) {
        updatePivotPoint();
        updateDiagonalLine();
    }

    drawGrid();
}











// Criando a camada de grade
const gridLayer = new PIXI.Graphics();
app.stage.addChild(gridLayer); // Adiciona a grade diretamente ao canvas

// Função para desenhar a grade
function drawGrid() {
    gridLayer.clear(); // Limpa a grade anterior
    gridLayer.lineStyle(1, 0x000000, 0.5);

    // Dimensões do quadrado transformado
    const points = [
        rectangle.toGlobal(new PIXI.Point(0, 0)), // Canto superior esquerdo
        rectangle.toGlobal(new PIXI.Point(rectangle.width, 0)), // Superior direito
        rectangle.toGlobal(new PIXI.Point(rectangle.width, rectangle.height)), // Inferior direito
        rectangle.toGlobal(new PIXI.Point(0, rectangle.height)), // Inferior esquerdo
    ];

    // Calcula os vetores para as linhas paralelas
    const topVector = { x: points[1].x - points[0].x, y: points[1].y - points[0].y };
    const leftVector = { x: points[3].x - points[0].x, y: points[3].y - points[0].y };

    const numLines = 30; // Número de linhas para cada direção

    // Desenhar linhas paralelas ao lado superior/inferior
    for (let i = -numLines; i <= numLines; i++) {
        const offsetX = topVector.x * i;
        const offsetY = topVector.y * i;

        const startX = points[0].x + offsetX - leftVector.x * numLines;
        const startY = points[0].y + offsetY - leftVector.y * numLines;
        const endX = points[3].x + offsetX + leftVector.x * numLines;
        const endY = points[3].y + offsetY + leftVector.y * numLines;

        gridLayer.moveTo(startX, startY);
        gridLayer.lineTo(endX, endY);
    }

    // Desenhar linhas paralelas ao lado esquerdo/direito
    for (let i = -numLines; i <= numLines; i++) {
        const offsetX = leftVector.x * i;
        const offsetY = leftVector.y * i;

        const startX = points[0].x + offsetX - topVector.x * numLines;
        const startY = points[0].y + offsetY - topVector.y * numLines;
        const endX = points[1].x + offsetX + topVector.x * numLines;
        const endY = points[1].y + offsetY + topVector.y * numLines;

        gridLayer.moveTo(startX, startY);
        gridLayer.lineTo(endX, endY);
    }
}

/*
function updatePosition() {
    rectangle.position.set(
        parseFloat(sliders.positionX.value),
        parseFloat(sliders.positionY.value)
    );
    drawGrid(); // Atualizar a grade ao mover o quadrado
}
*/













// Variável para textura da imagem
let imageSprite = null;

// Função para carregar a imagem
imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            if (imageSprite) {
                container.removeChild(imageSprite);
            }
            const texture = PIXI.Texture.from(reader.result);
            imageSprite = new PIXI.Sprite(texture);
            imageSprite.anchor.set(0.5);
            imageSprite.position.set(app.screen.width / 2, app.screen.height / 2);
            container.addChildAt(imageSprite, 0);

            // Configurar eventos de zoom
            setupZoomAndPan(imageSprite);
        };
        reader.readAsDataURL(file);
    }
});

// Função para limpar a imagem
clearImage.addEventListener('click', () => {
    if (imageSprite) {
        container.removeChild(imageSprite);
        imageSprite = null;
    }
    imageLoader.value = '';

    // Restaura os valores iniciais dos sliders e campos de texto
    sliders.scale.value = 0.5;
    sliders.rotation.value = 0;
    sliders.skewX.value = 0;
    sliders.skewY.value = 0;
    sliders.positionX.value = app.screen.width / 2;
    sliders.positionY.value = app.screen.height / 2;

    values.scale.value = 0.5;
    values.rotation.value = 0;
    values.skewX.value = 0;
    values.skewY.value = 0;
    values.positionX.value = app.screen.width / 2;
    values.positionY.value = app.screen.height / 2;

    rectangle.scale.set(0.5, 0.5);
    rectangle.rotation = 0;
    rectangle.skew.set(0, 0);
    rectangle.position.set(app.screen.width / 2, app.screen.height / 2);

    updateGraphics();
    drawGrid();
    updateOutputValues();
});

// Função auxiliar para converter graus em radianos
const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

// Adicionando funcionalidade de zoom e movimentação
function setupZoomAndPan(sprite) {
    let scale = 1;
    const minScale = 0.5;
    const maxScale = 3;

    let isDragging = false;
    let dragStart = null;

    // Zoom com a roda do mouse
    app.view.addEventListener('wheel', (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        scale = Math.min(maxScale, Math.max(minScale, scale + delta));
        sprite.scale.set(scale, scale);
    });

    // Início do arrasto
    sprite.interactive = true;
    sprite.on('pointerdown', (event) => {
        isDragging = true;
        dragStart = event.data.getLocalPosition(sprite.parent);
    });

    // Movimento durante o arrasto
    sprite.on('pointermove', (event) => {
        if (isDragging) {
            const dragEnd = event.data.getLocalPosition(sprite.parent);
            sprite.x += dragEnd.x - dragStart.x;
            sprite.y += dragEnd.y - dragStart.y;
            dragStart = dragEnd;
        }
    });

    // Fim do arrasto
    sprite.on('pointerup', () => {
        isDragging = false;
    });
    sprite.on('pointerupoutside', () => {
        isDragging = false;
    });
}













// Atualização dos sliders
Object.keys(sliders).forEach((key) => {
    sliders[key].addEventListener('input', () => {
        const value = parseFloat(sliders[key].value);
        values[key].value = value;

        switch (key) {
            case 'scale': // Escala unificada
                rectangle.scale.set(value, value);
                break;
            case 'rotation':
                rectangle.rotation = degreesToRadians(value); // Rotação já está em graus
                break;
            case 'skewX':
                rectangle.skew.x = degreesToRadians(value); // Converter para radianos
                break;
            case 'skewY':
                rectangle.skew.y = degreesToRadians(value); // Converter para radianos
                break;
            case 'positionX':
            case 'positionY':
                rectangle.position.set(
                    parseFloat(sliders.positionX.value),
                    parseFloat(sliders.positionY.value)
                );
                break;
        }

        drawGrid(); // Atualizar a grade
        updateOutputValues(); // Atualizar o campo de texto
        updateDiagonalsDisplay();
        updateGraphics();
        if (pivotPoint.visible) updatePivotPoint();
    });

    // Sincronizar slider com campo numérico
    values[key].addEventListener('input', () => {
        const value = parseFloat(values[key].value);
        sliders[key].value = value;

        switch (key) {
            case 'scale': // Escala unificada
                rectangle.scale.set(value, value);
                break;
            case 'rotation':
                rectangle.rotation = degreesToRadians(value); // Rotação já está em graus
                break;
            case 'skewX':
                rectangle.skew.x = degreesToRadians(value); // Converter para radianos
                break;
            case 'skewY':
                rectangle.skew.y = degreesToRadians(value); // Converter para radianos
                break;
            case 'positionX':
            case 'positionY':
                rectangle.position.set(
                    parseFloat(sliders.positionX.value),
                    parseFloat(sliders.positionY.value)
                );
                break;
        }

        drawGrid(); // Atualizar a grade
        updateOutputValues(); // Atualizar o campo de texto
        updateGraphics();
        if (pivotPoint.visible) updatePivotPoint();
    });
});

// Adicionando o controle de ponto de rotação
const pivotSelector = document.getElementById('pivotSelector');

// Função para atualizar o ponto de rotação
pivotSelector.addEventListener('change', (event) => {
    const pivotValue = event.target.value;

    switch (pivotValue) {
        case 'top-left':
            rectangle.pivot.set(0, 0); // Canto superior esquerdo
            break;
        case 'top-right':
            rectangle.pivot.set(rectangle.width, 0); // Canto superior direito
            break;
        case 'bottom-left':
            rectangle.pivot.set(0, rectangle.height); // Canto inferior esquerdo
            break;
        case 'bottom-right':
            rectangle.pivot.set(rectangle.width, rectangle.height); // Canto inferior direito
            break;
        case 'center':
        default:
            rectangle.pivot.set(rectangle.width / 2, rectangle.height / 2); // Centro
            break;
    }

    updateGraphics();
    drawGrid(); // Atualizar a grade
});

// Desenhar a grade inicial
drawGrid();



// Função para ajustar dinamicamente a altura da caixa de texto
function adjustTextareaHeight(textarea) {
    textarea.style.height = "auto"; // Redefine a altura para recalcular
    textarea.style.height = `${textarea.scrollHeight}px`; // Ajusta para o conteúdo
}

// Adicionar o evento de ajuste dinâmico à caixa de texto
const outputValues = document.getElementById('outputValues');
outputValues.addEventListener("input", () => adjustTextareaHeight(outputValues));

// Ajusta a altura inicial ao carregar a página
adjustTextareaHeight(outputValues);

// ---------------------------------------------------------------------------------------

// Atualização dos valores exibidos em Actual Values
function updateOutputValues() {
    const diagonals = calculateDiagonalProportion();
    const angleBetweenLines = calculateAngleBetweenLines();
    const rectAngles = calculateRectangleAngles(rectangle);

    outputValues.value = `
        Actual Values
        --- Custom Isometric Values ---
        ${sliders.rotation.value}, ${sliders.skewX.value}, ${sliders.skewY.value}, ${(rectAngles[0]/2 - angleBetweenLines).toFixed(2).replace('-0', '0')}, 45, 0, 0, ${diagonals.proportion.toFixed(7)}
    
        --- Scene Info ---
        rotation: ${sliders.rotation.value},
        skewX: ${sliders.skewX.value},
        skewY: ${sliders.skewY.value},
        HudAngle: ${(rectAngles[0]/2 - angleBetweenLines).toFixed(2).replace('-0', '0')},
        reverseRotation: 45,
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio: ${diagonals.proportion.toFixed(9)},
        
        Diagonals: ${diagonals.diagonal1.toFixed(2)} / ${diagonals.diagonal2.toFixed(2)},
        Approx. Ratio: about ${diagonals.readableRatio},
        Blue-Red Lines Angle: ${angleBetweenLines.toFixed(2)},
        Adjusted Angle: ${(45 - angleBetweenLines).toFixed(2).replace('-0', '0')}
        Diamond Angles: ${(rectAngles[0]/2 - angleBetweenLines).toFixed(2).replace('-0', '0')} / ${(rectAngles[1]/2 - angleBetweenLines).toFixed(2).replace('-0', '0')},
    `.replace(/^ +/gm, '').trim(); //.replace(/\s+/g, '').trim() Remove espaços desnecessários

    adjustTextareaHeight(outputValues); // Ajusta a altura após atualizar o texto
}

updateOutputValues(); // Atualiza o campo de texto com os valores iniciais

// Definir o valor inicial para o seletor de ponto de rotação
pivotSelector.value = 'top-left'; // Garantindo que a opção inicial seja "Superior Esquerdo"

/*
// Estilizar a opção selecionada com a cor vermelha
const selectedOption = pivotSelector.options[pivotSelector.selectedIndex];
selectedOption.style.color = 'red';

// Adicionando funcionalidade de zoom
function setupZoom(sprite) {
    let scale = 1;
    const minScale = 0.5;
    const maxScale = 3;

    app.view.addEventListener('wheel', (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        scale = Math.min(maxScale, Math.max(minScale, scale + delta));
        sprite.scale.set(scale, scale);
    });
}
*/

// Atualização inicial dos controles
updateCanvasElements();







// Função para calcular a proporção legível
function getReadableRatio(value) {
    const sqrtValues = {
        '√2': Math.sqrt(2),
        '√3': Math.sqrt(3),
        '√5': Math.sqrt(5),
    };

    let closestRatio = '';
    let closestDiff = Infinity;

    // Tenta encontrar proporções simples de inteiros
    for (let denominator = 1; denominator <= 20; denominator++) {
        for (let numerator = 1; numerator <= 20; numerator++) {
            const ratio = numerator / denominator;
            const diff = Math.abs(ratio - value);

            if (diff < closestDiff) {
                closestDiff = diff;
                closestRatio = `${numerator}:${denominator}`;
            }
        }
    }

    // Tenta encontrar proporções envolvendo raízes
    for (const [rootLabel, rootValue] of Object.entries(sqrtValues)) {
        const ratioWithRoot = value / rootValue;

        for (let denominator = 1; denominator <= 20; denominator++) {
            const numerator = Math.round(ratioWithRoot * denominator);
            const ratio = numerator / denominator;
            const diff = Math.abs(ratio - value);

            if (diff < closestDiff) {
                closestDiff = diff;
                closestRatio = `${rootLabel}:${denominator}`;
            }
        }
    }

    // Adiciona o símbolo de aproximação se a diferença for significativa
    if (closestDiff > 0.01) {
        closestRatio = `~${closestRatio}`;
    }

    return closestRatio;
}

// Função para calcular as proporções das diagonais do quadrado
function calculateDiagonalProportion() {
    const topLeft = rectangle.toGlobal(new PIXI.Point(0, 0));
    const topRight = rectangle.toGlobal(new PIXI.Point(rectangle.width, 0));
    const bottomLeft = rectangle.toGlobal(new PIXI.Point(0, rectangle.height));
    const bottomRight = rectangle.toGlobal(new PIXI.Point(rectangle.width, rectangle.height));

    // Calculando as diagonais
    const diagonal1 = Math.sqrt(
        Math.pow(topLeft.x - bottomRight.x, 2) + Math.pow(topLeft.y - bottomRight.y, 2)
    );
    const diagonal2 = Math.sqrt(
        Math.pow(topRight.x - bottomLeft.x, 2) + Math.pow(topRight.y - bottomLeft.y, 2)
    );

    // Proporção das diagonais
    const proportion = diagonal1 / diagonal2;

    // Obtendo a razão legível
    const readableRatio = getReadableRatio(proportion);

    return {
        diagonal1,
        diagonal2,
        proportion,
        readableRatio,
    };
}

// Atualizar as proporções sempre que uma transformação é feita
function updateDiagonalsDisplay() {
    const diagonals = calculateDiagonalProportion();
    const outputValues = document.getElementById('outputValues');
    //outputValues.value += `\nDiagonal1: ${diagonals.diagonal1.toFixed(2)}, Diagonal2: ${diagonals.diagonal2.toFixed(2)}, Proporção: ${diagonals.proportion.toFixed(2)}`;
}

// Função para calcular o ângulo entre duas linhas em graus
function calculateAngleBetweenLines() {
    // Coordenadas globais do pivô
    const globalPivot = rectangle.toGlobal(new PIXI.Point(rectangle.pivot.x, rectangle.pivot.y));

    // Coordenadas de um ponto de referência na linha vermelha
    const redLinePoint = {
        x: globalPivot.x + app.screen.width, // Linha horizontal, expandida para a direita
        y: globalPivot.y
    };

    // Coordenadas do vértice oposto para a linha azul
    const oppositeVertexX = rectangle.pivot.x === 0 ? rectangle.width : 0;
    const oppositeVertexY = rectangle.pivot.y === 0 ? rectangle.height : 0;
    const globalOppositeVertex = rectangle.toGlobal(new PIXI.Point(oppositeVertexX, oppositeVertexY));

    // Vetores das duas linhas
    const redLineVector = { x: redLinePoint.x - globalPivot.x, y: redLinePoint.y - globalPivot.y };
    const blueLineVector = { x: globalOppositeVertex.x - globalPivot.x, y: globalOppositeVertex.y - globalPivot.y };

    // Produto escalar e magnitude dos vetores
    const dotProduct = redLineVector.x * blueLineVector.x + redLineVector.y * blueLineVector.y;
    const magnitudeRed = Math.sqrt(redLineVector.x ** 2 + redLineVector.y ** 2);
    const magnitudeBlue = Math.sqrt(blueLineVector.x ** 2 + blueLineVector.y ** 2);

    // Cálculo do ângulo em radianos e conversão para graus
    const angleRadians = Math.acos(dotProduct / (magnitudeRed * magnitudeBlue));
    const angleDegrees = (angleRadians * 180) / Math.PI;

    return angleDegrees;
}

function calculateRectangleAngles(rectangle) {
    // Obtém as coordenadas globais dos 4 vértices do quadrado
    const points = [
        rectangle.toGlobal(new PIXI.Point(0, 0)),           // Canto superior esquerdo
        rectangle.toGlobal(new PIXI.Point(rectangle.width, 0)),    // Canto superior direito
        rectangle.toGlobal(new PIXI.Point(rectangle.width, rectangle.height)), // Canto inferior direito
        rectangle.toGlobal(new PIXI.Point(0, rectangle.height))    // Canto inferior esquerdo
    ];

    // Função para calcular o ângulo entre dois pontos
    function calculateAngleBetweenPoints(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Produto escalar
        const dotProduct = v1.x * v2.x + v1.y * v2.y;
        
        // Magnitude dos vetores
        const magnitudeV1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const magnitudeV2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        // Cálculo do ângulo em radianos
        const angleRadians = Math.acos(dotProduct / (magnitudeV1 * magnitudeV2));
        
        // Conversão para graus
        const angleDegrees = (angleRadians * 180) / Math.PI;

        return angleDegrees;
    }

    // Calcular os ângulos em cada vértice
    const angles = [
        calculateAngleBetweenPoints(points[3], points[0], points[1]),  // Ângulo superior esquerdo
        calculateAngleBetweenPoints(points[0], points[1], points[2]),  // Ângulo superior direito
        calculateAngleBetweenPoints(points[1], points[2], points[3]),  // Ângulo inferior direito
        calculateAngleBetweenPoints(points[2], points[3], points[0])   // Ângulo inferior esquerdo
    ];

    return angles;
}












// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------
// Configurar a ordem de tabulação
function setupTabOrder() {
    // Defina a ordem desejada para os elementos
    const tabOrder = [
        values.scale,     // Input do scale
        values.rotation,  // Input do rotate
        values.skewX,     // Input do skewX
        values.skewY,     // Input do skewY
        values.positionX, // Input do PosX
        values.positionY, // Input do PosY
    ];

    // Atribuir tabindex de acordo com a ordem
    tabOrder.forEach((element, index) => {
        element.setAttribute("tabindex", index + 1);
    });

    // Configurar os elementos restantes com tabindex alto para aparecer depois
    const otherControls = Array.from(document.querySelectorAll("input, button, select, textarea"))
        .filter((element) => !tabOrder.includes(element));
    
    otherControls.forEach((element, index) => {
        element.setAttribute("tabindex", tabOrder.length + index + 1);
    });
}

// Chamar a função ao carregar o script
setupTabOrder();

// Configurar a ordem de tabulação apenas entre elementos desejados
function restrictTabOrder() {
    // Defina os elementos desejados para a navegação com Tab
    const tabOrder = [
        values.scale,     // Input do scale
        values.rotation,  // Input do rotate
        values.skewX,     // Input do skewX
        values.skewY,     // Input do skewY
        values.positionX, // Input do PosX
        values.positionY, // Input do PosY
    ];

    // Atribuir tabindex em sequência para os elementos desejados
    tabOrder.forEach((element, index) => {
        element.setAttribute("tabindex", index + 1);
    });

    // Remover tabindex de todos os outros elementos
    const allControls = document.querySelectorAll("input, button, select, textarea");
    allControls.forEach((element) => {
        if (!tabOrder.includes(element)) {
            element.setAttribute("tabindex", "-1"); // -1 remove o elemento da ordem de tabulação
        }
    });
}

// Chamar a função ao carregar o script
restrictTabOrder();


















// Adicionando lógica para alternar entre os limites dos controles
const toggleLimitsButton = document.getElementById("toggleLimits");

// Valores padrões e alternativos para os controles
const defaultLimits = {
    scale: { step: "0.5", min: "0.5", max: "1" },
    rotation: { step: "5", min: "-90", max: "90" },
    skewX: { step: "5", min: "-60", max: "60" },
    skewY: { step: "5", min: "-60", max: "60" },
};

const alternativeLimits = {
    scale: { step: "0.1", min: "0.1", max: "2" },
    rotation: { step: "1", min: "-180", max: "180" },
    skewX: { step: "1", min: "-180", max: "180" },
    skewY: { step: "1", min: "-180", max: "180" },
};

// Estado atual dos limites
let usingAlternativeLimits = false;

// Função para atualizar limites dos controles
function updateControlLimits(slider, number, limits) {
    // Atualiza os limites do slider
    slider.setAttribute("step", limits.step);
    slider.setAttribute("min", limits.min);
    slider.setAttribute("max", limits.max);

    // Atualiza os limites do input de número
    number.setAttribute("step", limits.step);
    number.setAttribute("min", limits.min);
    number.setAttribute("max", limits.max);

    // Certifica-se de que os valores atuais estão dentro dos novos limites
    if (parseFloat(number.value) < parseFloat(limits.min)) {
        number.value = limits.min;
        slider.value = limits.min;
    }
    if (parseFloat(number.value) > parseFloat(limits.max)) {
        number.value = limits.max;
        slider.value = limits.max;
    }
}

// Função para alternar limites
function toggleLimits() {
    // Determina quais limites usar
    const newLimits = usingAlternativeLimits ? defaultLimits : alternativeLimits;

    // Atualiza os limites para cada controle
    updateControlLimits(sliders.scale, values.scale, newLimits.scale);
    updateControlLimits(sliders.rotation, values.rotation, newLimits.rotation);
    updateControlLimits(sliders.skewX, values.skewX, newLimits.skewX);
    updateControlLimits(sliders.skewY, values.skewY, newLimits.skewY);

    // Alterna o estado atual
    usingAlternativeLimits = !usingAlternativeLimits;
}

// Adiciona o evento ao botão
toggleLimitsButton.addEventListener('click', () => {
    toggleLimits();
    toggleLimitsButton.classList.toggle('active', usingAlternativeLimits); // Adicionar ou remover a classe 'active'
});