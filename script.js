// !---- SUA URL DO APP DA WEB ----!
const API_URL = "https://script.google.com/macros/s/AKfycbzqMZzovwh2W_Dkt_Y4fnMvQUHgzYCJjKqe33FcJ3h_taSSm0dccCpULcjyHh9dV1hA/exec";

// --- Variável para armazenar o usuário logado ---
let loggedInUser = null;

// --- Seletores de Elementos Globais ---
const telaLogin = document.getElementById('tela-login');
const telaPrincipal = document.getElementById('tela-principal');
const formLogin = document.getElementById('form-login');
const loginButton = document.getElementById('login-button');
const loginErro = document.getElementById('login-erro');
const welcomeMessage = document.getElementById('welcome-message');
const tabelaBody = document.querySelector("#tabela-processos tbody");
const campoBusca = document.getElementById('campo-busca');
const addNewButton = document.getElementById('add-new-button');
const novaLinhaForm = document.getElementById('nova-linha-form');
const mensagem = document.getElementById('mensagem');

// --- Funções Auxiliares ---

async function callApi(action, payload = {}, button = null) {
    if (button) button.setAttribute('aria-busy', 'true');
    setMensagem('', '');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, payload }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Erro ao chamar API:", error);
        setMensagem('Falha na comunicação com o servidor.', 'erro');
        return { status: 'error', message: 'Falha na comunicação.' };
    } finally {
        if (button) button.removeAttribute('aria-busy');
    }
}

function setMensagem(texto, tipo = 'sucesso') {
    mensagem.textContent = texto;
    mensagem.className = tipo;
    if (texto) {
        setTimeout(() => setMensagem('', ''), 4000);
    }
}

function popularTabela(dados) {
    tabelaBody.innerHTML = '';
    if (dados.length === 0) {
        tabelaBody.innerHTML = `<tr><td colspan="7">Nenhum processo encontrado.</td></tr>`;
        return;
    }
    dados.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-linha-id', item.linha);
        // Adiciona a célula para o registro de alteração
        tr.innerHTML = `
            <td data-field="processo">${item.processo}</td>
            <td contenteditable="true" data-field="acao">${item.acao}</td>
            <td contenteditable="true" data-field="assunto">${item.assunto}</td>
            <td contenteditable="true" data-field="responsavel">${item.responsavel}</td>
            <td contenteditable="true" data-field="historico">${item.historico}</td>
            <td data-field="registro">${item.registro || ''}</td>
            <td class="acoes"><button class="save-button" data-linha-id="${item.linha}">Salvar</button></td>
        `;
        tabelaBody.appendChild(tr);
    });
}

// --- Lógica Principal e Eventos ---

async function carregarDadosIniciais() {
    tabelaBody.innerHTML = `<tr><td colspan="7" aria-busy="true">Carregando dados da planilha...</td></tr>`;
    const result = await callApi('getAllData');
    if (result.status === 'success') {
        popularTabela(result.data);
    } else {
        tabelaBody.innerHTML = `<tr><td colspan="7">Erro ao carregar os dados.</td></tr>`;
        setMensagem(result.message, 'erro');
    }
}

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErro.textContent = '';
    const usuario = document.getElementById('usuario').value;
    const senha = document.getElementById('senha').value;
    
    const result = await callApi('autenticar', { usuario, senha }, loginButton);

    if (result.status === 'success' && result.authenticated) {
        // Armazena o nome do usuário logado
        loggedInUser = result.username; 
        welcomeMessage.textContent = `Bem-vindo(a), ${loggedInUser}. Consulte, edite e adicione processos.`;
        
        telaLogin.style.display = 'none';
        telaPrincipal.style.display = 'block';
        carregarDadosIniciais();
    } else {
        loginErro.textContent = 'Usuário ou senha inválidos.';
    }
});

campoBusca.addEventListener('input', (e) => {
    const termoBusca = e.target.value.toLowerCase();
    tabelaBody.querySelectorAll('tr').forEach(linha => {
        const textoLinha = linha.textContent.toLowerCase();
        linha.classList.toggle('hidden', !textoLinha.includes(termoBusca));
    });
});

tabelaBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('save-button')) {
        const button = e.target;
        const linhaId = button.getAttribute('data-linha-id');
        const tr = button.closest('tr');

        const dadosParaSalvar = {
            linha: linhaId,
            processo: tr.querySelector('[data-field="processo"]').textContent,
            acao: tr.querySelector('[data-field="acao"]').textContent,
            assunto: tr.querySelector('[data-field="assunto"]').textContent,
            responsavel: tr.querySelector('[data-field="responsavel"]').textContent,
            historico: tr.querySelector('[data-field="historico"]').textContent,
        };
        
        // Envia os dados E o nome do usuário logado para a API
        const result = await callApi('updateRow', { data: dadosParaSalvar, username: loggedInUser }, button);
        
        if (result.status === 'success') {
            setMensagem(result.message, 'sucesso');
            // Atualiza o campo de registro na tela sem precisar recarregar tudo
            tr.querySelector('[data-field="registro"]').textContent = result.newLog;
        } else {
            setMensagem(result.message, 'erro');
        }
    }
});

addNewButton.addEventListener('click', async () => {
    const inputs = novaLinhaForm.querySelectorAll('input');
    const dadosParaAdicionar = {};
    let formValido = true;

    inputs.forEach(input => {
        dadosParaAdicionar[input.name] = input.value;
        if (!input.value && input.name === 'processo') {
            input.focus();
            formValido = false;
        }
    });

    if (!formValido) {
        setMensagem('O campo "Processo" é obrigatório para adicionar uma nova linha.', 'erro');
        return;
    }

    // Envia os dados E o nome do usuário logado para a API
    const result = await callApi('addNewRow', { data: dadosParaAdicionar, username: loggedInUser }, addNewButton);

    if (result.status === 'success') {
        setMensagem(result.message, 'sucesso');
        inputs.forEach(input => input.value = '');
        carregarDadosIniciais(); // Recarrega a tabela para incluir a nova linha
    } else {
        setMensagem(result.message, 'erro');
    }
});