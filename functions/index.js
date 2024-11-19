// functions/index.js
const functions = require('firebase-functions');
const cors = require('./middleware/corsMiddleware');
const { endDatos, getTasksByUserId, updateTask, verifyDailyTasks, cleanupOldTasks } = require('./handlers/taskHandler');

// Usando CORS middleware en las funciones HTTP
exports.endDatos = functions.https.onRequest((req, res) => cors(req, res, () => endDatos(req, res)));
exports.getTasksByUserId = functions.https.onRequest((req, res) => cors(req, res, () => getTasksByUserId(req, res)));
// Aquí usamos onCall para la función de actualización de tarea
exports.updateTask = functions.https.onCall(updateTask);  // Esta función es callable, por lo tanto, no se usa con req/res
exports.verifyDailyTasks = functions.https.onRequest((req, res) => cors(req, res, () => verifyDailyTasks(req, res)));
exports.cleanupOldTasks = functions.https.onRequest((req, res) => cors(req, res, () => cleanupOldTasks(req, res)));
