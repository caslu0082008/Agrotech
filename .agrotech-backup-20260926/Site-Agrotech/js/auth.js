// ═══════════════════════════════════════════
// AUTH.JS — integração do frontend com o backend
// de autenticação do AgroTech.
// Carregado em todas as páginas, antes do main.js.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // Ajuste esta constante se o backend rodar em outro host/porta.
  // Como usamos cookies httpOnly de sessão, "credentials: include" é obrigatório.
  const API_BASE_URL = (window.AGROTECH_API_BASE_URL || 'http://localhost:3000') + '/api/auth';

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

  async function apiRequest(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const err = new Error(NETWORK_ERROR_MSG);
      err.isNetworkError = true;
      throw err;
    }

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
    try {
      await apiRequest('/logout', { method: 'POST' });
    } catch (_) {
      // mesmo se der erro de rede, limpamos o estado local
    }
    updateNavForUser(null);
  }

  async function refreshSession() {
    try {
      const data = await apiRequest('/me', { method: 'GET' });
      updateNavForUser(data.user);
    } catch (_) {
      updateNavForUser(null);
    }
  }

  // ── abrir/fechar modal (usado por main.js) ──

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
        updateNavForUser(data.user);
        closeLoginModal();
        form.reset();
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
    try {
      const data = await apiRequest('/me', { method: 'GET' });
      updateNavForUser(data.user);
      return data.user;
    } catch (_) {
      updateNavForUser(null);
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `index.html?login=1&next=${next}`;
      return null;
    }
  }

  // ── inicialização ──
  document.addEventListener('DOMContentLoaded', async () => {
    bindLoginForm();
    bindRegisterForm();
    bindForgotForm();
    await refreshSession();

    // se a URL pedir o modal de login (redirecionado de uma página protegida)
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' && !currentUser) openLoginModal();
  });

  // API pública usada nos atributos onclick do HTML e pelo main.js
  window.AgroAuth = {
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
