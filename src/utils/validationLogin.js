  import { auth, provider } from '../static/js/firebaseconfig';
  import { signInWithPopup, onAuthStateChanged } from 'firebase/auth'; 

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error durante el login:', error);
    }
  };

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = '/home';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
      loginButton.addEventListener('click', handleLogin
        //  console.log("intentando conseguir al usuario")
      );
         
    }
  });
