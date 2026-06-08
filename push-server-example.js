/**
 * This is an example Node.js backend script that demonstrates how to implement 
 * "True Offline Push Notifications" for Knock Knock using Web Push.
 * 
 * To use this in production:
 * 1. Install web-push: `npm install web-push express cors dotenv`
 * 2. Generate VAPID keys: `npx web-push generate-vapid-keys`
 * 3. Save the keys in a .env file:
 *    VAPID_PUBLIC_KEY=your_public_key
 *    VAPID_PRIVATE_KEY=your_private_key
 * 4. Run this server: `node push-server-example.js`
 * 5. Update your frontend `sw.js` to subscribe using `pushManager.subscribe` and 
 *    send the subscription object to your database.
 */

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Setup VAPID details
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'REPLACE_WITH_PUBLIC_KEY';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'REPLACE_WITH_PRIVATE_KEY';

webpush.setVapidDetails(
  'mailto:support@knockknockapp.com',
  publicVapidKey,
  privateVapidKey
);

/**
 * Route: POST /notify
 * This route would be called by your Supabase Edge Functions or Database Webhooks
 * whenever a new message or call is created.
 */
app.post('/notify', (req, res) => {
  const { subscription, payload } = req.body;

  // Payload structure expected:
  // {
  //   title: 'Incoming call from John',
  //   body: 'Click to open Knock Knock',
  //   data: { url: '/call?direct=true&partnerId=123' }
  // }

  webpush
    .sendNotification(subscription, JSON.stringify(payload))
    .then(() => {
      res.status(201).json({ success: true });
    })
    .catch((err) => {
      console.error('Error sending notification:', err);
      // If the error is 410 (Gone), the user unsubscribed.
      // You should delete the subscription from your Supabase database here.
      res.status(500).json({ success: false, error: err.message });
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Push server running on port ${PORT}`);
});
