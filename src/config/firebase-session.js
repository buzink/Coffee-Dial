import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyADTao9VnV_UTHcLrbtYyM7QE9vIwPd2Mw',
    authDomain: 'coffee-dial-buzink.firebaseapp.com',
    projectId: 'coffee-dial-buzink',
    storageBucket: 'coffee-dial-buzink.firebasestorage.app',
    messagingSenderId: '669572954724',
    appId: '1:669572954724:web:39545364784d8b36af7d71'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
