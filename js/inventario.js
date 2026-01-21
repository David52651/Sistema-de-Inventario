function mostrarStock() {
  google.script.run.withSuccessHandler(data => {
    displayStockTable(data, stockTable);
  }).obtenerStock();
}
