// Obter referência ao botão de alternar tema
const themeToggle = document.getElementById('themeToggle');
const darkModeCss = document.getElementById('dark-mode-css');

// Variável para controlar o estado do tema
let isDarkMode = false;

// Função para alternar o tema
function toggleTheme() {
  // Alterna o estado do tema
  isDarkMode = !isDarkMode;

  // Atualiza o estilo da página
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    themeToggle.classList.add('active');
    darkModeCss.disabled = false; // Habilita o arquivo de estilo do modo escuro
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.classList.remove('active');
    darkModeCss.disabled = true; // Desabilita o arquivo de estilo do modo escuro
  }
}

// Adiciona o evento de clique ao botão
themeToggle.addEventListener('click', toggleTheme);