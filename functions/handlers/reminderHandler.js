
const { sendTaskReminder } = require('./mailHandler');
const admin = require('../firebaseConfig');
const cors = require('../middleware/corsMiddleware');
const { formatDate, isToday, isBeforeToday } = require('../utils/dateUtils');
require('dotenv').config();

// 4. Verificar tareas diarias y enviar recordatorios
const verifyDailyTasks = async (req, res) => {
    cors(req, res, async () => {
        console.log('Verificando tareas para hoy...');
        const today = formatDate(new Date());

        const tasksRef = admin.database().ref('/tareas');
        const snapshot = await tasksRef.once('value');
        const tasks = snapshot.val();

        if (!tasks) {
            return res.status(200).send('No hay tareas en la base de datos');
        }

        for (const userId in tasks) {
            const userTasks = tasks[userId];
            for (const taskId in userTasks) {
                const { fecha_tarea, email_responsables, descripcion, titulo } = userTasks[taskId];

                // Verifica si la tarea es para hoy
                if (formatDate(fecha_tarea) === today) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: email_responsables.join(', '),
                        subject: `Recordatorio: ${titulo}`,
                        text: `Descripción de la tarea: ${descripcion}`
                    };
                    try {
                        await sendTaskReminder(mailOptions); // Uso de función modular
                        console.log(`Correo enviado a: ${email_responsables.join(', ')}`);
                    } catch (error) {
                        console.error(`Error al enviar correo para la tarea ${taskId}:`, error);
                    }
                }
            }
        }

        return res.status(200).send('Verificación de tareas completada');
    });
};

// 5. Limpiar tareas vencidas y archivar completadas
const cleanupOldTasks = async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Fecha actual sin hora

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30); // Fecha de hace 30 días

    console.log('Fecha de hoy:', formatDate(today));
    console.log('Fecha límite para eliminar (30 días atrás):', formatDate(thirtyDaysAgo));

    const tasksRef = admin.database().ref('/tareas');
    const snapshot = await tasksRef.once('value');
    const tasks = snapshot.val();

    if (!tasks) {
        return res.status(200).send('No hay tareas para limpiar.');
    }

    const updates = {};
    let tasksUpdated = 0;
    let tasksDeleted = 0;

    for (const [userId, userTasks] of Object.entries(tasks)) {
        for (const [taskId, task] of Object.entries(userTasks)) {
            const taskDate = new Date(task.fecha_tarea);
            taskDate.setHours(0, 0, 0, 0);

            // Determinar el estado de la tarea si no está definido
            let taskEstado = task.estado ?? (taskDate < today ? 1 : 0);

            // Archivar tareas completadas si su fecha es anterior a hoy
            if (taskEstado === 1 && taskDate < today) { // Completadas
                updates[`/tareas/${userId}/${taskId}/estado`] = 2; // Archivar
                tasksUpdated++;
            }

            // Eliminar tareas archivadas que tengan más de 30 días
            if (taskEstado === 2 && taskDate < thirtyDaysAgo) { // Archivadas por más de 30 días
                updates[`/tareas/${userId}/${taskId}`] = null; // Eliminar
                tasksDeleted++;
            }
        }
    }

    if (Object.keys(updates).length > 0) {
        await admin.database().ref().update(updates);
    }

    const responseMessage = [
        tasksUpdated > 0 ? `${tasksUpdated} tarea(s) archivada(s).` : '',
        tasksDeleted > 0 ? `${tasksDeleted} tarea(s) eliminada(s).` : ''
    ].filter(Boolean).join(' ');

    return res.status(200).send(responseMessage || 'No hay tareas para archivar o eliminar.');
};

module.exports = {
    verifyDailyTasks,
    cleanupOldTasks
};
