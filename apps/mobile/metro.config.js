const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname, {
  isCSSEnabled: true,
  resolver: {
    platforms: ['ios', 'android', 'web'],
  },
});

const { transformer, resolver } = config;

// SVG transformer removed - now using expo-image with SVG strings
config.transformer = {
  ...transformer,
};
config.resolver = {
  ...resolver,
  alias: {
    buffer: require.resolve('buffer'),
  },
};

const webExtensions = ['web.ts', 'web.tsx', 'web.js'];
for (const ext of webExtensions) {
  if (!config.resolver.sourceExts.includes(ext)) {
    config.resolver.sourceExts.push(ext);
  }
}

config.resolver.unstable_enablePackageExports =
  config.resolver.unstable_enablePackageExports ?? false;
config.resolver.unstable_enableSymlinks = config.resolver.unstable_enableSymlinks ?? true;

module.exports = withNativeWind(config, { input: './global.css' });
