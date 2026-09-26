// ═══════════════════════════════════════════
// REFERENCIAS.JS — filtro de categorias das referências
// ═══════════════════════════════════════════

function filterRefs(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.ref-section').forEach(s => {
    s.classList.toggle('hidden', cat !== 'all' && s.dataset.cat !== cat);
  });
  document.querySelectorAll('.ref-div-el').forEach(d => {
    d.style.display = cat === 'all' ? '' : 'none';
  });
}
