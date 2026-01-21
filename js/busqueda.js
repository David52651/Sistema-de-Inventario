function buscarProducto() {
  const texto = document.getElementById("buscarTexto").value.trim();

  if (!texto) {
    showMessage('resultadosBusqueda', 'Ingrese un texto para buscar', 'warning');
    return;
  }

  google.script.run
    .withSuccessHandler(displaySearchResults)
    .withFailureHandler(err => {
      showMessage('resultadosBusqueda', 'Error: ' + err, 'error');
    })
    .buscarProducto(texto);
}

function buscarEnTiempoReal() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const texto = document.getElementById("buscarTexto").value.trim();

    if (texto.length >= 2) {
      buscarProducto();
    } else if (texto.length === 0) {
      document.getElementById("resultadosBusqueda").innerHTML = '';
    }
  }, 300);
}

function limpiarBusqueda() {
  document.getElementById("buscarTexto").value = "";
  document.getElementById("resultadosBusqueda").innerHTML = "";
}

/* ===== Renderizado de resultados ===== */

function displaySearchResults(data) {
  const container = document.getElementById("resultadosBusqueda");

  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="message warning">No se encontraron productos</div>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <th>Unidad</th>
          <th>Grupo</th>
          <th>Stock Mín.</th>
          <th>Stock Actual</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(prod => {
    const [codigo, nombre, unidad, grupo, stockMin, stockActual] = prod;

    let estado = 'Normal';
    let statusClass = 'status-normal';

    if (stockActual <= 0) {
      estado = 'Sin Stock';
      statusClass = 'status-zero';
    } else if (stockActual <= stockMin && stockMin > 0) {
      estado = 'Stock Bajo';
      statusClass = 'status-low';
    }

    html += `
      <tr class="${statusClass}">
        <td>${codigo}</td>
        <td>${nombre}</td>
        <td>${unidad}</td>
        <td>${grupo}</td>
        <td>${stockMin}</td>
        <td>${stockActual}</td>
        <td>${estado}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}


