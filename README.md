# Proyecto en Astro para realizar pruebas del backend

Para iniciar el proyecto:
1. Clonar repositorio
2. Navegar a la raiz del proyecto e instalar dependencias:

    ```sh
    npm install
    ```
3. Ejecutar servidor local:

    ```sh
    npm run dev
    ```
---
4.Añadir Variables de entorno tanto para el front .env de la raiz del proyecto como en back para que la funcion de correos funcione /functions/.env
se añade en la variable de front la informacion de autenticacion de firebase, y en la variable de back correo del usuario que vaya a mandar los correos de la tareas mas la  contraseña

5. Con las nuevas ramas no es necesario añadir las herramientas de firebase.

      ```sh
    npm install firebase -g tools
    ```

7. Importante, dentro de la carpeta functions hay que añadir los repositorios de node tambien:
   
    ```sh
    npm install
    ```

   
# ToDo:
- [X] Firebase
    - [X]  Configurar Realtime Database
    - [X]  Cloud Functions   
- [X] Conectar proyecto Firebase con Astro
- [X] Inicio de sesión:
    - [X] Login mediante Gmail, autorización mediante tokens
    - [X] Registro si la cuenta no está registrada
        - [ ] Login y registro solo mediante un dominio establecido 
    - [ ] Manejo de sesión, expiración de token
- [X] Crud tareas:
    - [X] Añadir tarea
    - [X] Eliminar tarea
    - [] Editar tarea
    - [] Modificar tarea
- [ ] Recordatorios:
    - [X] Envio mediante email al usuario en fecha y con la periodicidad establecida
    - [ ] Envio de recordatorios por email solo a dominio establecido

<!-- Para marcar una tarea completada, se agrega una x entre los corchetes, ej. - [x] Firebase -->

---

*Los scripts y archivos temporales a utilizar los dejé en src/static*

*Recordar subir los respectivos cambios en una nueva rama y utilizar issues para controlar las versiones y evitar problemas*
