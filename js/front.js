let currentTab = 'dashboard';
let searchTimeout;
let autocompleteTimeout;
let codigoEditando = null;
let chartMovTipo = null;
let chartFecha = null;



/* =========================
   INIT
========================= */
function initializeApp() {
  setDefaultDates();
  showTab('dashboard');
    loadUnidades();
  loadGrupos();
  loadMov();
  
}

/* =========================
   FECHAS
========================= */
function setDefaultDates() {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  document.getElementById("fechaMov").valueAsDate = today;
  document.getElementById("fechaDesde").valueAsDate = monthAgo;
  document.getElementById("fechaHasta").valueAsDate = today;
}

/* =========================
   TABS
========================= */
function showTab(tabName, el = null) {
  document.querySelectorAll('.tab-content').forEach(tab =>
    tab.classList.remove('active')
  );
  document.querySelectorAll('.nav-link').forEach(link =>
    link.classList.remove('active')
  );

  document.getElementById(tabName).classList.add('active');

  if (el) el.classList.add('active');

  currentTab = tabName;

  if (tabName === 'dashboard') {
    loadDashboard();
  }
}


/* =========================
   DASHBOARD (REAL)
========================= */
async function loadDashboard() {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;

  grid.innerHTML = `<div class="message info">Cargando dashboard...</div>`;

  try {
    // 1️⃣ Total productos activos
    const { count: totalProductos, error: errProd } = await db
      .from('Productos')
      .select('*', { count: 'exact', head: true })
      .eq('Estado', true);

    if (errProd) throw errProd;

    // 2️⃣ Total movimientos
    const { count: totalMovimientos, error: errMov } = await db
      .from('Movimientos')
      .select('*', { count: 'exact', head: true });

    if (errMov) throw errMov;

    // 3️⃣ Stock y stock mínimo
    const { data: productosStock, error: errStock } = await db
      .from('Productos')
      .select(`
        CodProduc,
        StockMin,
        Stocks ( Stock )
      `)
      .eq('Estado', true);

    if (errStock) throw errStock;

    let sinStock = 0;
    let stockBajo = 0;

    productosStock.forEach(p => {
      const stock = p.Stocks?.[0]?.Stock ?? 0;

      if (stock === 0) {
        sinStock++;
      } else if (stock <= (p.StockMin ?? 0)) {
        stockBajo++;
      }
    
    });

    // 4️⃣ Render final
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${totalProductos}</div>
        <div class="stat-label">Productos Activos</div>
      </div>

      <div class="stat-card">
        <div class="stat-value">${totalMovimientos}</div>
        <div class="stat-label">Movimientos Totales</div>
      </div>

      <div class="stat-card danger">
        <div class="stat-value">${sinStock}</div>
        <div class="stat-label">Sin Stock</div>
      </div>

      <div class="stat-card warning">
        <div class="stat-value">${stockBajo}</div>
        <div class="stat-label">Stock Bajo</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="message error">Error cargando dashboard</div>`;
  }
  await cargarGraficoMovimientosTipo();
  await cargarGraficoMovimientosFecha(30);
}

/* =========================
Graficos
========================= */
async function cargarGraficoMovimientosTipo() {
  const canvas = document.getElementById('graficoMovimientosTipo');
  if (!canvas) return;

  const { data, error } = await db
    .from('Movimientos')
    .select(`
      TipoMov:TipoMov!Movimientos_Tipo_fkey (
        Tipo
      )
    `);

  if (error) {
    console.error(error);
    return;
  }

  const conteo = {
    INGRESO: 0,
    SALIDA: 0,
    AJUSTE_POSITIVO: 0,
    AJUSTE_NEGATIVO: 0
  };

data
  .filter(m => m.TipoMov?.Tipo)
  .forEach(m => {
    const tipo = m.TipoMov.Tipo
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    if (conteo[tipo] !== undefined) {
      conteo[tipo]++;
    }
  });


  if (chartMovTipo) chartMovTipo.destroy();

  chartMovTipo = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Ingresos', 'Salidas', 'Ajustes +', 'Ajustes -'],
      datasets: [{
        label: 'Movimientos',
        data: [
          conteo.INGRESO,
          conteo.SALIDA,
          conteo.AJUSTE_POSITIVO,
          conteo.AJUSTE_NEGATIVO
        ]
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}



async function cargarGraficoMovimientosFecha(dias = 7) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const { data, error } = await db
    .from('Movimientos')
    .select('Fecha')
    .gte('Fecha', desde.toISOString())
    .order('Fecha');

  if (error) {
    console.error(error);
    return;
  }

  const conteoPorFecha = {};

  data.forEach(m => {
    const fecha = new Date(m.Fecha).toLocaleDateString();
    conteoPorFecha[fecha] = (conteoPorFecha[fecha] || 0) + 1;
  });

  const labels = Object.keys(conteoPorFecha);
  const valores = Object.values(conteoPorFecha);

  const ctx = document.getElementById('chartMovimientosFecha');

  if (chartFecha) chartFecha.destroy();

  chartFecha = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Movimientos',
        data: valores,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}





/* =========================
   AUTOCOMPLETE (UI)
========================= */
async function buscarProductoAutocompletado() {
  clearTimeout(autocompleteTimeout);

  const texto = codigoMov.value.trim();
  if (!texto) return ocultarAutocompletado();

  autocompleteTimeout = setTimeout(async () => {
    const { data, error } = await db
      .from('Productos')
      .select('id, Nombre')
      .ilike('Nombre', `%${texto}%`)
      .limit(5);

    if (error || !data.length) {
      ocultarAutocompletado();
      return;
    }

    mostrarAutocompletado(
      data.map(p => ({
        codigo: p.id,
        nombre: p.Nombre
      }))
    );
  }, 200);
}


function mostrarAutocompletado(productos = []) {
  const dropdown = document.getElementById("autocompleteDropdown");
  if (!productos.length) return dropdown.style.display = "none";

  dropdown.innerHTML = productos.map(p => `
    <div class="autocomplete-item" onmousedown="seleccionarProducto('${p.codigo}')">
      <div class="autocomplete-code">${p.codigo}</div>
      <div class="autocomplete-name">${p.nombre}</div>
    </div>
  `).join('');

  dropdown.style.display = "block";
}

function seleccionarProducto(codigo) {
  document.getElementById("codigoMov").value = codigo;
  ocultarAutocompletado();
}

function ocultarAutocompletado() {
  setTimeout(() => document.getElementById("autocompleteDropdown").style.display = "none", 150);
}

/* =========================
   CARGA DE SELECTS
========================= */
async function loadUnidades() {
  const { data, error } = await db
    .from('Unidades')
    .select('id, unidad')
    .order('id');

  const select = document.getElementById('unidadProd');
  select.innerHTML = '<option value="">Seleccionar unidad</option>';

  if (error) {
    console.error('Error cargando unidades:', error);
    return;
  }

  data.forEach(u => {
    const option = document.createElement('option');
    option.value = u.id;
    option.textContent = u.unidad;
    select.appendChild(option);
  });
}

async function loadGrupos() {
  const { data, error } = await db
    .from('Grupos')
    .select('id, Grupo')
    .order('id');

  const select = document.getElementById('grupoProd');
  select.innerHTML = '<option value="">Seleccionar grupo</option>';

  if (error) {
    console.error('Error cargando grupos:', error);
    return;
  }

  data.forEach(g => {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent = g.Grupo;
    select.appendChild(option);
  });
}


async function loadMov() {
  try {
    const { data, error } = await db
      .from('TipoMov')
      .select('id, Tipo')
      .order('id');

    if (error) throw error;

    const select = document.getElementById('tipoMov');
    select.innerHTML = '<option value="">Seleccionar tipo</option>';

    data.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;        // ID real (FK)
      option.textContent = t.Tipo; // Texto visible
      select.appendChild(option);
    });

  } catch (err) {
    console.error('Error cargando tipos de movimiento:', err);
  }
}


/* =========================
   FORM PRODUCTO
========================= */
async function registrarProducto(e) {
  e.preventDefault();

  const nombre = nombreProd.value.trim();
  if (!nombre) {
    return showMessage('msgProd', 'Nombre obligatorio', 'error');
  }

  const productoBase = {
    Nombre: nombre,
    Unidad: unidadProd.value || null,
    Grupo: grupoProd.value || null,
    StockMin: Number(stockMinProd.value) || 0
  };

  showMessage('msgProd', 'Guardando producto...', 'info');

  // 1️⃣ Insertar producto
  const { data, error } = await db
    .from('Productos')
    .insert(productoBase)
    .select('id')
    .single();

  if (error) {
    console.error(error);
    return showMessage('msgProd', error.message, 'error');
  }

  // 2️⃣ Generar código
  const acronimo = generarAcronimo(nombre);
  const codigoProducto = acronimo + formatearNumero(data.id);

  // 3️⃣ Actualizar código
  const { error: errorUpdate } = await db
    .from('Productos')
    .update({ CodProduc: codigoProducto })
    .eq('id', data.id);

  if (errorUpdate) {
    console.error(errorUpdate);
    return showMessage('msgProd', errorUpdate.message, 'error');
  }

  // 4️⃣ Crear stock inicial
  const { error: errorStock } = await db
    .from('Stocks')
    .insert({
      Producto: codigoProducto,
      Stock: 0
    });

  if (errorStock) {
    console.error(errorStock);
    return showMessage(
      'msgProd',
      'Producto creado, pero error al inicializar stock',
      'warning'
    );
  }

  // 5️⃣ OK
  showMessage(
    'msgProd',
    `Producto registrado correctamente (${codigoProducto})`,
    'success'
  );

  limpiarFormProducto();
}





/* =========================
   FORM MOVIMIENTO
========================= */
async function registrarMovimiento(e) {
  e.preventDefault();

  try {
    const codigo = codigoMov.value.trim().toUpperCase();
    const tipo = Number(tipoMov.value);
    const cantidad = Number(cantMov.value);
    const observaciones = obsMov?.value || null;

    if (!codigo || cantidad <= 0) {
      return showMessage('msgMov', 'Datos inválidos', 'error');
    }

    // 1️⃣ Validar producto
    await getProductoByCodigo(codigo);

    // 2️⃣ Obtener stock actual
    const { data: stockData, error: stockError } = await db
      .from('Stocks')
      .select('Stock')
      .eq('Producto', codigo)
      .single();

    if (stockError) throw new Error('No se pudo obtener el stock');

    const stockActual = Number(stockData.Stock) || 0;

    // 3️⃣ Calcular nuevo stock
    let nuevoStock = stockActual;

    if (tipo === 1) {
      nuevoStock += cantidad; // INGRESO
    } else if (tipo === 2) {
      nuevoStock -= cantidad; // SALIDA
      if (nuevoStock < 0) {
        throw new Error('Stock insuficiente');
      }
    }

    // 4️⃣ Actualizar stock
    const { error: updateStockError } = await db
      .from('Stocks')
      .update({ Stock: nuevoStock })
      .eq('Producto', codigo);

    if (updateStockError) throw updateStockError;
const { data: prod, error: errProd } = await db
  .from('Productos')
  .select('Estado')
  .eq('CodProduc', codigo)
  .single();

if (errProd || !prod || !prod.Estado) {
  throw new Error('El producto está eliminado o no existe');
}

    // 5️⃣ Registrar movimiento
    const { error: movError } = await db
      .from('Movimientos')
      .insert({
        CodProd: codigo,
        Tipo: tipo,
        Cantidad: cantidad,
        Stock: nuevoStock,
        Usuario: 'webtester',
        Observaciones: observaciones
      });

    if (movError) throw movError;

    showMessage('msgMov', 'Movimiento registrado correctamente', 'success');
    limpiarFormMovimiento();

  } catch (err) {
    console.error(err);
    showMessage('msgMov', err.message || 'Error al registrar movimiento', 'error');
  }
}

async function getProductoByCodigo(codigo) {
  const { data, error } = await db
    .from('Productos')
    .select('CodProduc')
    .eq('CodProduc', codigo)
    .single();

  if (error || !data) {
    throw new Error('Código de producto no existe');
  }

  return data.CodProduc;
}




/* =========================
   TABLAS (RENDER)
========================= */
function mostrarStock() {
  cargarInventario(false);
}
async function cargarInventario(soloAlertas = false) {
  document.getElementById('loading').style.display = 'block';

const { data, error } = await db
  .from('Productos')
  .select(`
    CodProduc,
    Nombre,
    StockMin,
    Estado,
    Unidades ( unidad ),
    Grupos ( Grupo ),
    Stocks ( Stock )
  `)
  .eq('Estado', true)
  .order('Nombre');

    
  document.getElementById('loading').style.display = 'none';

  if (error) {
    console.error(error);
    document.getElementById('stockTable').innerHTML =
      '<div class="message error">Error cargando inventario</div>';
    return;
  }

  const inventario = data.map(p => {
    const stock = p.Stocks?.[0]?.Stock ?? 0;

    let estado = 'OK';
    if (stock === 0) estado = 'SIN_STOCK';
    else if (stock <= p.StockMin) estado = 'BAJO';

    return {
      codigo: p.CodProduc,
      nombre: p.Nombre,
      unidad: p.Unidades?.unidad || '-',
      grupo: p.Grupos?.Grupo || '-',
      stockMin: p.StockMin,
      stock,
      estado
    };
  });

  const filtrado = soloAlertas
    ? inventario.filter(p => p.estado !== 'OK')
    : inventario;

  displayStockTable(filtrado, document.getElementById('stockTable'));
}
function displayStockTable(data, container) {
  if (!data.length) {
    container.innerHTML = '<div class="message warning">Sin datos</div>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <th>Unidad</th>
          <th>Grupo</th>
          <th>Stock Min</th>
          <th>Stock</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>${p.unidad}</td>
            <td>${p.grupo}</td>
            <td>${p.stockMin}</td>
            <td>${p.stock}</td>
            <td>${renderEstado(p.estado)}</td>
            <td>
              <button class="btn btn-sm btn-warning"
                onclick="editarProducto('${p.codigo}')">
                ✏️
              </button>
              <button class="btn btn-sm btn-danger"
                onclick="eliminarProducto('${p.codigo}')">
                🗑️
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderEstado(estado) {
  if (estado === 'SIN_STOCK') return '🔴 Sin stock';
  if (estado === 'BAJO') return '🟡 Bajo';
  return '🟢 OK';
}
function mostrarAlertas() {
  cargarInventario(true);
}

/* =========================
    Editar Produto
/* ========================= */
async function editarProducto(codigo) {
  codigoEditando = codigo;

  const { data: producto, error } = await db
    .from('Productos')
    .select('Nombre, Unidad, Grupo, StockMin')
    .eq('CodProduc', codigo)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  // Inputs
  document.getElementById('editNombre').value = producto.Nombre;
  document.getElementById('editStockMin').value = producto.StockMin;

  // Unidades
  const { data: unidades } = await db.from('Unidades').select('id, unidad');
  const selUnidad = document.getElementById('editUnidad');
  selUnidad.innerHTML = unidades
    .map(u =>
      `<option value="${u.id}" ${u.id === producto.Unidad ? 'selected' : ''}>
        ${u.unidad}
      </option>`
    ).join('');

  // Grupos
  const { data: grupos } = await db.from('Grupos').select('id, Grupo');
  const selGrupo = document.getElementById('editGrupo');
  selGrupo.innerHTML = grupos
    .map(g =>
      `<option value="${g.id}" ${g.id === producto.Grupo ? 'selected' : ''}>
        ${g.Grupo}
      </option>`
    ).join('');

  // Mostrar modal
  document.getElementById('modalEditar').classList.remove('hidden');
}
async function guardarEdicionProducto() {
  const nombre = document.getElementById('editNombre').value.trim();
  const unidad = Number(document.getElementById('editUnidad').value);
  const grupo = Number(document.getElementById('editGrupo').value);
  const stockMin = Number(document.getElementById('editStockMin').value);

  if (!nombre) {
    alert('Nombre obligatorio');
    return;
  }

  const { error } = await db
    .from('Productos')
    .update({
      Nombre: nombre,
      Unidad: unidad,
      Grupo: grupo,
      StockMin: stockMin
    })
    .eq('CodProduc', codigoEditando);

  if (error) {
    alert(error.message);
    return;
  }

  cerrarModalEditar();
  mostrarStock();
}

function cerrarModalEditar() {
  document.getElementById('modalEditar').classList.add('hidden');
  codigoEditando = null;
}

/* =========================
    Eliminar Producto
/* ========================= */

async function eliminarProducto(codigo) {
  const confirmar = confirm(
    `⚠️ ¿Seguro que deseas eliminar el producto ${codigo}?\n\n` +
    `• No se borrará de la base de datos\n` +
    `• No aparecerá en el inventario\n` +
    `• No podrá registrar movimientos`
  );

  if (!confirmar) return;

  // 1️⃣ Verificar que el producto exista y esté activo
  const { data: producto, error: errorProducto } = await db
    .from('Productos')
    .select('CodProduc, Estado')
    .eq('CodProduc', codigo)
    .single();

  if (errorProducto || !producto) {
    alert('Producto no encontrado');
    return;
  }

  if (!producto.Estado) {
    alert('El producto ya está desactivado');
    return;
  }

  // 2️⃣ Desactivar producto
  const { error } = await db
    .from('Productos')
    .update({ Estado: false })
    .eq('CodProduc', codigo);

  if (error) {
    console.error(error);
    alert('Error al eliminar producto');
    return;
  }

  // 3️⃣ Refrescar inventario
  mostrarStock();

  alert(`✅ Producto ${codigo} eliminado correctamente`);
}

/* =========================
    Exportar CSV
/* ========================= */
function mostrarEliminados() {
  cargarInventarioEliminados();
}
async function cargarInventarioEliminados() {
  document.getElementById('loading').style.display = 'block';

  const { data, error } = await db
    .from('Productos')
    .select(`
      CodProduc,
      Nombre,
      StockMin,
      Unidades ( unidad ),
      Grupos ( Grupo ),
      Stocks ( Stock )
    `)
    .eq('Estado', false)
    .order('Nombre');

  document.getElementById('loading').style.display = 'none';

  if (error) {
    console.error(error);
    document.getElementById('stockTable').innerHTML =
      '<div class="message error">Error cargando productos eliminados</div>';
    return;
  }

  const productos = data.map(p => ({
    codigo: p.CodProduc,
    nombre: p.Nombre,
    unidad: p.Unidades?.unidad || '-',
    grupo: p.Grupos?.Grupo || '-',
    stockMin: p.StockMin,
    stock: p.Stocks?.[0]?.Stock ?? 0
  }));

  displayEliminadosTable(productos, document.getElementById('stockTable'));
}
function displayEliminadosTable(data, container) {
  if (!data.length) {
    container.innerHTML =
      '<div class="message info">No hay productos eliminados</div>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <th>Unidad</th>
          <th>Grupo</th>
          <th>Stock Min</th>
          <th>Stock</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr class="row-disabled">
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>${p.unidad}</td>
            <td>${p.grupo}</td>
            <td>${p.stockMin}</td>
            <td>${p.stock}</td>
            <td>
              <button class="btn btn-sm btn-success"
                onclick="reactivarProducto('${p.codigo}')">
                ♻️ Reactivar
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
/* =========================
   Reactivar Producto
========================= */
async function reactivarProducto(codigo) {
  const confirmar = confirm(
    '♻️ ¿Deseas reactivar este producto?\n\nVolverá a aparecer en el inventario.'
  );

  if (!confirmar) return;

  const { error } = await db
    .from('Productos')
    .update({ Estado: true })
    .eq('CodProduc', codigo);

  if (error) {
    console.error(error);
    alert('Error al reactivar producto');
    return;
  }

  mostrarEliminados();
  alert('✅ Producto reactivado correctamente');
}




/* =========================
    Exportar CSV
/* ========================= */
async function exportarStock() {
  try {
    showMessage('msgInv', 'Generando CSV...', 'info');

    /* PRODUCTOS */
    const { data: productos, error: errProd } = await db
      .from('Productos')
      .select(`
        CodProduc,
        Nombre,
        StockMin,
        Unidad:Unidades ( unidad ),
        Grupo:Grupos ( Grupo )
      `);

    if (errProd) throw errProd;

    /* STOCKS */
    const { data: stocks, error: errStock } = await db
      .from('Stocks')
      .select('Producto, Stock');

    if (errStock) throw errStock;

    if (!productos.length) {
      return showMessage('msgInv', 'No hay datos para exportar', 'warning');
    }

    /* MAPA DE STOCK */
    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.Producto] = Number(s.Stock);
    });

    /* ARMAR CSV */
    const rows = productos.map(p => {
      const stockActual = stockMap[p.CodProduc] ?? 0;

      let estado = '🟢 OK';
      if (stockActual === 0) estado = '🔴 Sin stock';
      else if (stockActual <= (p.StockMin ?? 0)) estado = '🟡 Bajo';

      return {
        Codigo: p.CodProduc,
        Nombre: p.Nombre,
        Unidad: p.Unidad?.unidad ?? '',
        Grupo: p.Grupo?.Grupo ?? '',
        Stock_Minimo: p.StockMin ?? 0,
        Stock_Actual: stockActual,
        Estado: estado
      };
    });

    const csv = convertirACSV(rows);
    descargarCSV(csv, 'inventario.csv');

    showMessage('msgInv', 'CSV exportado correctamente', 'success');

  } catch (err) {
    console.error(err);
    showMessage('msgInv', err.message || 'Error al exportar CSV', 'error');
  }
}


function convertirACSV(data) {
  const headers = Object.keys(data[0]).join(',');

  const rows = data.map(row =>
    Object.values(row)
      .map(val => `"${String(val).replace(/"/g, '""')}"`)
      .join(',')
  );

  return [headers, ...rows].join('\n');
}
function descargarCSV(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();

  URL.revokeObjectURL(url);
}


/* =========================
   Reportes - Historial
========================= */
async function mostrarHistorial() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const tipo = document.getElementById('filtroTipo').value;

  if (!desde || !hasta) {
    alert('Selecciona un rango de fechas');
    return;
  }

  document.getElementById('historialTable').innerHTML =
    '<div class="message info">Cargando movimientos...</div>';

  let query = db
    .from('Movimientos')
    .select(`
      Fecha,
      Cantidad,
      Stock,
      Observaciones,
      CodProd,
      TipoMov!inner ( Tipo )
    `)
    .gte('Fecha', desde)
    .lte('Fecha', hasta)
    .order('Fecha', { ascending: false });

  if (tipo) {
    query = query.eq('TipoMov.Tipo', tipo);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    document.getElementById('historialTable').innerHTML =
      '<div class="message error">Error cargando historial</div>';
    return;
  }

  renderHistorial(data);
}


function renderHistorial(data) {
  if (!data.length) {
    document.getElementById('historialTable').innerHTML =
      '<div class="message warning">No hay movimientos en este rango</div>';
    return;
  }

  document.getElementById('historialTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Producto</th>
          <th>Tipo</th>
          <th>Cantidad</th>
          <th>Stock</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(m => `
          <tr>
            <td>${formatearFecha(m.Fecha)}</td>
            <td>${m.CodProd}</td>
            <td>${renderTipoMovimiento(m.TipoMov?.Tipo)}</td>
            <td>${m.Cantidad ?? '-'}</td>
            <td>${m.Stock ?? '-'}</td>
            <td>${m.Observaciones ?? ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
function renderTipoMovimiento(tipo) {
  switch (tipo) {
    case 'Ingreso': return '🟢 Ingreso';
    case 'Salida': return '🔴 Salida';
    case 'Ajuste Positivo': return '🔵 Ajuste +';
    case 'Ajuste Negativo': return '🟠 Ajuste -';
    default: return tipo || '-';
  }
}
function formatearFecha(fecha) {
  return new Date(fecha).toLocaleString();
}
function exportarReporte() {
  alert('🚧 Exportación en construcción');
}


/* =========================
   Exportar Reporte CSV
========================= */
async function exportarReporte() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const tipo = document.getElementById('filtroTipo').value;

  if (!desde || !hasta) {
    alert('Selecciona un rango de fechas');
    return;
  }

  try {
    let query = db
      .from('Movimientos')
      .select(`
        Fecha,
        CodProd,
        Cantidad,
        Stock,
        Observaciones,
        TipoMov ( Tipo )
      `)
      .gte('Fecha', desde)
      .lte('Fecha', hasta)
      .order('Fecha', { ascending: false });

    // 👉 filtro por tipo (ID)
    if (tipo) {
      query = query.eq('Tipo', Number(tipo));
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || !data.length) {
      alert('No hay datos para exportar');
      return;
    }

    // 1️⃣ Formatear filas
    const rows = data.map(m => ({
      Fecha: new Date(m.Fecha).toLocaleString(),
      Producto: m.CodProd,
      Tipo: m.TipoMov?.Tipo || '',
      Cantidad: m.Cantidad ?? '',
      Stock_Resultante: m.Stock ?? '',
      Observaciones: m.Observaciones ?? ''
    }));

    // 2️⃣ Convertir a CSV
    const csv = convertirACSV(rows);

    // 3️⃣ Descargar
    descargarCSV(csv, 'reporte_movimientos.csv');

  } catch (err) {
    console.error(err);
    alert('Error al exportar reporte');
  }
}

/* =========================
   Exportar CSV
========================= */

/* =========================
   function convertirACSV(data) {
  const headers = Object.keys(data[0]).join(',');

  const rows = data.map(row =>
    Object.values(row)
      .map(val => `"${String(val).replace(/"/g, '""')}"`)
      .join(',')
  );

  return [headers, ...rows].join('\n');
}
function descargarCSV(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();

  URL.revokeObjectURL(url);
}
========================= */


/* =========================
   BUSCAR - TIEMPO REAL
========================= */
let timeoutBusqueda;

function buscarEnTiempoReal() {
  clearTimeout(timeoutBusqueda);

  timeoutBusqueda = setTimeout(() => {
    buscarProducto();
  }, 300); // debounce
}
async function buscarProducto() {
  const texto = document.getElementById('buscarTexto').value.trim();

  if (!texto) {
    document.getElementById('resultadosBusqueda').innerHTML = '';
    return;
  }

  document.getElementById('resultadosBusqueda').innerHTML =
    '<div class="message info">Buscando...</div>';

  let query = db
    .from('Productos')
    .select(`
      CodProduc,
      Nombre,
      StockMin,
      Unidades ( unidad ),
      Grupos ( Grupo ),
      Stocks ( Stock )
    `)
    .eq('Estado', true)
    .or(`CodProduc.ilike.%${texto}%,Nombre.ilike.%${texto}%`)
    .order('Nombre');

  const { data, error } = await query;

  if (error) {
    console.error(error);
    document.getElementById('resultadosBusqueda').innerHTML =
      '<div class="message error">Error en la búsqueda</div>';
    return;
  }

  if (!data.length) {
    document.getElementById('resultadosBusqueda').innerHTML =
      '<div class="message warning">Sin resultados</div>';
    return;
  }

  renderResultadosBusqueda(data);
}


function renderResultadosBusqueda(data) {
  const rows = data.map(p => {
    const stock = p.Stocks?.[0]?.Stock ?? 0;

    let estado = '🟢 OK';
    if (stock === 0) estado = '🔴 Sin stock';
    else if (stock <= p.StockMin) estado = '🟡 Bajo';

    return `
      <tr>
        <td>${p.CodProduc}</td>
        <td>${p.Nombre}</td>
        <td>${p.Unidades?.unidad || '-'}</td>
        <td>${p.Grupos?.Grupo || '-'}</td>
        <td>${p.StockMin}</td>
        <td>${stock}</td>
        <td>${estado}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('resultadosBusqueda').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <th>Unidad</th>
          <th>Grupo</th>
          <th>Stock Min</th>
          <th>Stock</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
function limpiarBusqueda() {
  document.getElementById('buscarTexto').value = '';
  document.getElementById('resultadosBusqueda').innerHTML = '';
}




/* =========================
   UTILIDADES
========================= */
function showMessage(id, msg, type) {
  document.getElementById(id).innerHTML =
    `<div class="message ${type}">${msg}</div>`;
}

function limpiarFormProducto() {
  formProducto.reset();
  stockMinProd.value = 0;
}

function limpiarFormMovimiento() {
  formMovimiento.reset();
  fechaMov.valueAsDate = new Date();
}

/* =========================
   ATAJOS
========================= */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    currentTab === 'productos' && formProducto.dispatchEvent(new Event('submit'));
    currentTab === 'movimientos' && formMovimiento.dispatchEvent(new Event('submit'));
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-container')) ocultarAutocompletado();
});

function generarAcronimo(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(' ')
    .filter(p => p.length > 0)
    .map(p => p[0].toUpperCase())
    .join('');
}

function formatearNumero(id) {
  return String(id).padStart(3, '0');
}



