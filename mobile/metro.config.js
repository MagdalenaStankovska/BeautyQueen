// The booking rules (opening hours, slot availability) are shared with the web app:
// mobile imports ../my-react-app/src/salon.js instead of keeping a second copy.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "../my-react-app/src")];

module.exports = config;
