// Función de validación del formulario
function validateForm() {
    let isValid = true;

    // Validación del título del recordatorio
    const titleInput = document.getElementById("title");
    const titleError = document.getElementById("titleError");
    if (titleInput.value.trim() === "") {
        titleError.textContent = "El título del recordatorio es obligatorio.";
        isValid = false;
    } else {
        titleError.textContent = "";
    }

    // Validación de la fecha de inicio
    const dayStartInput = document.getElementById("dayStar");
    const dayError = document.getElementById("dayError");
    if (dayStartInput.value.trim() === "") {
        dayError.textContent = "Seleccione una fecha de inicio.";
        isValid = false;
    } else {
        dayError.textContent = "";
    }

    // Validación de la fecha de fin (opcional)
    const dayEndInput = document.getElementById("dayEnd");
    if (dayEndInput.value.trim() !== "" && dayStartInput.value > dayEndInput.value) {
        dayError.textContent = "La fecha de fin debe ser posterior a la fecha de inicio.";
        isValid = false;
    } else {
        dayError.textContent = "";
    }

    // Validación de la hora de inicio
    const startTimeInput = document.getElementById("starTime");
    const hourError = document.getElementById("hourError");
    if (startTimeInput.value.trim() === "") {
        hourError.textContent = "Seleccione una hora de inicio.";
        isValid = false;
    } else {
        hourError.textContent = "";
    }

    // Validación de la repetición
    const repeatInput = document.getElementById("repeat");
    const repeatError = document.getElementById("repeatError");
    if (!repeatInput.value) {
        repeatError.textContent = "Seleccione una opción de repetición.";
        isValid = false;
    } else {
        repeatError.textContent = "";
    }

    // Validación de la descripción
    const descriptionInput = document.getElementById("description");
    const descriptionError = document.getElementById("descriptionError");
    if (descriptionInput.value.trim() === "") {
        descriptionError.textContent = "La descripción es obligatoria.";
        isValid = false;
    } else {
        descriptionError.textContent = "";
    }

    // Validación de participantes (opcional)
    const participantInput = document.getElementById("participant");
    const participantError = document.getElementById("participantError");
    if (participantInput.value.trim() !== "") {
        const participants = participantInput.value.split(',').map(item => item.trim());
        if (!participants.every(validateEmailOrName)) {
            participantError.textContent = "Algunos participantes tienen formato inválido.";
            isValid = false;
        } else {
            participantError.textContent = "";
        }
    }

    return isValid;
}

// Función auxiliar para validar si el valor ingresado es un nombre o un correo electrónico válido
function validateEmailOrName(value) {
    // Expresión regular para validar correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Expresión regular para validar un nombre (letras y espacios)
    const nameRegex = /^[a-zA-Z\s]+$/;

    return emailRegex.test(value) || nameRegex.test(value);
}

// Exportar la función
export default validateForm;
