
const { sendMail } = require('../config/mailConfig');  // Importa la función de envío de correos

// Función para enviar un recordatorio de tarea
const sendTaskReminder = async (email_responsables, descripcion, titulo, starTime) => {
    // Creamos las opciones del correo
    const mailOptions = {
        from: process.env.EMAIL_USER,                   // Correo desde el que se enviará el mensaje
        to: email_responsables.join(', '),              // Los destinatarios del correo, separados por coma
        subject: `${starTime} - Recordatorio: ${titulo}`,  // Asunto del correo con la hora

        text: `Descripción de la tarea: ${descripcion}`  // Cuerpo del correo
    };

    try {
        // Usamos la función sendMail desde el archivo mailConfig.js
        await sendMail(mailOptions);  // Enviar correo
        console.log(`Correo enviado a: ${email_responsables.join(', ')}`);  // Log de éxito
    } catch (error) {
        // Si hay un error, lo capturamos y lo mostramos en el log
        console.error('Error al enviar correo para la tarea:', error);
    }
};

module.exports = { sendTaskReminder };  // Exportamos la función para que pueda ser usada en otros archivos
