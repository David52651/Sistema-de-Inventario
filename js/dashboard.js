function loadDashboard() {
  google.script.run.withSuccessHandler(data => {
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${data.totalProductos}</div>
        <div class="stat-label">Productos</div>
      </div>
    `;
  }).obtenerResumen();
}
