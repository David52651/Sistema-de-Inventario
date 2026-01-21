function inicializarSistema() {
  if (!confirm("¿Inicializar sistema?")) return;

  google.script.run.withSuccessHandler(msg => {
    showMessage('configResults', msg, 'success');
  }).inicializarHojas();
}
