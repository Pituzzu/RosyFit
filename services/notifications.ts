
import { messaging, db, auth } from './firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await saveFCMToken();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const saveFCMToken = async () => {
  try {
    const msg = await messaging();
    if (!msg) return;

    // VAPID Key: Generala dalla Console Firebase -> Project Settings -> Cloud Messaging -> Web Push certificates
    const vapidKey = "BKy9..."; // TODO: Inserisci la tua VAPID Key qui

    const token = await getToken(msg, { vapidKey });
    
    if (token && auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
      console.log('FCM Token saved:', token);
    }
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};

export const sendNotification = (title: string, body: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png' });
  }
};
