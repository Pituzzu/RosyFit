
export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Colazione', startHour: 7, endHour: 10, message: 'Buongiorno Atleta! ☕ È ora di fare una sana colazione.' },
  { id: 'snack_morning', label: 'Spuntino', startHour: 10, endHour: 12, message: 'Piccola pausa? 🍎 Ricordati lo spuntino di metà mattina!' },
  { id: 'lunch', label: 'Pranzo', startHour: 12, endHour: 14, message: 'È ora di pranzo! 🥗 Nutri i tuoi muscoli.' },
  { id: 'snack_afternoon', label: 'Merenda', startHour: 16, endHour: 18, message: 'Energy boost! 🍌 Tempo di merenda.' },
  { id: 'dinner', label: 'Cena', startHour: 19, endHour: 21, message: 'Cena time! 🍲 Chiudi la giornata con un pasto bilanciato.' },
];

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('Questo browser non supporta le notifiche desktop');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const checkAndSendNotifications = () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  MEAL_SLOTS.forEach(slot => {
    // Controlla se siamo nell'orario giusto
    if (currentHour >= slot.startHour && currentHour < slot.endHour) {
      const storageKey = `rosyfit_notif_${todayStr}_${slot.id}`;
      const alreadySent = localStorage.getItem(storageKey);

      // Se non abbiamo ancora inviato la notifica per questo slot oggi
      if (!alreadySent) {
        sendNotification(slot.label, slot.message);
        localStorage.setItem(storageKey, 'true');
      }
    }
  });
};

const sendNotification = (title: string, body: string) => {
  try {
    const notification = new Notification(`ROSYFIT: ${title}`, {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png', // Icona generica pasto/fit
      badge: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
      tag: 'rosyfit-meal-reminder' // Evita spam sovrapponendo notifiche simili
    });
    
    // Chiudi automaticamente dopo 5 secondi
    setTimeout(() => notification.close(), 5000);
  } catch (e) {
    console.error("Errore invio notifica:", e);
  }
};
