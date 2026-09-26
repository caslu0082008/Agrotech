/* ═══════════════════════════════════════════
   AGROTECH — EFEITO DE CHUVA
   Canvas fixo cobrindo o site inteiro, atras do
   conteudo (pointer-events desligado, nao atrapalha
   cliques). A chuva "desvia" dos paineis de conteudo
   (cards, nav, hero, modal) pra nao riscar o texto.
   Se adapta ao tema claro/escuro e respeita
   prefers-reduced-motion. Arquivo independente.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  var semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (semAnimacao) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'chuva-fx';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '450',
    pointerEvents: 'none'
  });

  var ctx = canvas.getContext('2d');
  var gotas = [];
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var largura, altura;
  var pausado = document.hidden;
  var ehClaro = document.documentElement.getAttribute('data-theme') === 'light';

  /* paineis onde a chuva nao pode desenhar por cima (fica "atras" deles) */
  var SELETORES_PROTEGIDOS = [
    '.feature-editorial', '.material-editorial', '.feat-card', '.mat-card', '.member-card', '.ref-card', '.spec-card',
    '.stats-bar', '.hero-content', '.cta-content', '.game-content',
    '.login-modal', 'nav'
  ].join(',');
  var protegidos = [];

  function atualizarProtegidos() {
    var els = document.querySelectorAll(SELETORES_PROTEGIDOS);
    var novo = [];
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.width && r.height) {
        novo.push({ left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4 });
      }
    }
    protegidos = novo;
  }

  function dentroProtegido(x, y) {
    for (var i = 0; i < protegidos.length; i++) {
      var r = protegidos[i];
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  }

  function corGota() {
    return ehClaro ? 'rgba(60, 95, 70, ALPHA)' : 'rgba(200, 235, 210, ALPHA)';
  }

  function numGotas() {
    var area = largura * altura;
    var base = Math.round(area / 9000);
    return Math.max(40, Math.min(base, window.innerWidth < 760 ? 90 : 170));
  }

  function criarGota() {
    return {
      x: Math.random() * largura,
      y: Math.random() * altura,
      comprimento: 10 + Math.random() * 18,
      velocidade: 4 + Math.random() * 5,
      espessura: Math.random() < 0.15 ? 1.6 : 1,
      alpha: 0.12 + Math.random() * 0.22,
      vento: 0.6
    };
  }

  function ajustarTamanho() {
    largura = window.innerWidth;
    altura = window.innerHeight;
    canvas.width = largura * DPR;
    canvas.height = altura * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    var alvo = numGotas();
    if (gotas.length < alvo) {
      while (gotas.length < alvo) gotas.push(criarGota());
    } else {
      gotas.length = alvo;
    }
    atualizarProtegidos();
  }

  function desenhar() {
    ctx.clearRect(0, 0, largura, altura);
    for (var i = 0; i < gotas.length; i++) {
      var g = gotas[i];

      if (!dentroProtegido(g.x, g.y) && !dentroProtegido(g.x + g.vento, g.y + g.comprimento)) {
        ctx.strokeStyle = corGota().replace('ALPHA', g.alpha);
        ctx.lineWidth = g.espessura;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + g.vento, g.y + g.comprimento);
        ctx.stroke();
      }

      g.x += g.vento;
      g.y += g.velocidade;

      if (g.y > altura + g.comprimento) {
        g.y = -g.comprimento;
        g.x = Math.random() * largura;
      }
      if (g.x > largura) g.x = 0;
    }
  }

  var contadorFrames = 0;
  function loop() {
    if (!pausado) {
      /* recalcula os paineis protegidos periodicamente (scroll, revelacao de cards etc.) */
      if (contadorFrames % 20 === 0) atualizarProtegidos();
      contadorFrames++;
      desenhar();
    }
    requestAnimationFrame(loop);
  }

  function atualizarTema() {
    ehClaro = document.documentElement.getAttribute('data-theme') === 'light';
  }

  function iniciar() {
    document.body.appendChild(canvas);
    ajustarTamanho();
    requestAnimationFrame(loop);

    window.addEventListener('resize', ajustarTamanho);
    window.addEventListener('scroll', atualizarProtegidos, { passive: true });
    document.addEventListener('visibilitychange', function () {
      pausado = document.hidden;
    });

    /* observa mudanca de tema (atributo data-theme no <html>) */
    var obs = new MutationObserver(atualizarTema);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
