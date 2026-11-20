const API_URL = '/api/v1';
let currentUser = null;
let lastGeneratedMtcn = '';

setInterval(function() {
  const now = new Date();
  const clock = document.getElementById('clockDisplay');
  if (clock) clock.innerText = now.toTimeString().slice(0, 5);
}, 1000);

function formatKz(v) {
  return Number(v || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function simularCarregamento(texto) {
  const overlay = document.getElementById('loadingOverlay');
  const txt = document.getElementById('loadingText');
  if (txt) txt.innerText = texto;
  if (overlay) overlay.classList.remove('hidden');
  return new Promise(function(resolve) {
    setTimeout(function() {
      if (overlay) overlay.classList.add('hidden');
      resolve();
    }, 800);
  });
}

function mostrarErro(msg) {
  const box = document.getElementById('errorBox');
  if (box) {
    box.innerText = msg;
    box.classList.remove('hidden');
  }
}

function esconderErro() {
  const box = document.getElementById('errorBox');
  if (box) box.classList.add('hidden');
}

function mostrarNotificacaoOtp(channelLabel, destination, code) {
  const toast = document.getElementById('otpToast');
  document.getElementById('otpToastTitle').innerText = 'Notificacao ' + channelLabel + ' (' + destination + ')';
  document.getElementById('otpToastBody').innerHTML = 'Banco Digital Angola: O seu codigo OTP Western Union e <strong>' + code + '</strong>';
  toast.classList.remove('hidden');
}

function esconderNotificacaoOtp() {
  const toast = document.getElementById('otpToast');
  if (toast) toast.classList.add('hidden');
}

function mudarAuthAba(aba) {
  esconderErro();
  const isLogin = (aba === 'login');
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);
  document.getElementById('btnAuthLogin').classList.toggle('active', isLogin);
  document.getElementById('btnAuthReg').classList.toggle('active', !isLogin);
}

async function criarConta() {
  esconderErro();
  const payload = {
    fullName: document.getElementById('regName').value,
    bi: document.getElementById('regBi').value,
    phone: document.getElementById('regPhone').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPass').value
  };
  await simularCarregamento('A validar B.I. e NIF junto ao sistema KYC...');
  const res = await fetch(API_URL + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  // Limpa tanto o formulário de cadastro quanto o de login (por segurança)
  document.getElementById('regName').value = '';
  document.getElementById('regBi').value = '';
  document.getElementById('regPhone').value = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPass').value = '';

  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';

  document.getElementById('regSuccessBanner').classList.remove('hidden');
  mudarAuthAba('login');
}

async function fazerLogin() {
  esconderErro();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;

  await simularCarregamento('A autenticar sessao segura...');
  const res = await fetch(API_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  currentUser = data.user;
  atualizarDadosTela();

  const authScr = document.getElementById('authScreen');
  const appScr = document.getElementById('appScreen');
  const navBar = document.getElementById('bottomNav');

  if (authScr) authScr.classList.add('hidden');
  if (appScr) appScr.classList.remove('hidden');
  if (navBar) navBar.classList.remove('hidden');
  navegarPara('home');
}

function atualizarDadosTela() {
  document.getElementById('holderName').innerText = currentUser.fullName;
  document.getElementById('ibanDisplay').innerText = 'IBAN: ' + currentUser.iban;
  document.getElementById('balanceDisplay').innerText = formatKz(currentUser.balanceAOA);
  document.getElementById('homeUsedLimit').innerText = Number(currentUser.usedLimitUSD || 0).toFixed(2) + ' USD';
  document.getElementById('sendReceiverName').value = currentUser.fullName;

  document.getElementById('profName').innerText = currentUser.fullName;
  document.getElementById('profBi').innerText = currentUser.bi;
  document.getElementById('profPhone').innerText = currentUser.phone;
  document.getElementById('profEmail').innerText = currentUser.email;
  document.getElementById('profIban').innerText = currentUser.iban;

  const parts = currentUser.fullName.trim().split(/\s+/);
  document.getElementById('lastNameInput').value = parts[parts.length - 1];
  renderizarExtrato(currentUser.transactions);
}

function fazerLogout() {
  esconderErro();
  esconderNotificacaoOtp();
  currentUser = null;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('regSuccessBanner').classList.add('hidden');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('bottomNav').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}


async function zerarSistema() {
  esconderErro();
  await fetch(API_URL + '/reset', { method: 'POST' });
  alert('Base de dados reiniciada!');
}

function navegarPara(destino) {
  esconderErro();
  ['viewHome', 'viewWu', 'viewHistory', 'viewProfile'].forEach(function(id) {
    document.getElementById(id).classList.add('hidden');
  });
  ['navHome', 'navWu', 'navHistory', 'navProfile'].forEach(function(id) {
    document.getElementById(id).classList.remove('active');
  });

  if (destino === 'home') { document.getElementById('viewHome').classList.remove('hidden'); document.getElementById('navHome').classList.add('active'); }
  if (destino === 'wu') { document.getElementById('viewWu').classList.remove('hidden'); document.getElementById('navWu').classList.add('active'); }
  if (destino === 'history') { document.getElementById('viewHistory').classList.remove('hidden'); document.getElementById('navHistory').classList.add('active'); }
  if (destino === 'profile') { document.getElementById('viewProfile').classList.remove('hidden'); document.getElementById('navProfile').classList.add('active'); }
}

function mudarAbaWu(aba) {
  esconderErro();
  const isRec = (aba === 'receive');
  document.getElementById('tabReceive').classList.toggle('hidden', !isRec);
  document.getElementById('tabSend').classList.toggle('hidden', isRec);
  document.getElementById('btnTabReceive').classList.toggle('active', isRec);
  document.getElementById('btnTabSend').classList.toggle('active', !isRec);
}

function renderizarExtrato(lista) {
  const container = document.getElementById('fullHistoryList');
  if (!lista || lista.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:20px;">Nenhuma transacao registada nesta conta.</div>';
    return;
  }
  container.innerHTML = lista.map(function(tx) {
    return '<div class="tx-item"><div class="tx-info"><strong>WU: ' + tx.senderName + ' (' + tx.originCountry + ')</strong><span>MTCN: ' + tx.mtcn + ' - ' + tx.amountOrigin + ' (Taxa: ' + tx.exchangeRate + ' Kz)</span><span>' + tx.timestamp + ' - ' + tx.authUsed + '</span></div><div class="tx-amount">+ ' + formatKz(tx.creditedAmountAOA) + '</div></div>';
  }).join('');
}

async function enviarRemessa() {
  esconderErro();
  const payload = {
    senderName: document.getElementById('sendSenderName').value,
    originCountry: document.getElementById('sendCountry').value,
    receiverName: document.getElementById('sendReceiverName').value,
    amountOrigin: document.getElementById('sendAmount').value,
    currency: document.getElementById('sendCurrency').value
  };
  await simularCarregamento('A registar remessa na rede global Western Union...');
  const res = await fetch(API_URL + '/remittances/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  lastGeneratedMtcn = data.remittance.mtcn;
  document.getElementById('generatedMtcn').innerText = lastGeneratedMtcn;
  document.getElementById('outSender').innerText = data.remittance.senderName;
  document.getElementById('outReceiver').innerText = data.remittance.receiverName;
  document.getElementById('outAmount').innerText = data.remittance.amountOrigin.toFixed(2) + ' ' + data.remittance.currency;

  document.getElementById('sendForm').classList.add('hidden');
  document.getElementById('sendSuccessCard').classList.remove('hidden');
}

function usarCodigoParaLevantar() {
  document.getElementById('mtcnInput').value = lastGeneratedMtcn;
  reiniciarRecebimento();
  mudarAbaWu('receive');
}

function novoEnvio() {
  document.getElementById('sendSuccessCard').classList.add('hidden');
  document.getElementById('sendForm').classList.remove('hidden');
}

async function consultarMTCN() {
  esconderErro();
  const mtcn = document.getElementById('mtcnInput').value.trim();
  const lastName = document.getElementById('lastNameInput').value.trim();
  const otpChannel = document.getElementById('otpChannelSelect').value;

  if (mtcn.length !== 10) return mostrarErro('Insira um codigo MTCN valido com 10 digitos.');
  if (!lastName) return mostrarErro('Informe o sobrenome do beneficiario.');

  await simularCarregamento('A validar MTCN, Compliance BNA e taxa de cambio...');
  const res = await fetch(API_URL + '/remittances/inquire', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mtcn: mtcn, lastName: lastName, userEmail: currentUser.email, otpChannel: otpChannel })
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  document.getElementById('resSender').innerText = data.senderName;
  document.getElementById('resCountry').innerText = data.originCountry;
  document.getElementById('resOrigin').innerText = data.amountOrigin.toFixed(2) + ' ' + data.currency;
  document.getElementById('resRate').innerText = '1 ' + data.currency + ' = ' + data.exchangeRate.toFixed(2) + ' Kz';
  document.getElementById('resTotalAOA').innerText = formatKz(data.amountAOA);

  mostrarNotificacaoOtp(data.otpInfo.channelLabel, data.otpInfo.destination, data.otpInfo.code);
  document.getElementById('otpInputLabel').innerText = 'Codigo OTP enviado para ' + data.otpInfo.destination + ':';

  document.getElementById('stepInquire').classList.add('hidden');
  document.getElementById('stepConfirm').classList.remove('hidden');
}

async function reenviarOtp(channel) {
  esconderErro();
  const res = await fetch(API_URL + '/otp/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail: currentUser.email, channel: channel })
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  mostrarNotificacaoOtp(data.channelLabel, data.destination, data.simulatedOtp);
  document.getElementById('otpInputLabel').innerText = 'Codigo OTP enviado para ' + data.destination + ':';
}

async function confirmarPagamento(authMethod) {
  esconderErro();
  const mtcn = document.getElementById('mtcnInput').value.trim();
  const otpCode = document.getElementById('otpInput').value.trim();

  const msgLoad = authMethod === 'biometric'
    ? 'A validar Impressao Digital e a liquidar em Kwanzas...'
    : 'A verificar codigo OTP e a creditar na conta a ordem...';

  await simularCarregamento(msgLoad);
  const res = await fetch(API_URL + '/remittances/payout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mtcn: mtcn, otpCode: otpCode, authMethod: authMethod, userEmail: currentUser.email })
  });
  const data = await res.json();
  if (!res.ok) return mostrarErro(data.error);

  esconderNotificacaoOtp();
  currentUser.balanceAOA = data.newBalanceAOA;
  currentUser.usedLimitUSD = data.usedLimitUSD;
  currentUser.transactions = data.transactions;
  atualizarDadosTela();

  document.getElementById('recTxnId').innerText = data.transactionId;
  document.getElementById('recMtcn').innerText = data.mtcn;
  document.getElementById('recSender').innerText = data.senderName;
  document.getElementById('recReceiver').innerText = data.receiverName;
  document.getElementById('recAuth').innerText = data.authUsed;
  document.getElementById('recDate').innerText = data.timestamp;
  document.getElementById('recAmount').innerText = formatKz(data.creditedAmountAOA);

  document.getElementById('stepConfirm').classList.add('hidden');
  document.getElementById('stepReceipt').classList.remove('hidden');
}

function reiniciarRecebimento() {
  esconderErro();
  esconderNotificacaoOtp();
  document.getElementById('otpInput').value = '';
  document.getElementById('stepConfirm').classList.add('hidden');
  document.getElementById('stepReceipt').classList.add('hidden');
  document.getElementById('stepInquire').classList.remove('hidden');
}
