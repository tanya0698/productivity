const fs = require("fs");
const path = require("path");

/**
 * app.json, plus Firebase when its config is present: google-services.json
 * (from the Firebase console, Android app com.creedence.app) lets the phone
 * receive reminders pushed by the server through FCM. Without it the app
 * still builds and works, with only the alarms it schedules itself.
 */
module.exports = ({ config }) => {
  const file = path.join(__dirname, "google-services.json");
  if (!fs.existsSync(file)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: "./google-services.json" } };
};
