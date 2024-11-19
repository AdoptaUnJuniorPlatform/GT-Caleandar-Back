// functions/config/mailConfig.js

const nodemailer = require('nodemailer');

// Configurar el transporte de correos usando variables de entorno

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports = transporter;
