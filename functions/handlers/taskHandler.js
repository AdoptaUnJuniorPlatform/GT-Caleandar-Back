const admin = require('../firebaseConfig');
const transporter = require('../config/mailConfig');
const { sendTaskReminder } = require('./mailHandler');
const cors = require('../middleware/corsMiddleware');
const { formatDate, isToday, isBeforeToday } = require('../utils/dateUtils');
const { convertirEstado, convertirPeriodicidad } = require('../utils/taskUtils');
const functions = require('firebase-functions');

// 1. Crear una nueva tarea, guardarla en Firebase y enviar correos si la fecha es hoy
const endDatos = async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

        console.log("Datos recibidos del frontend: ", req.body);

        // Asignar valores y aplicar validaciones
        let {
            title,
            dayStar,
            dayEnd,
            starTime,
            participants,
            description,
            userId,
            estado = 0, // Por defecto, pendiente
            dia_inicio,
            n_semanas,
            fecha_recordatorio = "", // Por defecto, vacío
            frequencyData // Objeto con periodicidad
        } = req.body;

        // Manejo de frecuencia
        let repeat = frequencyData ? frequencyData.frequency : '0'; // Por defecto, sin repetición
        if (repeat === '2' && !dia_inicio) dia_inicio = 1; // Por defecto, lunes

        // Validar campos obligatorios
        if (!userId || !description || !participants || !dayStar || !title || !repeat) {
            return res.status(400).json({ error: 'Faltan datos en la solicitud' });
        }

        // Transformar participantes en array
        if (typeof participants === 'string') {
            participants = participants.split(',').map(email => email.trim());
        }

        // Formatear y validar fechas
        const formattedStartDate = formatDate(dayStar);
        let formattedEndDate;
        if (dayEnd) formattedEndDate = formatDate(dayEnd);

        const startDate = new Date(dayStar);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Fecha de inicio inválida' });
        }

        let endDate;
        if (dayEnd) {
            endDate = new Date(dayEnd);
            if (isNaN(endDate.getTime()) || startDate > endDate) {
                return res.status(400).json({ error: 'Fecha de fin inválida o anterior a la de inicio' });
            }
        }

        // Validar estado
        const estadoRef = admin.database().ref('/indice_estados');
        const estadoSnapshot = await estadoRef.once('value');
        const estados = estadoSnapshot.val();
        if (!estados || !estados[estado]) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Validar periodicidad
        const periodicidadRef = admin.database().ref('/indice_frecuencia');
        const periodicidadSnapshot = await periodicidadRef.once('value');
        const frecuencias = periodicidadSnapshot.val();
        if (!frecuencias || !frecuencias[repeat]) {
            return res.status(400).json({ error: 'Periodicidad no válida' });
        }

        let frecuencia = { tipo: repeat };
        if (repeat === '2') { // Semanal
            frecuencia.dia_inicio = frequencyData.weekDays || [1]; // Por defecto, lunes
            frecuencia.n_semanas = frequencyData.repeatEvery || 1; // Por defecto, cada semana
        }

        // Crear tarea en Firebase
        const taskRef = admin.database().ref(`/tareas/${userId}`).push();
        const taskData = {
            descripcion: description,
            email_responsables: participants,
            estado,
            fecha_tarea: formattedStartDate,
            titulo: title,
            frecuencia,
            hora: starTime || '',
            fecha_recordatorio: fecha_recordatorio
        };
        if (formattedEndDate) taskData.fecha_fin = formattedEndDate;

        await taskRef.set(taskData);

        // Enviar recordatorio si la fecha es hoy
        if (isToday(startDate)) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: participants.join(', '),
                subject: `Recordatorio: ${title}`,
                text: `Descripción de la tarea: ${description}`
            };
            try {
                await sendTaskReminder(mailOptions);
            } catch (error) {
                console.error('Error al enviar el correo:', error);
            }
        }

        return res.status(200).json({ message: 'Tarea creada exitosamente' });
    });
};

// 2. Obtener tareas por ID de usuario
const getTasksByUserId = async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Falta el parámetro userId' });

        try {
            const tasksRef = admin.database().ref(`/tareas/${userId}`);
            const snapshot = await tasksRef.once('value');
            const tasks = snapshot.val();

            if (!tasks) return res.status(404).json({ error: 'No se encontraron tareas para este usuario' });

            const formattedTasks = Object.entries(tasks).map(([taskId, task]) => ({
                titulo: task.titulo,
                descripcion: task.descripcion,
                email_responsables: task.email_responsables,
                estado: convertirEstado(task.estado),
                fecha_fin: task.fecha_fin,
                fecha_tarea: task.fecha_tarea,
                hora: task.hora,
                fecha_recordatorio: task.fecha_recordatorio || "",
                periodicidad: task.frecuencia ? convertirPeriodicidad(task.frecuencia) : 'No especificado'
            }));

            return res.status(200).json({ tasks: formattedTasks });
        } catch (error) {
            console.error('Error al recuperar las tareas:', error);
            return res.status(500).json({ error: 'Error al recuperar las tareas' });
        }
    });
};

// 3. Actualizar tarea existente
const updateTask = async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'El usuario no está autenticado');
    }

    const userId = context.auth.uid;
    const tareaId = data.tareaId;
    if (!tareaId) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta el campo tareaId');
    }

    const taskRef = admin.database().ref(`/tareas/${userId}/${tareaId}`);
    const taskSnapshot = await taskRef.once('value');

    if (!taskSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'La tarea no existe');
    }

    const taskData = taskSnapshot.val();
    if (taskData.usuario_id !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para modificar esta tarea');
    }

    const updatedTaskData = {};
    if (data.descripcion) updatedTaskData.descripcion = data.descripcion;
    if (data.email_responsables) updatedTaskData.email_responsables = data.email_responsables.split(',');
    if (data.estado !== undefined) updatedTaskData.estado = parseInt(data.estado, 10);
    if (data.fecha_inicio) updatedTaskData.fecha_inicio = data.fecha_inicio;
    if (data.titulo) updatedTaskData.titulo = data.titulo;

    if (data.periodicidad && data.periodicidad.tipo !== undefined) {
        updatedTaskData.periodicidad = {
            tipo: parseInt(data.periodicidad.tipo, 10),
            dia_inicio: data.periodicidad.dia_inicio,
            n_semanas: data.periodicidad.n_semanas
        };
    }

    try {
        await taskRef.update(updatedTaskData);
        console.log('Tarea actualizada correctamente', updatedTaskData);
        return { message: 'Tarea actualizada correctamente' };
    } catch (error) {
        console.error('Error al actualizar la tarea:', error);
        throw new functions.https.HttpsError('internal', 'Error al actualizar la tarea', error);
    }
};

module.exports = {
    endDatos,
    getTasksByUserId,
    updateTask
};
