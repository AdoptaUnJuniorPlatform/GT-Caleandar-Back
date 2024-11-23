const admin = require('../firebaseConfig');
const transporter = require('../config/mailConfig');
const { sendTaskReminder } = require('./mailHandler');
const cors = require('../middleware/corsMiddleware');
const { formatDate, isToday, isBeforeToday } = require('../utils/dateUtils');
const { convertirEstado, convertirPeriodicidad } = require('../utils/taskUtils');
const functions = require('firebase-functions');
const ESTADOS = {
    PENDIENTE: 0,
    COMPLETADA: 1,
    ARCHIVADA: 2
};


// 1. Crear una nueva tarea, guardarla en Firebase y enviar correos si la fecha es hoy

const endDatos = async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

        console.log("Datos recibidos del frontend: ", req.body); // Añadir esto para ver los datos

        // Mapeo de los campos recibidos del frontend a los nombres esperados por el backend
        let {
            title,           // frontend: title -> backend: titulo
            dayStar,         // frontend: dayStar -> backend: fecha_inicio
            dayEnd,          // frontend: dayEnd -> backend: fecha_fin
            starTime,        // frontend: starTime -> backend: hora
            participants,    // frontend: participants -> backend: email_responsables
            description,     // frontend: description -> backend: descripcion
            repeat,          // frontend: repeat -> backend: periodicidad
            userId,          // backend: userId (no cambia)
            estado = 0,      // Asignamos 0 como valor por defecto para "pendiente"
            dia_inicio,      // frontend: (en caso de periodicidad "week")
            n_semanas,       // frontend: (en caso de periodicidad "week")
            fecha_recordatorio = "" // Correcta asignación del valor por defecto (cadena vacía)
        } = req.body;

        // Establecer el valor de repeat a 0 si no se da o si se recibe "noRepeat"
        if (!repeat || repeat === 'noRepeat') {
            repeat = '0'; // Convertir 'noRepeat' a '0'
        } else if (repeat === 'day') {
            repeat = '1'; // Convertir 'day' a '1'
        } else if (repeat === 'week') {
            repeat = '2'; // Convertir 'week' a '2'
        } else if (repeat === 'month') {
            repeat = '3'; // Convertir 'month' a '3'
        } else if (repeat === 'year') {
            repeat = '4'; // Convertir 'year' a '4'
        }

        // Asignar '1' (lunes) a dia_inicio si se selecciona 'week' y no se proporciona valor
        if (repeat === '2' && !dia_inicio) {
            dia_inicio = 1; // Lunes como valor por defecto
        }

        // Verificar que todos los datos obligatorios estén presentes
        if (!userId || !description || !participants || !dayStar || !title || !repeat) {
            return res.status(400).json({ error: 'Faltan datos en el cuerpo de la solicitud' });
        }

        // Transformar 'participants' si es una cadena de texto
        if (typeof participants === 'string') {
            participants = participants.split(',').map(email => email.trim());
        }

        // Formatear las fechas usando la función formatDate
        const formattedStartDate = formatDate(dayStar);
        let formattedEndDate;
        if (dayEnd) {
            formattedEndDate = formatDate(dayEnd);
        }

        // Validar la fecha de inicio
        const startDate = new Date(dayStar);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'La fecha de inicio proporcionada es inválida' });
        }

        let endDate;
        if (dayEnd) {
            endDate = new Date(dayEnd);
            if (isNaN(endDate.getTime())) {
                return res.status(400).json({ error: 'La fecha de fin proporcionada es inválida' });
            }
            // Permitir que la fecha fin sea igual a la fecha inicio, pero nunca anterior
            if (startDate > endDate) {
                return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
            }
        }

        // Validar el valor de estado consultando los índices en la base de datos
        const estadoRef = admin.database().ref('/indice_estados');
        const estadoSnapshot = await estadoRef.once('value');
        const estados = estadoSnapshot.val();

        // Validar que el estado recibido sea un valor válido (0, 1, o 2)
        if (!estados || !estados[estado]) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Validar la periodicidad
        const periodicidadRef = admin.database().ref('/indice_frecuencia');
        const periodicidadSnapshot = await periodicidadRef.once('value');
        const frecuencias = periodicidadSnapshot.val();

        if (!frecuencias || !frecuencias[repeat]) {
            return res.status(400).json({ error: 'Periodicidad no válida' });
        }

        let frecuencia = { tipo: repeat };

        if (repeat === '2') { // Si la periodicidad es semanal
            frecuencia.dia_inicio = dia_inicio || 1; // Asignar el lunes por defecto si no se proporciona
            frecuencia.n_semanas = n_semanas || 1; // Si no se especifica, asigna 1 semana por defecto
        }

        // Crear un nuevo objeto de tarea para guardarlo en Firebase
        const taskRef = admin.database().ref(`/tareas/${userId}`).push();  // Corregido aquí
        const taskData = {
            descripcion: description,               // Mapeo de description -> descripcion
            email_responsables: participants,        // Mapeo de participants -> email_responsables (ya es un array)
            estado,                                  // Estado (ahora con valor por defecto 0)
            fecha_tarea: formattedStartDate,         // Fecha de inicio (solo día/mes/año)
            titulo: title,                           // Mapeo de title -> titulo
            frecuencia,                              // Frecuencia
            hora: starTime || '',                    // Mapeo de starTime -> hora
            fecha_recordatorio: fecha_recordatorio,  // Fecha de recordatorio (valor por defecto "")
        };

        // Si hay fecha de fin, la agregamos (formateada también)
        if (formattedEndDate) {
            taskData.fecha_fin = formattedEndDate;  // Mapeo de fecha_fin (solo día/mes/año)
        }

        // Guardar la tarea en la base de datos de Firebase
        await taskRef.set(taskData);

        // Verificar si la fecha de la tarea es hoy, y si es así, enviar un correo
        if (isToday(startDate)) {
            try {
                await sendTaskReminder(participants, description, title, starTime);
            } catch (error) {
                console.error('Error al enviar el correo:', error);
            }
        }

        // Responder con éxito
        return res.status(200).json({ message: 'Tarea creada exitosamente' });
    });
};


// 2. Obtener las tareas de un usuario por ID

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

            // Convertir los índices de estado y periodicidad a nombres
            const formattedTasks = Object.entries(tasks).map(([taskId, task]) => {
                // Convertir estado a nombre usando la función externa
                const estadoNombre = convertirEstado(task.estado);

                // Convertir periodicidad a nombre usando la función externa
                const periodicidadNombre = convertirPeriodicidad(task.frecuencia);

                // Devolver solo los campos que queremos mostrar, excluyendo taskId y frecuencia.tipo
                return {
                    titulo: task.titulo,               
                    descripcion: task.descripcion,
                    email_responsables: task.email_responsables,
                    estado: estadoNombre,
                    fecha_fin: task.fecha_fin,
                    fecha_tarea: task.fecha_tarea,
                    hora: task.hora,
                    fecha_recordatorio: task.fecha_recordatorio || "",
                    periodicidad: periodicidadNombre
                };
            });

            return res.status(200).json({ tasks: formattedTasks });
        } catch (error) {
            console.error('Error al recuperar las tareas:', error);
            return res.status(500).json({ error: 'Error al recuperar las tareas' });
        }
    });
};


// 3. Actualizar una tarea existente ( Aun por optimizar)


const updateTask = async (data, context) => {
    // Verificar si el usuario está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'El usuario no está autenticado');
    }

    const userId = context.auth.uid;  // Obtener el userId del contexto de autenticación
    const tareaId = data.tareaId;  // Obtener el tareaId desde el cuerpo de la solicitud

    // Verificar que se haya proporcionado el tareaId
    if (!tareaId) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta el campo tareaId');
    }

    // Asegurarse de que el usuario solo pueda modificar sus propias tareas
    const taskRef = admin.database().ref(`/tareas/${userId}/${tareaId}`);
    const taskSnapshot = await taskRef.once('value');

    // Verificar si la tarea existe
    if (!taskSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'La tarea no existe');
    }

    // Verificar que la tarea pertenece al usuario actual
    const taskData = taskSnapshot.val();
    if (taskData.usuario_id !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para modificar esta tarea');
    }

    // Preparar los datos actualizados para la tarea
    const updatedTaskData = {};

    // Validar y actualizar campos
    if (data.descripcion) updatedTaskData.descripcion = data.descripcion;
    if (data.email_responsables) updatedTaskData.email_responsables = data.email_responsables.split(',');
    if (data.estado !== undefined) updatedTaskData.estado = parseInt(data.estado, 10);  // Convertir a número si es necesario
    if (data.fecha_inicio) updatedTaskData.fecha_inicio = data.fecha_inicio;
    if (data.titulo) updatedTaskData.titulo = data.titulo;
    
    // Validar y actualizar la periodicidad
    if (data.periodicidad && data.periodicidad.tipo !== undefined) {
        updatedTaskData.periodicidad = {
            tipo: parseInt(data.periodicidad.tipo, 10),
            dia_inicio: data.periodicidad.dia_inicio,
            n_semanas: data.periodicidad.n_semanas
        };
    }

    try {
        // Actualizar la tarea en la base de datos
        await taskRef.update(updatedTaskData);
        console.log('Tarea actualizada correctamente', updatedTaskData);
        
        // Retornar un mensaje de éxito
        return { message: 'Tarea actualizada correctamente' };
    } catch (error) {
        console.error('Error al actualizar la tarea:', error);
        
        // Lanzar un error en caso de fallos
        throw new functions.https.HttpsError('internal', 'Error al actualizar la tarea', error);
    }
};

// Envolver la función con CORS para permitir solicitudes desde cualquier origen
exports.updateTask = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // Asegurarse de que la solicitud es un POST (actualización de datos)
        if (req.method !== 'POST') {
            return res.status(405).send('Método no permitido');
        }

        try {
            const data = req.body;
            const context = req; // En un entorno real de Firebase Functions, `context` se maneja automáticamente

            const result = await updateTask(data, context);
            return res.status(200).send(result);  // Retornar el resultado de la función

        } catch (error) {
            console.error('Error al procesar la solicitud', error);
            return res.status(500).send('Error al procesar la solicitud');
        }
    });
});



// 4. verifyReminderTasks: Verificar tareas que necesitan recordatorio, añade fecha recordatorio a tareas con frecuencia diaria semanal mensual y anual

const verifyReminderTasks = async (req, res) => {
    console.log('Iniciando verificación de recordatorios...');
    const today = formatDate(new Date());

    const tasksRef = admin.database().ref('/tareas');
    const snapshot = await tasksRef.once('value');
    const tasks = snapshot.val();

    if (!tasks) {
        console.log('No se encontraron tareas en la base de datos.');
        return res.status(200).send('No hay tareas en la base de datos.');
    }

    for (const userId in tasks) {
        const userTasks = tasks[userId];
        const emailPromises = [];

        for (const taskId in userTasks) {
            const task = userTasks[taskId];
            const { fecha_tarea, fecha_recordatorio, email_responsables, descripcion, titulo, estado, frecuencia } = task;

            // Validación de datos requeridos
            if (!email_responsables || email_responsables.length === 0 || !fecha_tarea || !titulo || !descripcion || estado !== 0) {
                console.warn(`Tarea ${taskId} del usuario ${userId} inválida o no pendiente. Falta información o estado no es pendiente.`);
                continue;
            }

            // Asegurar que email_responsables sea un arreglo
            const emails = Array.isArray(email_responsables) ? email_responsables : [email_responsables];

            // Si la frecuencia es "0" (sin frecuencia), no debe enviarse correo
            if (frecuencia.tipo === "0") {
                continue;
            }

            // Si la fecha_recordatorio está vacía y la frecuencia es diaria, semanal, mensual o anual, establecer la fecha de recordatorio en la fecha actual
            let currentReminderDate = fecha_recordatorio ? fecha_recordatorio : today;

            // Verificar si la fecha_recordatorio es un valor especial ("9999-12-31") o si está vacía
            if (currentReminderDate === "9999-12-31" || !currentReminderDate) {
                console.log(`La tarea ${taskId} ya ha sido procesada o no tiene recordatorio.`);
                continue;  // Si la tarea ya ha sido procesada o no tiene recordatorio, no hacer nada
            }

            // Verifica si la tarea debe ser recordada hoy
            if (formatDate(currentReminderDate) === today) {
                // Enviar recordatorio de correo
                emailPromises.push(sendTaskReminder(emails, descripcion, titulo, currentReminderDate));

                // Si la frecuencia es diaria, semanal, mensual o anual, actualizar la fecha de recordatorio
                let newReminderDate;

                switch (frecuencia.tipo) {
                    case "1": // Diaria
                        newReminderDate = new Date(currentReminderDate);
                        newReminderDate.setDate(newReminderDate.getDate() + 1); // Sumar un día
                        break;
                    case "2": // Semanal
                        newReminderDate = new Date(currentReminderDate);
                        newReminderDate.setDate(newReminderDate.getDate() + 7); // Sumar una semana
                        break;
                    case "3": // Mensual
                        newReminderDate = new Date(currentReminderDate);
                        newReminderDate.setMonth(newReminderDate.getMonth() + 1); // Sumar un mes
                        break;
                    case "4": // Anual
                        newReminderDate = new Date(currentReminderDate);
                        newReminderDate.setFullYear(newReminderDate.getFullYear() + 1); // Sumar un año
                        break;
                    default:
                        newReminderDate = currentReminderDate; // Si no tiene frecuencia, se mantiene igual
                }

                // Actualizar la fecha de recordatorio a un valor especial tras el envío
                await admin.database().ref(`/tareas/${userId}/${taskId}`).update({ fecha_recordatorio: "9999-12-31" });

                // Además de actualizar la fecha de recordatorio, puedes optar por actualizarla con el nuevo valor para la próxima vez
                await admin.database().ref(`/tareas/${userId}/${taskId}`).update({ fecha_recordatorio: formatDate(newReminderDate) });
            }
        }

        // Procesar envíos en paralelo
        await Promise.all(emailPromises);
    }

    console.log('Verificación de recordatorios completada.');
    return res.status(200).send('Verificación de recordatorios completada.');
};



// 5. Limpiar tareas vencidas y archivar completadas

const cleanupOldTasks = async (req, res) => {
    console.log('Iniciando limpieza de tareas...');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Fecha actual sin hora

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30); // Fecha de hace 30 días

    const tasksRef = admin.database().ref('/tareas');
    const snapshot = await tasksRef.once('value');
    const tasks = snapshot.val();

    if (!tasks) {
        console.log('No se encontraron tareas para limpiar.');
        return res.status(200).send('No hay tareas para limpiar.');
    }

    const updates = {};
    let tasksUpdated = 0;
    let tasksDeleted = 0;

    for (const [userId, userTasks] of Object.entries(tasks)) {
        for (const [taskId, task] of Object.entries(userTasks)) {
            const taskDate = new Date(task.fecha_tarea);
            taskDate.setHours(0, 0, 0, 0);

            // Asegurarse de que el estado esté definido, si no lo está, asignar un valor predeterminado
            const taskEstado = task.estado !== undefined ? task.estado : ESTADOS.PENDIENTE;

            // Verificar que el estado sea válido antes de actualizarlo
            if (taskEstado === undefined || taskEstado === null) {
                console.error(`Tarea ${taskId} de usuario ${userId} tiene un estado inválido.`);
                continue; // Saltar a la siguiente tarea
            }

            // Archivar tareas completadas sin importar la fecha
            if (taskEstado === ESTADOS.COMPLETADA) { // Si el estado es "completada" (1)
                updates[`/tareas/${userId}/${taskId}/estado`] = ESTADOS.ARCHIVADA; // Archivar
                console.log(`Usuario ${userId}, tarea ${taskId}: Estado actualizado a ARCHIVADA.`);
                tasksUpdated++;
            }

            // Eliminar tareas archivadas que tengan más de 30 días
            if (taskEstado === ESTADOS.ARCHIVADA && taskDate < thirtyDaysAgo) {
                updates[`/tareas/${userId}/${taskId}`] = null; // Eliminar
                console.log(`Usuario ${userId}, tarea ${taskId}: Eliminada por superar los 30 días archivada.`);
                tasksDeleted++;
            }
        }
    }

    // Verificar si hay actualizaciones antes de hacer la operación
    if (Object.keys(updates).length > 0) {
        try {
            await admin.database().ref().update(updates);
        } catch (error) {
            console.error("Error al actualizar la base de datos:", error);
            return res.status(500).send("Error al realizar la actualización.");
        }
    }

    const responseMessage = [
        tasksUpdated > 0 ? `${tasksUpdated} tarea(s) archivada(s).` : '',
        tasksDeleted > 0 ? `${tasksDeleted} tarea(s) eliminada(s).` : ''
    ].filter(Boolean).join(' ');

    console.log('Limpieza de tareas completada.');
    return res.status(200).send(responseMessage || 'No hay tareas para archivar o eliminar.');
};

module.exports = {
    endDatos,
    getTasksByUserId,
    updateTask,
    verifyReminderTasks,
    cleanupOldTasks
};
