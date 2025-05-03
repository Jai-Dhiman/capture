module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel", "@babel/preset-typescript"],
    plugins: [
      "react-native-reanimated/plugin",
      "@babel/plugin-transform-runtime",
      ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
