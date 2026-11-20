const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Tabela de Câmbio Comercial do Dia (Moeda Estrangeira -> Kwanza AOA)
const EXCHANGE_RATES = {
  USD: 915.00,
  EUR: 992.50,
  GBP: 1165.00
};

// Limite regulamentar diário por operação digital (equivalente em USD)
const DAILY_LIMIT_USD = 5000.00;

function getInitialState() {
  return {
    users: {
      "ana@banco.ao": {
        email: "ana@banco.ao",
        phone: "+244 923 000 111",
        password: "123",
        fullName: "Ana Paula Santos",
        bi: "004589123LA042",
        nif: "004589123LA042",
        iban: "AO06004000001234567810145",
        balanceAOA: 50000.00,
        usedLimitUSD: 0,
        transactions: []
      }
    },
    wuDatabase: {
      "1234567890": {
        mtcn: "1234567890",
        senderName: "Carlos Manuel Silva",
        originCountry: "Portugal",
        receiverName: "Ana Paula Santos",
        amountOrigin: 200.00,
        currency: "EUR",
        status: "AVAILABLE"
      }
    },
    activeOtps: {}
  };
}

let state = getInitialState();

// Obter taxas de câmbio e limites BNA
app.get('/api/v1/rates', (req, res) => {
  res.json({ rates: EXCHANGE_RATES, dailyLimitUSD: DAILY_LIMIT_USD });
});

// Zerar simulação
app.post('/api/v1/reset', (req, res) => {
  state = getInitialState();
  res.json({ message: "Sistema reiniciado com sucesso!" });
});

// Cadastro de Novo Cliente (KYC Completo)
app.post('/api/v1/auth/register', (req, res) => {
  const { fullName, email, phone, bi, password } = req.body;

  if (!fullName || !email || !phone || !bi || !password) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios de KYC." });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (state.users[cleanEmail]) {
    return res.status(400).json({ error: "Já existe uma conta registada com este e-mail." });
  }

  const randomDigits = Math.floor(1000000000000000 + Math.random() * 9000000000000000);
  const generatedIban = "AO060040" + randomDigits.toString().slice(0, 17);

  const newUser = {
    email: cleanEmail,
    phone: phone.trim(),
    password: password.trim(),
    fullName: fullName.trim(),
    bi: bi.trim().toUpperCase(),
    nif: bi.trim().toUpperCase(),
    iban: generatedIban,
    balanceAOA: 50000.00,
    usedLimitUSD: 0,
    transactions: []
  };

  state.users[cleanEmail] = newUser;
  res.status(201).json({ user: newUser });
});

// Login
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();
  const user = state.users[cleanEmail];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Credenciais inválidas. Verifique o e-mail e a palavra-passe." });
  }

  res.json({ user, rates: EXCHANGE_RATES, dailyLimitUSD: DAILY_LIMIT_USD });
});

// Enviar Remessa (Multi-Moeda: USD, EUR, GBP)
app.post('/api/v1/remittances/send', (req, res) => {
  const { senderName, originCountry, receiverName, amountOrigin, currency } = req.body;

  if (!senderName || !originCountry || !receiverName || !amountOrigin || amountOrigin <= 0) {
    return res.status(400).json({ error: "Preencha todos os dados da remessa." });
  }

  const validCurrency = EXCHANGE_RATES[currency] ? currency : "USD";

  let newMtcn;
  do {
    newMtcn = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } while (state.wuDatabase[newMtcn]);

  const newRemittance = {
    mtcn: newMtcn,
    senderName: senderName.trim(),
    originCountry: originCountry.trim(),
    receiverName: receiverName.trim(),
    amountOrigin: parseFloat(amountOrigin),
    currency: validCurrency,
    status: "AVAILABLE"
  };

  state.wuDatabase[newMtcn] = newRemittance;
  res.status(201).json({ remittance: newRemittance });
});

// Gerar/Reenviar OTP
app.post('/api/v1/otp/generate', (req, res) => {
  const { userEmail, channel } = req.body;
  const user = state.users[userEmail];
  if (!user) return res.status(401).json({ error: "Utilizador não autenticado." });

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  state.activeOtps[userEmail] = generatedOtp;

  const destination = channel === 'sms' ? user.phone : user.email;
  const channelLabel = channel === 'sms' ? 'SMS' : 'E-mail';

  res.json({ simulatedOtp: generatedOtp, destination, channelLabel });
});

// Consultar MTCN + Validação Sobrenome + Limite BNA + Disparo OTP
app.post('/api/v1/remittances/inquire', (req, res) => {
  const { mtcn, lastName, userEmail, otpChannel } = req.body;
  const user = state.users[userEmail];
  const remittance = state.wuDatabase[mtcn];

  if (!user) return res.status(401).json({ error: "Sessão expirada." });
  if (!lastName || !lastName.trim()) return res.status(400).json({ error: "Informe o sobrenome do beneficiário." });
  if (!remittance) return res.status(404).json({ error: "Código MTCN não encontrado na Western Union." });
  if (remittance.status !== "AVAILABLE") return res.status(400).json({ error: "Esta remessa já foi levantada." });

  // Valida sobrenome
  const receiverParts = remittance.receiverName.trim().toLowerCase().split(/\s+/);
  const actualLastName = receiverParts[receiverParts.length - 1];
  if (lastName.trim().toLowerCase() !== actualLastName) {
    return res.status(403).json({ error: "Sobrenome incorreto para este código MTCN." });
  }

  // Valida titularidade KYC
  if (remittance.receiverName.toLowerCase() !== user.fullName.toLowerCase()) {
    return res.status(403).json({
      error: `Bloqueio Compliance (BNA): Beneficiário "${remittance.receiverName}" diverge do titular "${user.fullName}".`
    });
  }

  // Valida Limite Diário BNA
  const rate = EXCHANGE_RATES[remittance.currency] || 915.00;
  const amountAOA = remittance.amountOrigin * rate;
  const equivalentUSD = amountAOA / EXCHANGE_RATES.USD;

  if (user.usedLimitUSD + equivalentUSD > DAILY_LIMIT_USD) {
    return res.status(403).json({
      error: `Limite Diário BNA excedido (${DAILY_LIMIT_USD} USD/dia). Dirija-se a um balcão para validação adicional.`
    });
  }

  // Gera OTP automático
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  state.activeOtps[userEmail] = generatedOtp;
  const destination = otpChannel === 'sms' ? user.phone : user.email;
  const channelLabel = otpChannel === 'sms' ? 'SMS' : 'E-mail';

  res.json({
    ...remittance,
    exchangeRate: rate,
    amountAOA,
    otpInfo: { code: generatedOtp, destination, channelLabel }
  });
});

// Liquidar e Creditar na Conta (Via OTP ou Biometria)
app.post('/api/v1/remittances/payout', (req, res) => {
  const { mtcn, otpCode, authMethod, userEmail } = req.body;
  const user = state.users[userEmail];
  const remittance = state.wuDatabase[mtcn];

  if (!user) return res.status(401).json({ error: "Sessão expirada." });

  // Valida autenticação (Biometria ou Código OTP)
  if (authMethod !== 'biometric') {
    const expectedOtp = state.activeOtps[userEmail];
    if (!expectedOtp || otpCode !== expectedOtp) {
      return res.status(401).json({ error: "Código OTP incorreto. Verifique a notificação recebida." });
    }
  }

  if (!remittance || remittance.status !== "AVAILABLE") return res.status(400).json({ error: "Remessa indisponível." });

  const rate = EXCHANGE_RATES[remittance.currency] || 915.00;
  const amountAOA = remittance.amountOrigin * rate;
  const equivalentUSD = amountAOA / EXCHANGE_RATES.USD;

  const transactionId = "TXN-AO-" + Math.floor(100000 + Math.random() * 900000);
  const timestamp = new Date().toLocaleString('pt-AO');

  delete state.activeOtps[userEmail];
  remittance.status = "PAID";
  user.balanceAOA += amountAOA;
  user.usedLimitUSD += equivalentUSD;

  const newTx = {
    transactionId,
    mtcn,
    senderName: remittance.senderName,
    originCountry: remittance.originCountry,
    receiverName: user.fullName,
    amountOrigin: `${remittance.amountOrigin.toFixed(2)} ${remittance.currency}`,
    exchangeRate: rate,
    creditedAmountAOA: amountAOA,
    authUsed: authMethod === 'biometric' ? 'Biometria Digital' : 'Código OTP 2FA',
    timestamp
  };
  user.transactions.unshift(newTx);

  res.json({
    ...newTx,
    newBalanceAOA: user.balanceAOA,
    usedLimitUSD: user.usedLimitUSD,
    transactions: user.transactions
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor Mobile Banking + WU ativo na porta ' + PORT);
});
