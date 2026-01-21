function mostrarHistorial() {
  const filtros = {
    fechaDesde: fechaDesde.value,
    fechaHasta: fechaHasta.value,
    tipo: filtroTipo.value
  };

  google.script.run.withSuccessHandler(displayHistorialTable)
    .obtenerHistorial(filtros);
}
