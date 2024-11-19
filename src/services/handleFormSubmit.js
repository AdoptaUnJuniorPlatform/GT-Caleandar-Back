import validateForm from "../utils/validationForm";
import sendFormData from "./sendFormData";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("taskForm");
  form.addEventListener("submit", handleFormSubmit);
});


// Función para manejar el envío del formulario
export async function handleFormSubmit(event) {
//console.log('Formulario enviado');// prueba de que conecta
    event.preventDefault();

    // Validar el formulario
    const isValid = validateForm();
  //  console.log('Formulario válido:', isValid); // Log de validación
    if (!isValid) return;

    // Obtener los datos del formulario
    const form = document.getElementById("taskForm");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
   // console.log('Datos del formulario:', data); // Log de los datos del formulario

    const formError = document.getElementById("formError");
    
    // Enviar los datos al backend
    try {
        console.log('Enviando datos al servidor...'); // Log de inicio de envío
        await sendFormData(data);
        alert("Recordatorio creado exitosamente.");
        formError.textContent = "";
    } catch (error) {
        // Mostrar un mensaje específico si el backend proporciona uno
        if (error.message === "No estás autenticado.") {
            formError.textContent = "Por favor, inicia sesión para crear un recordatorio.";
        } else if (error.message) {
            // Mostrar el mensaje de error específico del backend
            formError.textContent = error.message;
        } else {
            // Mostrar un mensaje genérico si no hay un mensaje específico
            formError.textContent = "Hubo un error al enviar el formulario. Inténtalo de nuevo más tarde.";
        }
    
        console.error("Error al enviar los datos:", error); // Log del error
    }
}
