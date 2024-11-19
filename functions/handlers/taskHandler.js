const admin = require('../firebaseConfig');
const transporter = require('../config/mailConfig');
const { sendTaskReminder } = require('./mailHandler');
const cors = require('../middleware/corsMiddleware');
const { formatDate, isToday, isBeforeToday } = require('../utils/dateUtils');

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
            const formattedTasks = Object.fromEntries(
                Object.entries(tasks).map(([taskId, task]) => {
                    // Convertir estado a nombre
                    const estadoNombre = indice_estados[task.estado] || task.estado;
                    // Convertir periodicidad a nombre
                    const periodicidadNombre = indice_periodicidad[task.periodicidad?.tipo] || task.periodicidad?.tipo;

                    return [
                        taskId,
                        {
                            ...task,
                            estado: estadoNombre,
                            periodicidad: {
                                ...task.periodicidad,
                                tipo: periodicidadNombre
                            }
                        }
                    ];
                })
            );

            return res.status(200).json(formattedTasks);
        } catch (error) {
            console.error('Error al recuperar las tareas:', error);
            return res.status(500).json({ error: 'Error al recuperar las tareas' });
        }
    });
};

// 3. Actualizar una tarea existente
const updateTask = async (data, context) => {
    // Verificar si el usuario está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'El usuario no está autenticado');
    }

    const { userId, tareaId, descripcion, email_responsables, estado, fecha_inicio, titulo, periodicidad } = data;

    // Verificar que se haya proporcionado el userId y tareaId
    if (!userId || !tareaId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos importantes: userId o tareaId');
    }

    const taskRef = admin.database().ref(`/tareas/${userId}/${tareaId}`);
    const taskSnapshot = await taskRef.once('value');

    // Verificar si la tarea existe
    if (!taskSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'La tarea no existe');
    }

    // Preparar los datos actualizados para la tarea
    const updatedTaskData = {
        ...(descripcion && { descripcion }),
        ...(email_responsables && { email_responsables: email_responsables.split(',') }),
        ...(estado && { estado: parseInt(estado, 10) }),  // Convertir a número si es necesario
        ...(fecha_inicio && { fecha_inicio }),
        ...(titulo && { titulo }),
        ...(periodicidad && { periodicidad: { tipo: parseInt(periodicidad.tipo, 10) } })  // Convertir periodicidad a número
    };

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

// 4. Verificar tareas diarias y enviar recordatorios
const verifyDailyTasks = async (req, res) => {
    cors(req, res, async () => {
        console.log('Verificando tareas para hoy...');
        const today = formatDate(new Date());

        const tasksRef = admin.database().ref('/tareas');
        const snapshot = await tasksRef.once('value');
        const tasks = snapshot.val();

        if (!tasks) return res.status(200).send('No hay tareas en la base de datos');

        for (const userId in tasks) {
            const userTasks = tasks[userId];
            for (const taskId in userTasks) {
                const { fecha_tarea, email_responsables, descripcion, titulo, periodicidad } = userTasks[taskId];
                if (formatDate(fecha_tarea) === today) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: email_responsables.join(', '),
                        subject: `Recordatorio: ${titulo}`,
                        text: `Descripción de la tarea: ${descripcion}`
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
};

// 5. Limpiar tareas vencidas y archivar completadas

const cleanupOldTasks = async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Asegura que 'today' solo tenga la fecha, sin la hora

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30); // 30 días atrás
    thirtyDaysAgo.setHours(0, 0, 0, 0); // Asegura que 'thirtyDaysAgo' también tenga solo la fecha

    console.log('Fecha de hoy:', formatDate(today));
    console.log('Fecha límite para eliminar (30 días atrás):', formatDate(thirtyDaysAgo));

    const tasksRef = admin.database().ref('/tareas');
    const snapshot = await tasksRef.once('value');
    const tasks = snapshot.val();

    if (!tasks) return res.status(200).send('No hay tareas para limpiar.');

    const updates = {};
    let tasksUpdated = 0;
    let tasksDeleted = 0;

    Object.entries(tasks).forEach(([userId, userTasks]) => {
        Object.entries(userTasks).forEach(([taskId, task]) => {
            const taskDate = new Date(task.fecha_tarea);
            taskDate.setHours(0, 0, 0, 0); // Asegura que 'taskDate' solo tenga la fecha

            // Si estado está vacío, asignar un valor predeterminado basado en la fecha
            let taskEstado = task.estado;
            if (taskEstado === undefined || taskEstado === null || taskEstado === '') {
                // Si la tarea no tiene estado y la fecha es anterior a hoy, asignar "completada" (estado 1)
                taskEstado = (taskDate < today) ? 1 : 0; // 1 = completada, 0 = pendiente
            }

            // Archivar tareas completadas si su fecha es anterior a hoy
            if (taskEstado === 1 && taskDate < today) {  // estado "completada"
                updates[`/tareas/${userId}/${taskId}/estado`] = 2; // Cambiar estado a "Archivada"
                tasksUpdated++;
            }

            // Eliminar tareas archivadas que tengan más de 30 días
            if (taskEstado === 2 && taskDate < thirtyDaysAgo) {  // estado "archivada"
                updates[`/tareas/${userId}/${taskId}`] = null; // Eliminar tarea
                tasksDeleted++;
            }
        });
    });

    if (tasksUpdated > 0) {
        await admin.database().ref().update(updates);
    }

    if (tasksUpdated > 0 || tasksDeleted > 0) {
        const responseMessage = [];
        if (tasksUpdated > 0) {
            responseMessage.push(`${tasksUpdated} tarea(s) archivada(s).`);
        }
        if (tasksDeleted > 0) {
            responseMessage.push(`${tasksDeleted} tarea(s) eliminada(s).`);
        }
        return res.status(200).send(responseMessage.join(' '));
    } else {
        return res.status(200).send('No hay tareas para archivar o eliminar.');
    }
};



module.exports = {
    endDatos,
    getTasksByUserId,
    updateTask,
    verifyDailyTasks,
    cleanupOldTasks
};