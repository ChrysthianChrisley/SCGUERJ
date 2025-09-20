// ======================================================================
//             !!! ATENÇÃO: COLOQUE SUA URL DA API AQUI !!!
// ======================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbx204GMqVOn_KtF29VG8d5Kt6DbZLhZ1MCrz5eNbI6AmbcBin1LmLriw7jCM9WwOlwbcg/exec";

// --- Variáveis Globais ---
let id_token = null;
let currentPage = 1;
const PAGE_SIZE = 50;
let debounceTimer;

/**
 * Chamada pelo Google após o login bem-sucedido.
 */
function handleCredentialResponse(response) {
  id_token = response.credential;
  const payload = JSON.parse(atob(id_token.split('.')[1]));
  const userName = payload.given_name || payload.name.split(' ')[0];
  
  document.getElementById('welcome-message').textContent = `Bem-vindo(a), ${userName}.`;
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-principal').style.display = 'block';

  window.app.carregarPagina(1); 
}

// --- O script principal só roda depois que o HTML está completamente carregado ---
window.addEventListener('DOMContentLoaded', () => {
  
  window.app = {};
  
  // --- Seletores de Elementos ---
  const tabelaBody = document.querySelector("#tabela-processos tbody");
  const tfoot = document.querySelector("#tabela-processos tfoot");
  const campoBusca = document.getElementById('campo-busca');
  const mensagem = document.getElementById('mensagem');
  const paginationControls = document.getElementById('pagination-controls');
  const paginationStatus = document.getElementById('pagination-status');

  // --- Funções ---
  async function callApi(action, payload = {}, button = null) {
    if (button) button.setAttribute('aria-busy', 'true');
    setMensagem('', '');
    try {
      const response = await fetch(API_URL, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload, idToken: id_token }), redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json();
      if (result.status === 'error') throw new Error(result.message);
      return result;
    } catch (error) {
      console.error("Erro ao chamar API:", error);
      setMensagem(error.message, 'erro');
      if (error.message.includes('Acesso negado')) {
        document.getElementById('tela-principal').style.display = 'none';
        document.getElementById('tela-login').style.display = 'block';
        document.getElementById('login-message').textContent = "Acesso negado. Verifique se seu e-mail está autorizado.";
      }
      return null;
    } finally {
      if (button) button.removeAttribute('aria-busy');
    }
  }

  window.app.carregarPagina = async function(page, searchTerm = '') {
    tabelaBody.innerHTML = `<tr><td colspan="5" aria-busy="true">Carregando dados...</td></tr>`;
    paginationControls.innerHTML = '';
    paginationStatus.innerHTML = '';
    const payload = { page, pageSize: PAGE_SIZE, searchTerm };
    const result = await callApi('getPaginatedData', payload);

    if (result && result.data) {
      currentPage = page;
      popularTabela(result.data);
      renderPagination(result.pagination);
    } else {
      tabelaBody.innerHTML = `<tr><td colspan="5">Falha ao carregar os dados.</td></tr>`;
    }
  }

  function popularTabela(dados) {
      tabelaBody.innerHTML = '';
      if (!dados || dados.length === 0) {
          tabelaBody.innerHTML = `<tr><td colspan="5">Nenhum processo encontrado.</td></tr>`;
          return;
      }
      dados.forEach(item => {
          const tr = document.createElement('tr');
          tr.setAttribute('data-linha-id', item.linha);
          tr.innerHTML = `
              <td data-label="Processo" data-field="processo">${item.processo}</td>
              <td data-label="Assunto" data-field="assunto">${item.assunto}</td>
              <td data-label="Responsável" data-field="responsavel">${item.responsavel}</td>
              <td data-label="Registro de Alteração" data-field="registro">${item.registro || ''}</td>
              <td data-label="Ações" class="acoes"><button class="save-button" data-linha-id="${item.linha}">Editar/Salvar</button></td>
          `;
          tabelaBody.appendChild(tr);
      });
  }

  function renderPagination(paginationInfo) {
    const { currentPage, totalPages, totalRows } = paginationInfo;
    if (totalPages <= 1) {
      paginationControls.innerHTML = '';
      paginationStatus.textContent = `Mostrando ${totalRows} resultado(s).`;
      return;
    }
    paginationStatus.textContent = `Página ${currentPage} de ${totalPages} (${totalRows} resultados)`;
    let html = '<ul>';
    html += `<li><a href="#" class="pagination-link ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">Anterior</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
       if (i === currentPage || i <= 2 || i >= totalPages - 1 || (i >= currentPage - 1 && i <= currentPage + 1)) {
         html += `<li><a href="#" class="pagination-link ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</a></li>`;
       } else if (i === currentPage - 2 || i === currentPage + 2) {
         html += `<li>...</li>`;
       }
    }
    html += `<li><a href="#" class="pagination-link ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">Próxima</a></li>`;
    html += '</ul>';
    paginationControls.innerHTML = html;
  }

  function setMensagem(texto, tipo = 'sucesso') {
      mensagem.textContent = texto;
      mensagem.className = tipo;
      if (texto) { setTimeout(() => setMensagem('', ''), 4000) }
  }

  // --- Event Listeners ---
  campoBusca.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const searchTerm = e.target.value;
    debounceTimer = setTimeout(() => { window.app.carregarPagina(1, searchTerm) }, 500);
  });

  paginationControls.addEventListener('click', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('pagination-link') && !e.target.classList.contains('disabled')) {
        const page = parseInt(e.target.getAttribute('data-page'));
        if(page) window.app.carregarPagina(page, campoBusca.value);
    }
  });

  tabelaBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('save-button')) {
      const button = e.target;
      const tr = button.closest('tr');
      const celulasEditaveis = tr.querySelectorAll('[data-field="assunto"], [data-field="responsavel"]');

      // Alterna entre modo de edição e modo de salvar
      if (button.textContent === 'Editar/Salvar') {
        celulasEditaveis.forEach(cell => cell.setAttribute('contenteditable', 'true'));
        button.textContent = 'Salvar Alterações';
        tr.querySelector('[data-field="assunto"]').focus();
      } else {
        celulasEditaveis.forEach(cell => cell.setAttribute('contenteditable', 'false'));
        button.textContent = 'Editar/Salvar';

        const dadosParaSalvar = {
            linha: tr.getAttribute('data-linha-id'),
            processo: tr.querySelector('[data-field="processo"]').textContent,
            assunto: tr.querySelector('[data-field="assunto"]').textContent,
            responsavel: tr.querySelector('[data-field="responsavel"]').textContent,
            // Precisamos buscar os dados completos para não apagar o que está oculto
            acao: '', // Será preenchido no backend
            historico: '' // Será preenchido no backend
        };
        const result = await callApi('updateRow', dadosParaSalvar, button);
        if (result) {
            setMensagem(result.message, 'sucesso');
            tr.querySelector('[data-field="registro"]').textContent = result.newLog;
        }
      }
    }
  });

  tfoot.addEventListener('click', async (e) => {
      if (e.target.id === 'add-new-button') {
          const button = e.target;
          const novaLinhaForm = document.getElementById('nova-linha-form');
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
              setMensagem('O campo "Processo" é obrigatório.', 'erro');
              return;
          }
          const result = await callApi('addNewRow', dadosParaAdicionar, button);
          if (result) {
              setMensagem(result.message, 'sucesso');
              inputs.forEach(input => input.value = '');
              window.app.carregarPagina(currentPage, campoBusca.value);
          }
      }
  });
});