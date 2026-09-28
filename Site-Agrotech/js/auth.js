// ═══════════════════════════════════════════
// AUTH.JS — integração do frontend com o backend
// de autenticação do AgroTech.
// Carregado em todas as páginas, antes do main.js.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // Ajuste esta constante se o backend rodar em outro host/porta.
  // Como usamos cookies httpOnly de sessão, "credentials: include" é obrigatório.
  const local = ['localhost', '127.0.0.1', '[::1]']
  .includes(window.location.hostname);

const base = local
  ? window.location.protocol + '//' + window.location.hostname + ':3000'
  : window.location.origin;

const API_ROOT = (window.AGROTECH_API_BASE_URL || base)
  .replace(/\/$/, '');

  const API_BASE_URL = API_ROOT + '/api/auth';
  let sessionRequest = null;
  function returnTarget() {
    const raw = new URLSearchParams(window.location.search).get('next');
    if (!raw) return null;
    try {
      const url = new URL(raw, window.location.href);
      const allowed = ['agrotruck.html','admin.html'].map(name => new URL(name, window.location.href).pathname);
      return url.origin === window.location.origin && allowed.includes(url.pathname) ? url.pathname + url.search + url.hash : null;
    } catch (_) { return null; }
  }
  function notify(message) {
    let el = document.getElementById('authStatus');
    if (!el) { if (!message) return; el = document.createElement('div'); el.id='authStatus'; el.className='auth-status'; el.setAttribute('role','alert'); document.body.appendChild(el); }
    el.textContent=message; el.hidden=!message;
  }

  let currentUser = null;
  let submitting = false; // evita envio duplicado de formulário

  // ── helpers de UI ──

  function setLoading(form, isLoading) {
    const btn = form.querySelector('.submit-btn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('is-loading', isLoading);
  }

  function showError(errorEl, message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }

  function hideError(errorEl) {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }

  function showSuccess(successEl, message) {
    if (!successEl) return;
    if (message) successEl.querySelector('.form-success-text').textContent = message;
    successEl.style.display = 'flex';
  }

  function hideSuccess(successEl) {
    if (!successEl) return;
    successEl.style.display = 'none';
  }

  // Mensagem amigável para erros de rede (backend fora do ar, CORS, etc.)
  const NETWORK_ERROR_MSG = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

  async function apiRequest(path, { method = 'GET', body, admin = false } = {}) {
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      response = await fetch((admin ? API_ROOT + '/api/admin' : API_BASE_URL) + path, {
        method,
        credentials: 'include', cache: 'no-store', signal: controller.signal,
        headers: method !== 'GET' ? { 'Content-Type': 'application/json', 'X-AgroTech-Request': '1' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const err = new Error(networkErr.name === 'AbortError'
        ? 'O servidor demorou demais para responder. Tente novamente em instantes. Se persistir, o servi?o pode estar indispon?vel.'
        : NETWORK_ERROR_MSG);
      err.isNetworkError = true;
      throw err;
    } finally { clearTimeout(timeout); }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message = (data && data.message) || 'Ocorreu um erro. Tente novamente.';
      const err = new Error(message);
      err.status = response.status;
      err.details = data && data.errors;
      throw err;
    }

    return data;
  }

  // ── troca de views dentro do modal (login / cadastro / esqueci senha) ──

  function showView(viewName) {
    document.querySelectorAll('.auth-view').forEach((el) => {
      el.hidden = el.dataset.view !== viewName;
    });
    // limpa mensagens de erro/sucesso ao trocar de view
    ['loginError', 'registerError', 'registerSuccess', 'forgotError', 'forgotSuccess'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.classList.contains('form-success')) el.style.display = 'none';
      else { el.textContent = ''; el.classList.remove('show'); }
    });
    const titleEl = document.getElementById('loginTitle');
    if (titleEl && viewName === 'login') {
      const overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.setAttribute('aria-label', 'Entrar');
    }
    return false; // permite uso direto em onclick="return AgroAuth.showView(...)"
  }

  // ── estado de sessão / nav ──

  function updateNavForUser(user) {
    currentUser = user;
    document.querySelectorAll('[data-admin-link]').forEach(el => { el.hidden = user?.role !== 'admin'; });
    if (!user) ['agroContent','adminContent'].forEach(id => { const el=document.getElementById(id); if(el) el.hidden=true; });
    const firstName = user ? ((user.nome || '').trim().split(/\s+/)[0] || 'Conta') : '';

    // botão "Entrar" — some quando logado, único ponto de entrada quando não
    const authBtn = document.getElementById('navAuthBtn');
    const authBtnMobile = document.getElementById('navAuthBtnMobile');
    [authBtn, authBtnMobile].forEach((el) => { if (el) el.hidden = !!user; });

    // botão destacado "Meu Agrotruck" — só aparece logado
    const agroBtn = document.getElementById('navAgrotruckBtn');
    const agroBtnMobile = document.getElementById('navAgrotruckBtnMobile');
    [agroBtn, agroBtnMobile].forEach((el) => { if (el) el.hidden = !user; });

    // área do usuário (nome + sair) — só aparece logado
    const userArea = document.getElementById('navUser');
    const userAreaMobile = document.getElementById('navUserMobile');
    [userArea, userAreaMobile].forEach((el) => { if (el) el.hidden = !user; });

    const nameEl = document.getElementById('navUserName');
    const nameElMobile = document.getElementById('navUserNameMobile');
    [nameEl, nameElMobile].forEach((el) => { if (el) el.textContent = firstName; });
  }

  function onNavAuthClick() {
    if (currentUser) {
      logout();
    } else {
      openLoginModal();
    }
  }

  async function logout() {
    try { await apiRequest('/logout', {method:'POST'}); updateNavForUser(null); window.location.replace('index.html'); }
    catch(err) { if (err.status === 401) { updateNavForUser(null); window.location.replace('index.html'); return; } notify('Não foi possível encerrar a sessão. ' + err.message); }
  }
  function refreshSession() {
    if(sessionRequest) return sessionRequest;
    sessionRequest=apiRequest('/me').then(data=>{ updateNavForUser(data.user); notify(''); return data.user; })
      .catch(err=>{ if(err.status===401) { updateNavForUser(null); return null; } throw err; })
      .finally(()=>{ sessionRequest=null; });
    return sessionRequest;
  }

  function openLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    showView('login');
  }

  function closeLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── handlers de formulário ──

  function bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const errorEl = document.getElementById('loginError');
      hideError(errorEl);

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const remember = document.getElementById('loginRemember').checked;

      if (!email || !password) {
        showError(errorEl, 'Preencha e-mail e senha.');
        return;
      }

      submitting = true;
      setLoading(form, true);
      try {
        const data = await apiRequest('/login', { method: 'POST', body: { email, password, remember } });
        if(sessionRequest) await sessionRequest.catch(()=>{});
        const verified=await refreshSession();
        if(!verified) throw new Error('O navegador não manteve o cookie da sessão. Use o mesmo host para o site e a API.');
        closeLoginModal();
        form.reset();
        if(returnTarget()) window.location.assign(returnTarget());
      } catch (err) {
        if (err.status === 401) {
          showError(errorEl, 'E-mail ou senha inválidos.');
        } else if (err.status === 429) {
          showError(errorEl, err.message);
        } else if (err.status === 422) {
          showError(errorEl, 'Verifique os campos preenchidos.');
        } else {
          showError(errorEl, err.message || NETWORK_ERROR_MSG);
        }
      } finally {
        submitting = false;
        setLoading(form, false);
      }
    });
  }

  function bindRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const errorEl = document.getElementById('registerError');
      const successEl = document.getElementById('registerSuccess');
      hideError(errorEl);
      hideSuccess(successEl);

      const nome = document.getElementById('registerNome').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;

      if (!nome || !email || !password) {
        showError(errorEl, 'Preencha todos os campos.');
        return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        showError(errorEl, 'A senha deve ter pelo menos 8 caracteres, com letras e números.');
        return;
      }

      submitting = true;
      setLoading(form, true);
      try {
        await apiRequest('/register', { method: 'POST', body: { nome, email, password } });
        showSuccess(successEl, 'Conta criada com sucesso! Você já pode entrar.');
        form.reset();
        setTimeout(() => {
          showView('login');
          const loginEmail = document.getElementById('loginEmail');
          if (loginEmail) loginEmail.value = email;
        }, 1400);
      } catch (err) {
        if (err.status === 409) {
          showError(errorEl, 'Já existe uma conta com este e-mail.');
        } else if (err.status === 422) {
          const first = err.details && err.details[0];
          showError(errorEl, (first && first.message) || 'Verifique os campos preenchidos.');
        } else {
          showError(errorEl, err.message || NETWORK_ERROR_MSG);
        }
      } finally {
        submitting = false;
        setLoading(form, false);
      }
    });
  }

  function bindForgotForm() {
    const form = document.getElementById('forgotForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const errorEl = document.getElementById('forgotError');
      const successEl = document.getElementById('forgotSuccess');
      hideError(errorEl);
      hideSuccess(successEl);

      const email = document.getElementById('forgotEmail').value.trim();
      if (!email) {
        showError(errorEl, 'Informe seu e-mail.');
        return;
      }

      submitting = true;
      setLoading(form, true);
      try {
        await apiRequest('/forgot-password', { method: 'POST', body: { email } });
        showSuccess(successEl);
        form.reset();
      } catch (err) {
        showError(errorEl, err.message || NETWORK_ERROR_MSG);
      } finally {
        submitting = false;
        setLoading(form, false);
      }
    });
  }

  // ── proteção de páginas exclusivas (ex.: agrotruck.html) ──
  // Chama /me no backend de verdade; NUNCA decide só pelo estado do botão
  // escondido no HTML, porque isso não é proteção nenhuma.
  async function requireAuthOrRedirect() {
    const user=await refreshSession();
    if(user) return user;
    const next=encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('index.html?login=1&next=' + next);
    return null;
  }


  document.addEventListener('DOMContentLoaded', async () => {
    bindLoginForm();
    bindRegisterForm();
    bindForgotForm();
    try { await refreshSession(); } catch(err) { notify(err.message); }

    // se a URL pedir o modal de login (redirecionado de uma página protegida)
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') { if(!currentUser) openLoginModal(); else if(returnTarget()) window.location.replace(returnTarget()); }
  });

  // API pública usada nos atributos onclick do HTML e pelo main.js
  window.AgroAuth = {
    refreshSession,
    returnTarget,
    showView,
    onNavAuthClick,
    openLoginModal,
    closeLoginModal,
    logout,
    apiRequest,
    getCurrentUser: () => currentUser,
    requireAuthOrRedirect,
  };
})();
