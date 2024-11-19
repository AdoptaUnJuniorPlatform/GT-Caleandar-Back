import { openReminderForm } from "../stores/store";

const modal = document.querySelector(".modal");
const cancelModal = document.getElementById('cancelBtn');
const closeModal = document.getElementById('closeBtn');
const reminderButtons = document.querySelectorAll('.new-reminder');
const handleCloseModal = () => {
    openReminderForm.set(false);
};

cancelModal.addEventListener('click', handleCloseModal);
closeModal.addEventListener('click', handleCloseModal);

reminderButtons.forEach((button) => {
    button.addEventListener('click', () => {
        openReminderForm.set(true);
        button.blur();
    });
});

openReminderForm.listen(() => {
    if (openReminderForm.get() === true) {
        modal.classList.add('is-active');
    } else {
        modal.classList.remove('is-active');
    }
});
