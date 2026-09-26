(function () {
  'use strict';
  function init() {
    const rain = document.createElement('div');
    rain.id = 'chuva-fx';
    rain.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 70; i++) {
      const drop = document.createElement('i');
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDelay = -Math.random() * 6 + 's';
      drop.style.animationDuration = 2.8 + Math.random() * 3 + 's';
      drop.style.opacity = .15 + Math.random() * .2;
      drop.style.height = 12 + Math.random() * 16 + 'px';
      rain.appendChild(drop);
    }
    document.body.appendChild(rain);
    document.addEventListener('visibilitychange', function () {
      rain.classList.toggle('rain-paused', document.hidden);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
