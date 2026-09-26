// ═══════════════════════════════════════════
// CONTATO.JS — funcionalidades da página de contato
// ═══════════════════════════════════════════

function formSuccess(btn) {
  const id = btn.nextElementSibling.id;
  document.getElementById(id).style.display = 'flex';
  setTimeout(() => { document.getElementById(id).style.display = 'none'; }, 4000);
}
