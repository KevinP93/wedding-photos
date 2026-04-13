const webpush = require('web-push');

function getPublicPushKey() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';

  if (!publicKey) {
    throw new Error('Clé VAPID publique manquante.');
  }

  return publicKey;
}

function getPushConfig() {
  const publicKey = getPublicPushKey();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
  const contact = process.env.WEB_PUSH_CONTACT || 'mailto:hello@example.com';

  if (!privateKey) {
    throw new Error('Clé VAPID privée manquante.');
  }

  return {
    publicKey,
    privateKey,
    contact
  };
}

function configureWebPush() {
  const { publicKey, privateKey, contact } = getPushConfig();
  webpush.setVapidDetails(contact, publicKey, privateKey);
  return { publicKey };
}

function buildNotificationPayload({ title, body, url, tag }) {
  return JSON.stringify({
    notification: {
      title,
      body,
      icon: '/assets/icons/KG_logo-192x192.png',
      badge: '/assets/icons/KG_logo-192x192.png',
      tag,
      renotify: false,
      data: {
        url,
        onActionClick: {
          default: {
            operation: 'openWindow',
            url
          }
        }
      }
    }
  });
}

async function sendPushToSubscriptions(subscriptions, payload) {
  const invalidEndpoints = [];
  let deliveredCount = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        payload
      );
      deliveredCount++;
    } catch (error) {
      const statusCode = error?.statusCode || 0;
      if (statusCode === 404 || statusCode === 410) {
        invalidEndpoints.push(subscription.endpoint);
      } else {
        console.error('Erreur lors de l\'envoi push :', error);
      }
    }
  }

  return {
    deliveredCount,
    invalidEndpoints
  };
}

module.exports = {
  getPublicPushKey,
  configureWebPush,
  buildNotificationPayload,
  sendPushToSubscriptions
};
