module.exports = (api) => {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [
      "react-native-reanimated/plugin",
      "@babel/plugin-transform-runtime",
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          safe: false,
          allowUndefined: true,
        },
      ],
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
          alias: {
            "@features": "./src/features",
            "@shared": "./src/shared",
            "@navigation": "./src/navigation",
            "@app": "./src",
            "@assets": "./assets"
          }
        }
      ]
    ],
  };
};
