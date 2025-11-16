// scripts/release.js
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const archiver = require('archiver');
const readline = require('readline');  // Módulo para interação com o usuário

// Lê o arquivo module.json
const moduleJsonPath = 'module.json';
const moduleJson = JSON.parse(fs.readFileSync('module.json', 'utf8'));
const version = moduleJson.version;

// Funções auxiliares
function execCommand(command) {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Erro ao executar comando: ${command}`);
        process.exit(1);
    }
}

function updateVersionInFiles() {
    // Atualiza package.json se existir
    if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        packageJson.version = version;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    }
}

// Função para criar o arquivo ZIP
function createZip() {
    const zipName = 'isometric-perspective.zip';
    const output = fs.createWriteStream(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`Arquivo ${zipName} criado com sucesso (${archive.pointer()} bytes).`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // Adicionar module.json
    archive.file('module.json', { name: 'module.json' });

    // Adicionar diretórios lang, scripts, templates
    const foldersToAdd = ['lang', 'scripts', 'templates'];
    for (const folder of foldersToAdd) {
        if (fs.existsSync(folder)) {
            archive.directory(folder, folder);
        }
    }

    archive.finalize();
}

// Função para pedir o nome/descrição do release
function askReleaseInfo(callback) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Digite um nome ou descrição para o release: ', (info) => {
        rl.close();
        callback(info);  // Passa a info para o callback
    });
}

// Principal
console.log(`Iniciando release da versão ${version}...`);

// 1. Atualiza versões nos arquivos
updateVersionInFiles();

// 2. Deleta o arquivo ZIP antigo, se existir
const zipPath = path.join(__dirname, 'isometric-perspective.zip');
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log(`Arquivo ${zipPath} deletado.`);
}

// 3. Cria o novo arquivo ZIP
createZip();

// Solicita informações sobre o release e executa o commit com a mensagem personalizada
askReleaseInfo((info) => {
    const releaseMessage = `Release v${version} - ${info}`;

    // 4. Commit das alterações
    execCommand('git add .');
    execCommand(`git commit -m "${releaseMessage}"`);  // Commit com a descrição fornecida

    // 5. Cria e push da tag
    execCommand(`git tag -a v${version} -m "${releaseMessage}"`);  // Tag com a mesma mensagem
    execCommand('git push');
    execCommand('git push --tags');

    console.log(`\n${releaseMessage}`);
    console.log('O GitHub Actions irá criar automaticamente o release com os arquivos.');
    console.log('Verifique o progresso em: https://github.com/marceloabner/isometric-perspective/actions');
});