/* ═══════════════════════════════════════════
   AGROTECH — EFEITOS DOS CARDS
   Cards aparecem suavemente ao rolar a página.
   Arquivo independente: nao mexe no main.js.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  var SELETOR = '.feat-card, .mat-card, .member-card, .ref-card, .spec-card';
  var semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function iniciar() {
    var cards = document.querySelectorAll(SELETOR);
    if (!cards.length) return;

    if (semAnimacao || !('IntersectionObserver' in window)) return;

    cards.forEach(function (card) { card.classList.add('fx-reveal'); });

    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var alvo = entrada.target;
        var atraso = (Number(alvo.dataset.fxOrdem) || 0) * 70;
        setTimeout(function () { alvo.classList.add('fx-in'); }, atraso);
        obs.unobserve(alvo);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    /* ordem dentro de cada grade, pra entrarem em cascata */
    document.querySelectorAll('.features-grid, .mat-grid, .team-grid, .ref-grid, .specs-grid')
      .forEach(function (grade) {
        Array.prototype.forEach.call(grade.children, function (filho, i) {
          if (filho.matches(SELETOR)) filho.dataset.fxOrdem = i;
        });
      });

    cards.forEach(function (card) { obs.observe(card); });

    /* rede de segurança: se algo falhar, mostra tudo depois de 2,5s */
    setTimeout(function () {
      document.querySelectorAll('.fx-reveal:not(.fx-in)').forEach(function (c) {
        c.classList.add('fx-in');
      });
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
