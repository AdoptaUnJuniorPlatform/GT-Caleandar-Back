

const admin = require('../firebaseConfig');  // Importa la instancia de Firebase configurada
const { sendMail } = require('../config/mailConfig');  // Importa la función de envío de correos

// Función para enviar un recordatorio de tarea
const sendTaskReminder = async (email_responsables, descripcion, titulo) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email_responsables.join(', '),
        subject: `Recordatorio: ${titulo}`,
        text: `Descripción de la tarea: ${descripcion}`
    };

    try {
        await sendMail(mailOptions);  // Usa la función de mailConfig
        console.log(`Correo enviado a: ${email_responsables.join(', ')}`);
    } catch (error) {
        console.error('Error al enviar correo para la tarea:', error);
    }
};

module.exports = { sendTaskReminder };
