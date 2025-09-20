// =================================================================
// ARQUIVO: Código.gs (VERSÃO FINAL COM PAGINAÇÃO E BUSCA)
// =================================================================

// --- CONFIGURAÇÃO ---
const AUTORIZED_EMAILS = new Set(['micheline.machado@pguerj.uerj.br', 'cytchrisley@gmail.com', 'chrysthian.chrisley@gmail.com']);
const SPREADSHEET_ID = '18Sjp7dOzCvXIyld8vVlUPZxgW-j5rQlvpkKm9Ve017g';
const SHEET_NAME = 'SCGUERJ';

// --- Ponto de Entrada da API ---
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const userEmail = getVerifiedEmail(requestData.idToken);
    
    if (!userEmail || !AUTORIZED_EMAILS.has(userEmail.toLowerCase())) {
      throw new Error('Acesso negado.');
    }

    let response;
    switch (requestData.action) {
      case 'getPaginatedData':
        response = getPaginatedData(requestData.payload);
        break;
      case 'updateRow':
        response = updateRow(requestData.payload, userEmail);
        break;
      case 'addNewRow':
        response = addNewRow(requestData.payload, userEmail);
        break;
      default:
        throw new Error('Ação desconhecida.');
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
                       .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = { status: 'error', message: error.message };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
                       .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Funções Auxiliares ---
function getVerifiedEmail(idToken) {
  if (!idToken) return null;
  try {
    const response = UrlFetchApp.fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
    const payload = JSON.parse(response.getContentText());
    return payload.email;
  } catch (e) {
    return null;
  }
}

function getPaginatedData(payload) {
  const { page = 1, pageSize = 50, searchTerm = '' } = payload;
  const cache = CacheService.getScriptCache();
  let allData;
  const cacheKey = 'full_sheet_data';
  const cachedAllData = cache.get(cacheKey);

  if (cachedAllData != null) {
    allData = JSON.parse(cachedAllData);
  } else {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const rawData = sheet.getDataRange().getDisplayValues();
    rawData.shift();
    allData = rawData.map((row, index) => {
      if (row.join("").trim().length === 0) return null;
      return {
        linha: index + 2, processo: row[0], acao: row[1], assunto: row[2], 
        responsavel: row[3], historico: row[4], registro: row[6] || ''
      };
    }).filter(item => item !== null);
    
    try {
      cache.put(cacheKey, JSON.stringify(allData), 600);
    } catch (e) {
      Logger.log('Não foi possível salvar no cache (dados muito grandes): ' + e.toString());
    }
  }

  const filteredData = searchTerm
    ? allData.filter(row => JSON.stringify(Object.values(row)).toLowerCase().includes(searchTerm.toLowerCase()))
    : allData;

  const totalRows = filteredData.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (page - 1) * pageSize;
  const pageData = filteredData.slice(startIndex, startIndex + pageSize);

  return { 
    status: 'success', 
    data: pageData,
    pagination: { currentPage: page, pageSize, totalRows, totalPages }
  };
}

function updateRow(data, userEmail) {
  CacheService.getScriptCache().remove('full_sheet_data');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const timestamp = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  const auditLog = `Atualizado por: ${userEmail} em ${timestamp}`;
  sheet.getRange(data.linha, 2, 1, 4).setValues([[data.acao, data.assunto, data.responsavel, data.historico]]);
  sheet.getRange(data.linha, 7).setValue(auditLog);
  return { status: 'success', message: `Processo ${data.processo} atualizado!`, newLog: auditLog };
}

function addNewRow(data, userEmail) {
  CacheService.getScriptCache().remove('full_sheet_data');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const timestamp = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  const auditLog = `Criado por: ${userEmail} em ${timestamp}`;
  sheet.appendRow([data.processo, data.acao, data.assunto, data.responsavel, data.historico, '', auditLog]);
  return { status: 'success', message: 'Novo processo adicionado com sucesso!' };
}