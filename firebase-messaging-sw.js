importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBZL0c-lLQSzDN_ueCw7qoTQxYDZ2bypos",
  authDomain: "palestralocampo.firebaseapp.com",
  projectId: "palestralocampo",
  storageBucket: "palestralocampo.firebasestorage.app",
  messagingSenderId: "958313565109",
  appId: "1:958313565109:web:7bcf593a31f5a83eb127fc",
  measurementId: "G-X568F3YT04"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Assicurati di avere un'icona
    badge: '/badge.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
