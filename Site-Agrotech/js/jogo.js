// ═══════════════════════════════════════════
// JOGO.JS — demo de vídeo da página do jogo
// ═══════════════════════════════════════════

function startVideo(wrap) {
  const btn   = wrap.querySelector('.play-btn');
  const fill  = wrap.querySelector('.vp-fill');
  const timer = wrap.querySelector('.video-timer');
  if (btn.style.display === 'none') return;
  btn.style.display = 'none';
  fill.style.width = '100%';
  let elapsed = 0;
  const iv = setInterval(() => {
    elapsed++;
    const s = String(elapsed % 60).padStart(2,'0');
    timer.textContent = `0:${s} / 0:40`;
    if (elapsed >= 40) clearInterval(iv);
  }, 1000);
}
