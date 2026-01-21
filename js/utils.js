function setDefaultDates() {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  document.getElementById("fechaMov").valueAsDate = today;
  document.getElementById("fechaDesde").valueAsDate = monthAgo;
  document.getElementById("fechaHasta").valueAsDate = today;
}

function showMessage(containerId, message, type) {
  const container = document.getElementById(containerId);
  let className = 'message ' + (type || 'success');
  container.innerHTML = `<div class="${className}">${message}</div>`;
}
