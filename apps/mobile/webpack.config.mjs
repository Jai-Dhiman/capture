import { createExpoWebpackConfigAsync } from "@expo/webpack-config";

export default async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.devServer = config.devServer || {};
  config.devServer.headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
  };

  config.module.rules.push({
    test: /\.ts(x?)$/,
    exclude: /node_modules/,
    use: {
      loader: "babel-loader",
      options: {
        presets: ["babel-preset-expo"],
      },
    },
  });

  return config;
}
