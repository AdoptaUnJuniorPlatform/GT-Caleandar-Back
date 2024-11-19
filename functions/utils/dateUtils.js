// functions/utils/dateUtils.js

// Función para formatear fechas en 'YYYY-MM-DD' para comparar con facilidad
const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Agrega ceros iniciales si es necesario
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Función para comparar si una fecha es anterior a otra
const isBeforeToday = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reinicia horas, minutos, segundos y milisegundos
    return new Date(date) < today;
};


// Funcion para ver si la fecha es la fecha de hoy
function isToday(date) {
    const today = new Date().toISOString().split('T')[0]; // Solo la fecha en formato "YYYY-MM-DD"
    const start = new Date(date).toISOString().split('T')[0];
    return today === start;
}


// Exportar las funciones
module.exports = { formatDate, isBeforeToday, isToday };
