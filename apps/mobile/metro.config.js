// Expo's default Metro config detects npm workspaces and watches the repo root,
// so the shared packages under packages/ resolve from source with no extra setup.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
