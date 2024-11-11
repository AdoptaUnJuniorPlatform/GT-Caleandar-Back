require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: 'http://localhost:4321' }); // Permitir solo solicitudes desde tu frontend en localhost:4321

admin.initializeApp();

// Configurar el transporte de correos usando variables de entorno
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. Función de Endpoint (Recibir datos, guardarlos en Firebase y enviar correos si la fecha es hoy)
exports.endDatos = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Método no permitido');
        }

        const { userId, descripcion, email_responsables, estado, fecha_tarea, periodicidad_tipo, periodicidad_dias, periodicidad_hora, periodicidad_fin_de_semana, prioridad, tipo, titulo } = req.body;

        if (!userId || !descripcion || !email_responsables || !estado || !fecha_tarea || !titulo) {
            return res.status(400).send('Faltan datos en el cuerpo de la solicitud');
        }

        const periodicidad = {
            tipo: periodicidad_tipo,
            dias: periodicidad_dias ? periodicidad_dias.split(',') : [],
            hora: periodicidad_hora || "",
            fin_de_semana: periodicidad_fin_de_semana === 'true',
        };

        const taskRef = admin.database().ref(`/tareas/${userId}`).push();
        const tarea_id = taskRef.key;

        
        const taskData = {
            descripcion,
            email_responsables: email_responsables.split(','),
            estado,
            fecha_tarea,
            periodicidad,
            prioridad,
            tipo,
            titulo
        };

        await taskRef.set(taskData);
        console.log('Tarea guardada en Firebase:', taskData);

        const today = new Date().toISOString().split('T')[0];

        if (fecha_tarea === today) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email_responsables.split(',').join(', '),
                subject: `Recordatorio: ${titulo}`,
                text: `Descripción de la tarea: ${descripcion}`,
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log('Correo enviado a:', email_responsables);
                return res.status(200).send('Correo enviado correctamente');
            } catch (error) {
                console.error('Error al enviar el correo:', error);
                return res.status(500).send('Error al enviar el correo');
            }
        } else {
            console.log('La fecha de la tarea no es hoy, no se enviará el correo');
            return res.status(200).send('Tarea guardada pero no se enviará correo (fecha no es hoy)');
        }
    });
});

// 2. Función para obtener las tareas de un usuario por ID
exports.getTasksByUserId = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Método no permitido' });
        }

        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'Falta el parámetro userId' });
        }

        try {
            const tasksRef = admin.database().ref(`/tareas/${userId}`);
            const snapshot = await tasksRef.once('value');
            const tasks = snapshot.val();

            if (!tasks) {
                return res.status(404).json({ error: 'No se encontraron tareas para este usuario' });
            }

            return res.status(200).json(tasks);
        } catch (error) {
            console.error('Error al recuperar las tareas:', error);
            return res.status(500).json({ error: 'Error al recuperar las tareas' });
        }
    });
});

// 3. Función para actualizar una tarea existente
exports.updateTask = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'El usuario no está autenticado');
    }

    const { userId, tareaId, descripcion, email_responsables, estado, fecha_tarea, periodicidad_tipo, periodicidad_dias, periodicidad_hora, periodicidad_fin_de_semana, prioridad, tipo, titulo } = data;

    if (!userId || !tareaId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos importantes: userId o tareaId');
    }

    const taskRef = admin.database().ref(`/tareas/${userId}/${tareaId}`);
    const taskSnapshot = await taskRef.once('value');
    const task = taskSnapshot.val();

    if (!task) {
        throw new functions.https.HttpsError('not-found', 'La tarea no existe');
    }

    const updatedTaskData = {};
    if (descripcion) updatedTaskData.descripcion = descripcion;
    if (email_responsables) updatedTaskData.email_responsables = email_responsables.split(',');
    if (estado) updatedTaskData.estado = estado;
    if (fecha_tarea) updatedTaskData.fecha_tarea = fecha_tarea;
    if (periodicidad_tipo) updatedTaskData.periodicidad = {
        tipo: periodicidad_tipo,
        dias: periodicidad_dias ? periodicidad_dias.split(',') : [],
        hora: periodicidad_hora || "",
        fin_de_semana: periodicidad_fin_de_semana === 'true',
    };
    if (prioridad) updatedTaskData.prioridad = prioridad;
    if (tipo) updatedTaskData.tipo = tipo;
    if (titulo) updatedTaskData.titulo = titulo;

    try {
        await taskRef.update(updatedTaskData);
        console.log('Tarea actualizada correctamente', updatedTaskData);
        return { message: 'Tarea actualizada correctamente' };
    } catch (error) {
        console.error('Error al actualizar la tarea:', error);
        throw new functions.https.HttpsError('internal', 'Error al actualizar la tarea', error);
    }
});

// 4. Función programada para verificar las tareas cada día
exports.verifyDailyTasks = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        console.log('Verificando tareas para hoy...');

        const today = new Date().toISOString().split('T')[0];
        const tasksRef = admin.database().ref('/tareas');
        const snapshot = await tasksRef.once('value');
        const tasks = snapshot.val();

        if (!tasks) {
            console.log('No hay tareas en la base de datos');
            return res.status(200).send('No hay tareas en la base de datos');
        }

        for (const usuarioId in tasks) {
            const userTasks = tasks[usuarioId];

            for (const taskId in userTasks) {
                const task = userTasks[taskId];
                const { fecha_tarea, email_responsables, descripcion, titulo } = task;

                if (fecha_tarea === today) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: Array.isArray(email_responsables) ? email_responsables.join(', ') : email_responsables,
                        subject: `Recordatorio: ${titulo}`,
                        text: `Descripción de la tarea: ${descripcion}`,
                    };

                    try {
                        await transporter.sendMail(mailOptions);
                        console.log(`Correo enviado a: ${email_responsables.join(', ')}`);
                    } catch (error) {
                        console.error(`Error al enviar correo para la tarea ${taskId}:`, error);
                    }
                }
            }
        }

        return res.status(200).send('Verificación de tareas completada');
    });
});

// 5. Función para limpiar tareas vencidas (anterior a la fecha de hoy)
exports.cleanupOldTasks = functions.https.onRequest(async (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // Fecha de hoy en formato YYYY-MM-DD
    console.log('Fecha de hoy:', today);

    const tasksRef = admin.database().ref('/tareas');
    const snapshot = await tasksRef.once('value');
    const tasks = snapshot.val();

    if (!tasks) {
        console.log('No hay tareas para limpiar.');
        return res.status(200).send('No hay tareas para limpiar.');
    }

    const updates = {};
    let tasksDeleted = 0; // Contador de tareas eliminadas

    Object.entries(tasks).forEach(([userId, userTasks]) => {
        Object.entries(userTasks).forEach(([taskId, task]) => {
            // Verificar si la tarea es completada y si la fecha es anterior a hoy
            if (task.estado === 'completada' && task.fecha_tarea < today) {
                console.log(`Marcando tarea ${taskId} para eliminar (fecha: ${task.fecha_tarea}, estado: completada)`);
                updates[`/tareas/${userId}/${taskId}`] = null; // Eliminar tarea
                tasksDeleted++;
            }
        });
    });

    if (tasksDeleted > 0) {
        await admin.database().ref().update(updates); // Eliminar todas las tareas marcadas
        console.log(`Tareas eliminadas: ${tasksDeleted}`);
        return res.status(200).send(`Tareas eliminadas: ${tasksDeleted}`);
    } else {
        console.log('No hay tareas completadas antiguas para eliminar');
        return res.status(200).send('No hay tareas completadas antiguas para eliminar');
    }
});
