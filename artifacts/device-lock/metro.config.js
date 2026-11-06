const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

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
  rootNodeModules,
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@workspace/api-client-react': path.resolve(__dirname, '../../lib/api-client-react/src'),
  'expo-device-admin': path.resolve(__dirname, 'modules/expo-device-admin'),
  '@tanstack/react-query': path.resolve(rootNodeModules, '@tanstack/react-query'),
  '@tanstack/query-core': path.resolve(rootNodeModules, '@tanstack/query-core'),
  react: path.resolve(rootNodeModules, 'react'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@tanstack/react-query' ||
    moduleName === '@tanstack/query-core' ||
    moduleName === 'react'
  ) {
    return context.resolveRequest(
      {
        ...context,
        originModulePath: path.resolve(__dirname, '../../package.json'),
      },
      moduleName,
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
