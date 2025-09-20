// ======================================================================
//             !!! ATENÇÃO: VERIFIQUE SE ESTA URL ESTÁ CORRETA !!!
// ======================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwy6HpFMudQmxDqImORVwbQZbQH0bQFSI59w1vd0xJstLULdE1B84wevRFBoq8S-ywBIQ/exec";

// --- Variáveis Globais ---
let id_token = null; // Armazena o token de identidade do Google após o login

// --- Seletores de Elementos Globais ---
const telaLogin = document.getElementById('tela-login');
const loginMessage = document.getElementById('login-message');
const telaPrincipal = document.getElementById('tela-principal');
const welcomeMessage = document.getElementById('welcome-message');
const tabelaBody = document.querySelector("#tabela-processos tbody");
const campoBusca = document.getElementById('campo-busca');
const addNewButton = document.getElementById('add-new-button');
const novaLinhaForm = document.getElementById('nova-linha-form');
const mensagem = document.getElementById('mensagem');

// --- Lógica de Autenticação (Google Identity Services) ---

/**
 * Esta função é chamada AUTOMATICAMENTE pela biblioteca do Google após o login bem-sucedido.
 * @param {object} response - O objeto de credencial retornado pelo Google.
 */
function handleCredentialResponse(response) {
  id_token = response.credential;
  
  const payload = JSON.parse(atob(id_token.split('.')[1]));
  const userName = payload.given_name || payload.name.split(' ')[0];
  
  welcomeMessage.textContent = `Bem-vindo(a), ${userName}.`;
  telaLogin.style.display = 'none';
  telaPrincipal.style.display = 'block';

  carregarDadosIniciais();
}

// --- Funções de Comunicação com a API ---
async function callApi(action, payload = {}, button = null) {
  if (button) button.setAttribute('aria-busy', 'true');
  setMensagem('', '');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        action: action, 
        payload: payload,
        idToken: id_token
      }),
      redirect: 'follow'
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const result = await response.json();

    if (result.status === 'error') throw new Error(result.message);
    
    return result;
  } catch (error) {
    console.error("Erro ao chamar API:", error);
    setMensagem(error.message, 'erro');
    if (error.message.includes('Acesso negado')) {
        telaPrincipal.style.display = 'none';
        telaLogin.style.display = 'block';
        loginMessage.textContent = "Acesso negado pelo servidor. Verifique se seu e-mail está autorizado.";
    }
    return null;
  } finally {
    if (button) button.removeAttribute('aria-busy');
  }
}

// --- Funções de Manipulação da Tabela ---
async function carregarDadosIniciais() {
  tabelaBody.innerHTML = `<tr><td colspan="7" aria-busy="true">Carregando dados da planilha...</td></tr>`;
  const result = await callApi('getAllData');
  if (result) {
    popularTabela(result.data);
  } else {
    tabelaBody.innerHTML = `<tr><td colspan="7">Falha ao carregar os dados.</td></tr>`;
  }
}

function popularTabela(dados) {
    tabelaBody.innerHTML = '';
    if (!dados || dados.length === 0) {
        tabelaBody.innerHTML = `<tr><td colspan="7">Nenhum processo encontrado.</td></tr>`;
        return;
    }
    dados.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-linha-id', item.linha);
        tr.innerHTML = `
            <td data-label="Processo" data-field="processo">${item.processo}</td>
            <td contenteditable="true" data-label="Ação da Secretaria" data-field="acao">${item.acao}</td>
            <td contenteditable="true" data-label="Assunto" data-field="assunto">${item.assunto}</td>
            <td contenteditable="true" data-label="Responsável" data-field="responsavel">${item.responsavel}</td>
            <td contenteditable="true" data-label="Histórico/Andamento" data-field="historico">${item.historico}</td>
            <td data-label="Registro de Alteração" data-field="registro">${item.registro || ''}</td>
            <td data-label="Ações" class="acoes"><button class="save-button" data-linha-id="${item.linha}">Salvar</button></td>
        `;
        tabelaBody.appendChild(tr);
    });
}


// --- Event Listeners para Interação do Usuário ---
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
        const tr = button.closest('tr');
        const linhaId = tr.getAttribute('data-linha-id');

        const dadosParaSalvar = {
            linha: linhaId,
            processo: tr.querySelector('[data-field="processo"]').textContent,
            acao: tr.querySelector('[data-field="acao"]').textContent,
            assunto: tr.querySelector('[data-field="assunto"]').textContent,
            responsavel: tr.querySelector('[data-field="responsavel"]').textContent,
            historico: tr.querySelector('[data-field="historico"]').textContent,
        };
        
        const result = await callApi('updateRow', dadosParaSalvar, button);
        if (result) {
            setMensagem(result.message, 'sucesso');
            tr.querySelector('[data-field="registro"]').textContent = result.newLog;
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

    const result = await callApi('addNewRow', dadosParaAdicionar, addNewButton);
    if (result) {
        setMensagem(result.message, 'sucesso');
        inputs.forEach(input => input.value = '');
        carregarDadosIniciais();
    }
});

// --- Função Utilitária ---
function setMensagem(texto, tipo = 'sucesso') {
    mensagem.textContent = texto;
    mensagem.className = tipo;
    if (texto) {
        setTimeout(() => setMensagem('', ''), 4000);
    }
}