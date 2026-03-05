const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const userId = notification.userId;

    if (!userId) return null;

    // Get user's FCM tokens
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        console.log('User not found', userId);
        return null;
    }

    const userData = userDoc.data();
    const tokens = userData.fcmTokens || [];

    if (tokens.length === 0) {
      console.log('No tokens for user', userId);
      return null;
    }

    const payload = {
      notification: {
        title: 'Nuova Notifica RosyFit',
        body: notification.message,
        icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913465.png',
        click_action: '/' 
      }
    };

    const response = await admin.messaging().sendToDevice(tokens, payload);
    
    // Cleanup invalid tokens
    const tokensToRemove = [];
    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        console.error('Failure sending notification to', tokens[index], error);
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          tokensToRemove.push(tokens[index]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
       await admin.firestore().collection('users').doc(userId).update({
         fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
       });
    }
    
    return null;
  });
