let currentTab = 'dashboard';
let searchTimeout;
let autocompleteTimeout;

function initializeApp() {
  setDefaultDates();
  loadListas();
  loadDashboard();
  showTab('dashboard');
}

function showTab(tabName, button = null) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  document.getElementById(tabName).classList.add('active');

  if (button) {
    button.classList.add('active');
  }

  currentTab = tabName;

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'inventario') mostrarStock();
}
