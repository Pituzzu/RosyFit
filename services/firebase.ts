
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBZL0c-lLQSzDN_ueCw7qoTQxYDZ2bypos",
  authDomain: "palestralocampo.firebaseapp.com",
  projectId: "palestralocampo",
  storageBucket: "palestralocampo.firebasestorage.app",
  messagingSenderId: "958313565109",
  appId: "1:958313565109:web:7bcf593a31f5a83eb127fc",
  measurementId: "G-X568F3YT04"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const messaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
    return null;
  } catch (err) {
    console.error("Firebase Messaging not supported", err);
    return null;
  }
};
