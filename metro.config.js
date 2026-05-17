const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      // Resolve @assets/ alias to ./assets/ relative to project root
      if (moduleName.startsWith('@assets/')) {
        const realPath = moduleName.replace('@assets/', './assets/');
        return context.resolveRequest(context, realPath, platform);
      }
      // Fall back to default resolution for everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
