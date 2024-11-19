// firebaseConfig.js
const admin = require('firebase-admin');

// Verificar si Firebase ya está inicializado para evitar inicializarlo múltiples veces
if (!admin.apps.length) {
  admin.initializeApp();
}

module.exports = admin;
