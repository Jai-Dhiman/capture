const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  isCSSEnabled: true,
  resolver: {
    platforms: ["ios", "android", "web"],
    unstable_enablePackageExports: false,
    unstable_enableSymlinks: true,
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
  sourceExts: [...resolver.sourceExts, "svg", "web.ts", "web.tsx", "web.js"],
  unstable_enablePackageExports: false,
  unstable_enableSymlinks: true,
};

module.exports = withNativeWind(config, { input: "./global.css" });
