const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  isCSSEnabled: true,
  resolver: {
    platforms: ["ios", "android", "web"],
  },
});

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
  alias: {
    buffer: require.resolve('buffer'),
  },
};

const webExtensions = ["web.ts", "web.tsx", "web.js"];
for (const ext of webExtensions) {
  if (!config.resolver.sourceExts.includes(ext)) {
    config.resolver.sourceExts.push(ext);
  }
}

config.resolver.unstable_enablePackageExports = config.resolver.unstable_enablePackageExports ?? false;
config.resolver.unstable_enableSymlinks = config.resolver.unstable_enableSymlinks ?? true;

module.exports = withNativeWind(config, { input: "./global.css" });
