const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.projectRoot = __dirname;
config.server = {
  ...(config.server || {}),
  unstable_serverRoot: __dirname,
};

// Watch local modules and monorepo root so Metro picks them up
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, 'modules'),
  path.resolve(__dirname, '../..'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@workspace/api-client-react': path.resolve(__dirname, '../../lib/api-client-react/src'),
  'expo-device-admin': path.resolve(__dirname, 'modules/expo-device-admin'),
};

module.exports = config;
