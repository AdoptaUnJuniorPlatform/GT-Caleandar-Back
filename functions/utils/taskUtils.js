// utils/taskUtils.js

const indice_estados = ["Pendiente", "Completada", "Archivada"];
const indice_periodicidad = [
    "No repetición", 
    "Diaria", 
    { 
        "configsemana": { 
            "dia_inicio": [null, "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"], 
            "n_semanas": "Número de semanas por defecto 0"
        }, 
        "nombre": "Semanal"
    },
    "Mensual", 
    "Anual"
];

// Función para convertir estado
const convertirEstado = (estado) => {
    return indice_estados[estado] || estado;
};

// Función para convertir periodicidad
const convertirPeriodicidad = (frecuencia) => {
    let periodicidadNombre = "Sin periodicidad";
    
    if (frecuencia) {
        if (frecuencia.tipo) {
            periodicidadNombre = indice_periodicidad[frecuencia.tipo] || frecuencia.tipo;
        }
        
        // Si la periodicidad es semanal, añadir día de inicio y número de semanas
        if (frecuencia.tipo === "2" && frecuencia.dia_inicio === null) {
            // Si no se proporciona el día de inicio, asignar "Lunes" por defecto
            const dia_inicio = "Lunes";
            const n_semanas = frecuencia.n_semanas || "1";
            periodicidadNombre = `${periodicidadNombre} - ${dia_inicio}, cada ${n_semanas} semana(s)`;
        } else if (frecuencia.tipo === "2" && frecuencia.dia_inicio) {
            const dia_inicio = indice_periodicidad[2]?.configsemana?.dia_inicio[frecuencia.dia_inicio] || "Lunes";
            const n_semanas = frecuencia.n_semanas || "1";
            periodicidadNombre = `${periodicidadNombre} - ${dia_inicio}, cada ${n_semanas} semana(s)`;
        }
    }

    return periodicidadNombre;
};

// Exportar las funciones para usarlas en otros archivos
module.exports = {
    convertirEstado,
    convertirPeriodicidad
};
