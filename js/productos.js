function loadListas() {
  google.script.run.withSuccessHandler(data => {
    const unidad = document.getElementById("unidadProd");
    const grupo = document.getElementById("grupoProd");

    unidad.innerHTML = "";
    grupo.innerHTML = "";

    data.unidades.forEach(u => unidad.innerHTML += `<option>${u}</option>`);
    data.grupos.forEach(g => grupo.innerHTML += `<option>${g}</option>`);
  }).obtenerListas();
}

function registrarProducto(event) {
  event.preventDefault();

  const producto = {
    codigo: codigoProd.value.trim().toUpperCase(),
    nombre: nombreProd.value.trim(),
    unidad: unidadProd.value,
    grupo: grupoProd.value,
    stockMin: parseInt(stockMinProd.value) || 0
  };

  google.script.run.withSuccessHandler(msg => {
    showMessage('msgProd', msg, msg.includes('correctamente') ? 'success' : 'error');
  }).registrarProducto(producto);
}
