import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('WEB_PUSH_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('WEB_PUSH_VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
