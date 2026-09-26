// ═══════════════════════════════════════════
// MAIN.JS — funcionalidades gerais do site
// (tema, menu mobile, modal de login)
// Carregado em todas as páginas.
// ═══════════════════════════════════════════

// ── tema (claro/escuro) ──
const root = document.documentElement;
const THEME_KEY = 'agrotech-theme';
let isDark = localStorage.getItem(THEME_KEY) !== 'light';

const ICON_SUN  = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
const ICON_MOON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

// troca qual video do hero esta tocando conforme o tema ativo
function syncHeroVideos() {
  document.querySelectorAll('.hero-video-dark').forEach(v => {
    if (isDark) { v.play().catch(() => {}); } else { v.pause(); }
  });
  document.querySelectorAll('.hero-video-light').forEach(v => {
    if (!isDark) { v.play().catch(() => {}); } else { v.pause(); }
  });
}

// aplica o tema salvo assim que o main.js roda (o <head> já evitou o "flash")
(function initTheme() {
  root.setAttribute('data-theme', isDark ? '' : 'light');
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
    btn.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  }
  syncHeroVideos();
})();

function toggleTheme() {
  isDark = !isDark;
  root.setAttribute('data-theme', isDark ? '' : 'light');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  const btn = document.querySelector('.theme-toggle');
  btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
  btn.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  syncHeroVideos();
}

// ── modal de login (a lógica de autenticação em si vive em js/auth.js) ──
function openLogin() {
  window.AgroAuth.openLoginModal();
}
function closeLogin() {
  window.AgroAuth.closeLoginModal();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLogin();
});

// ── menu hamburguer (mobile) ──
let menuOpen = false;
function toggleMenu() {
  menuOpen = !menuOpen;
  document.getElementById('mobileMenu').classList.toggle('open', menuOpen);
}
function closeMenu() {
  menuOpen = false;
  document.getElementById('mobileMenu').classList.remove('open');
}

// fecha o menu ao clicar fora
document.addEventListener('click', e => {
  const menu = document.getElementById('mobileMenu');
  const burger = document.querySelector('.hamburger');
  if (menuOpen && menu && burger && !menu.contains(e.target) && !burger.contains(e.target)) closeMenu();
});
