import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
    apiKey: import.meta.env.PUBLIC_API_KEY,
    authDomain: import.meta.env.PUBLIC_AUTH_DOMAIN,
    databaseURL: import.meta.env.PUBLIC_DATABASE_URL,
    projectId: import.meta.env.PUBLIC_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_APP_ID,
    measurementId: import.meta.env.PUBLIC_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const database = getDatabase(app);

setPersistence(auth, browserLocalPersistence);

export { auth, provider, database };