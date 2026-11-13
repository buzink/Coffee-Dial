import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
    apiKey: 'AIzaSyADTao9VnV_UTHcLrbtYyM7QE9vIwPd2Mw',
    authDomain: 'coffee-dial-buzink.firebaseapp.com',
    projectId: 'coffee-dial-buzink',
    storageBucket: 'coffee-dial-buzink.firebasestorage.app',
    messagingSenderId: '669572954724',
    appId: '1:669572954724:web:39545364784d8b36af7d71'
};

export const WEB_PUSH_VAPID_KEY = 'BPJDSgMnLuRDdj-TK_zCYEqfjBgQef_CZU1L_MVlzIbHYBkIluGdj1oWFnPQ6lUftK7CKirEUkO0Ybj7MpNLKC8';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Enable IndexedDB persistence for offline support and faster repeat visits
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export const provider = new GoogleAuthProvider();

let functionsInstancePromise = null;
let functionsApiPromise = null;
let messagingApiPromise = null;
let storageInstancePromise = null;
let storageApiPromise = null;

export const loadFunctionsApi = () => {
    if (!functionsApiPromise) {
        functionsApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js');
    }
    return functionsApiPromise;
};

export const getFunctionsInstance = async () => {
    if (!functionsInstancePromise) {
        functionsInstancePromise = loadFunctionsApi().then(({ getFunctions }) => getFunctions(app, 'us-central1'));
    }
    return functionsInstancePromise;
};

export const loadMessagingApi = () => {
    if (!messagingApiPromise) {
        messagingApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
    }
    return messagingApiPromise;
};

export const loadStorageApi = () => {
    if (!storageApiPromise) {
        storageApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js');
    }
    return storageApiPromise;
};

export const getStorageInstance = async () => {
    if (!storageInstancePromise) {
        storageInstancePromise = loadStorageApi().then(({ getStorage }) => getStorage(app));
    }
    return storageInstancePromise;
};
