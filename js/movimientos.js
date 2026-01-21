function registrarMovimiento(event) {
  event.preventDefault();

  const mov = {
    codigo: codigoMov.value.trim().toUpperCase(),
    fecha: fechaMov.value,
    tipo: tipoMov.value,
    cantidad: parseFloat(cantMov.value),
    observaciones: obsMov.value
  };

  google.script.run.withSuccessHandler(msg => {
    showMessage('msgMov', msg, 'success');
  }).registrarMovimiento(mov);
}

function buscarProductoAutocompletado() {
  const codigo = codigoMov.value.trim().toUpperCase();
  if (!codigo) return;

  google.script.run.withSuccessHandler(mostrarAutocompletado)
    .buscarProductoPorCodigo(codigo);
}
