(function () {
  'use strict';
  const selector = '.feature-editorial,.material-editorial,.feat-card,.mat-card,.member-card,.ref-card,.spec-card,.mech-item,.contact-item,.agro-wifi-card,.agro-panel-cta,.agro-faq-item,.reset-card';
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  function init() {
    const states = [];
    let frame = 0, previous = 0;
    function animate(time) {
      const ease = 1 - Math.exp(-Math.min(time - previous || 16, 50) / 85);
      previous = time;
      let running = false;
      states.forEach(s => {
        if (!s.moving) return;
        s.x += (s.tx - s.x) * ease;
        s.y += (s.ty - s.y) * ease;
        s.lift += (s.targetLift - s.lift) * ease;
        s.card.style.transform = 'perspective(1000px) translateY(' + (-s.lift) + 'px) rotateX(' + s.x + 'deg) rotateY(' + s.y + 'deg)';
        s.card.style.setProperty('--tilt-shadow-x', (-s.y * 1.2) + 'px');
        if (Math.abs(s.x-s.tx)+Math.abs(s.y-s.ty)+Math.abs(s.lift-s.targetLift) < .025) {
          s.moving = false;
          if (!s.active) {
            s.card.style.removeProperty('transform');
            s.card.classList.remove('tilt-moving');
          }
        } else running = true;
      });
      frame = running ? requestAnimationFrame(animate) : 0;
    }
    function schedule(s) {
      s.moving = true;
      s.card.classList.add('tilt-moving');
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(animate); }
    }
    function leave(s) {
      s.active = false; s.tx = s.ty = s.targetLift = 0;
      s.card.classList.remove('tilt-active');
      schedule(s);
    }
    document.querySelectorAll(selector).forEach(card => {
      card.classList.add('tilt-card');
      const shine = document.createElement('span');
      shine.className = 'tilt-shine'; shine.setAttribute('aria-hidden','true');
      card.appendChild(shine);
      const s = {card,x:0,y:0,tx:0,ty:0,lift:0,targetLift:0,active:false,moving:false};
      states.push(s);
      card.addEventListener('pointerenter', e => {
        if (!fine.matches || reduced.matches || e.pointerType !== 'mouse') return;
        s.rect = card.getBoundingClientRect(); s.active = true; s.targetLift = 4;
        card.classList.add('tilt-active'); schedule(s);
      });
      card.addEventListener('pointermove', e => {
        if (!s.active) return;
        const x = Math.max(0,Math.min(1,(e.clientX-s.rect.left)/s.rect.width));
        const y = Math.max(0,Math.min(1,(e.clientY-s.rect.top)/s.rect.height));
        s.tx = (0.5-y)*12; s.ty = (x-0.5)*12;
        card.style.setProperty('--tilt-light-x',x*100+'%');
        card.style.setProperty('--tilt-light-y',y*100+'%');
        schedule(s);
      });
      card.addEventListener('pointerleave',()=>{ if(s.active) leave(s); });
      card.addEventListener('pointercancel',()=>{ if(s.active) leave(s); });
    });
    function reset() {
      cancelAnimationFrame(frame); frame=0;
      states.forEach(s=>{
        s.active=s.moving=false; s.x=s.y=s.tx=s.ty=s.lift=s.targetLift=0;
        s.card.style.removeProperty('transform');
        s.card.classList.remove('tilt-active','tilt-moving');
      });
    }
    reduced.addEventListener('change',reset); fine.addEventListener('change',reset);
    window.addEventListener('blur',reset);
    window.addEventListener('scroll',()=>states.forEach(s=>{if(s.active)leave(s);}),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
