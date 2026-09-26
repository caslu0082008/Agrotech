// ═══════════════════════════════════════════
// AGROTRUCK.JS — lógica da página "Meu Agrotruck"
// 1) protege a página de verdade (checa /api/auth/me no backend)
// 2) botões de copiar SSID / senha / IP
// 3) tentativa honesta de checar se o ESP32 está respondendo
// ═══════════════════════════════════════════
(function () {
  'use strict';

  const ESP_WS_URL = 'ws://192.168.4.1:81/';
  const ESP_CHECK_TIMEOUT_MS = 2500;

  function revealContent(user) {
    document.getElementById('agroGate').hidden = true;
    const content = document.getElementById('agroContent');
    content.hidden = false;
    const nameEl = document.getElementById('agroUserName');
    if (nameEl && user) {
      const firstName = (user.nome || '').trim().split(/\s+/)[0];
      if (firstName) nameEl.textContent = firstName;
    }
  }

  // ── proteção real da página: consulta o backend, não confia em nada local ──
  async function gate() {
    if (!window.AgroAuth) {
      // auth.js não carregou por algum motivo — não libera o conteúdo
      return;
    }
    const user = await window.AgroAuth.requireAuthOrRedirect();
    if (user) revealContent(user);
    // se não houver usuário, requireAuthOrRedirect já redirecionou pro login
  }

  // ── copiar SSID / senha / IP ──
  function bindCopyButtons() {
    document.querySelectorAll('.agro-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(value);
        } catch (_) {
          // fallback simples para navegadores/context sem permissão de clipboard
          const ta = document.createElement('textarea');
          ta.value = value;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (_) { /* nada a fazer */ }
          document.body.removeChild(ta);
        }
        const original = btn.textContent;
        btn.textContent = 'Copiado!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1600);
      });
    });
  }

  // ── verificação de conexão com o Agrotruck ──
  // Importante: isto só pode funcionar se a página estiver sendo servida em
  // HTTP (não HTTPS) e o navegador estiver de fato na rede "Agrotruck".
  // Navegadores bloqueiam WebSocket ws:// a partir de páginas https:// por
  // política de conteúdo misto — então, em produção (site em HTTPS), essa
  // checagem vai falhar mesmo com o robô ligado. Por isso a mensagem de erro
  // nunca afirma que o robô está desligado, apenas que não foi possível
  // confirmar a partir daqui.
  function bindCheckButton() {
    const btn = document.getElementById('checkEspBtn');
    const espDot = document.getElementById('espDot');
    const espText = document.getElementById('espStatusText');
    const wifiDot = document.getElementById('wifiDot');
    const httpsNote = document.getElementById('agroHttpsNote');
    if (!btn) return;

    // Em produção (site servido por HTTPS) o navegador bloqueia por política
    // de conteúdo misto qualquer WebSocket/fetch para o IP local do robô —
    // mesmo com o Agrotruck ligado e na mesma rede. Não adianta nem tentar:
    // desativamos o botão e explicamos, em vez de mostrar um erro confuso.
    if (window.location.protocol === 'https:') {
      btn.disabled = true;
      btn.title = 'Indisponível em HTTPS — use "Abrir painel" para confirmar diretamente.';
      if (httpsNote) httpsNote.hidden = false;
      return;
    }

    btn.addEventListener('click', () => {
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Verificando…';
      espText.textContent = 'verificando…';
      espDot.className = 'agro-status-dot pending';

      let settled = false;
      let socket;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { socket && socket.close(); } catch (_) {}
        espDot.className = 'agro-status-dot pending';
        espText.textContent = 'não foi possível confirmar por aqui';
        wifiDot.className = 'agro-status-dot pending';
        btn.disabled = false;
        btn.textContent = originalLabel;
      }, ESP_CHECK_TIMEOUT_MS);

      try {
        socket = new WebSocket(ESP_WS_URL);
        socket.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          espDot.className = 'agro-status-dot ok';
          espText.textContent = 'respondendo';
          wifiDot.className = 'agro-status-dot ok';
          btn.disabled = false;
          btn.textContent = originalLabel;
          try { socket.close(); } catch (_) {}
        };
        socket.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          espDot.className = 'agro-status-dot pending';
          espText.textContent = 'não foi possível confirmar por aqui';
          btn.disabled = false;
          btn.textContent = originalLabel;
        };
      } catch (_) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          espDot.className = 'agro-status-dot pending';
          espText.textContent = 'não foi possível confirmar por aqui';
          btn.disabled = false;
          btn.textContent = originalLabel;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindCopyButtons();
    bindCheckButton();
    gate();
  });
})();
