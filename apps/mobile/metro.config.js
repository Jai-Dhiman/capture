// const { withNativeWind } = require("nativewind/metro");
// const {
//   getSentryExpoConfig
// } = require("@sentry/react-native/metro");

// const config = getSentryExpoConfig(__dirname, {
//   isCSSEnabled: true,
//   resolver: { platforms: ["ios", "android", "web"] },
// });

// const { transformer, resolver } = config;
// config.transformer = {
//   ...transformer,
//   babelTransformerPath: require.resolve("react-native-svg-transformer"),
// };
// config.resolver = {
//   ...resolver,
//   assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
//   sourceExts: [...resolver.sourceExts, "svg", "web.ts", "web.tsx", "web.js"],
// };

// module.exports = withNativeWind(config, { input: "./global.css" });

const { getDefaultConfig } = require("expo/metro-config");

// Create the default Expo config with no customizations
const config = getDefaultConfig(__dirname);

module.exports = config;
