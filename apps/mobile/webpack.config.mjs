import path from 'node:path';
import { createExpoWebpackConfigAsync } from '@expo/webpack-config';

export default async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  config.resolve.alias['@'] = path.resolve(__dirname, './src');
  config.resolve.alias['@assets'] = path.resolve(__dirname, './assets');

  config.devServer = config.devServer || {};
  config.devServer.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
  };

  config.module.rules.push({
    test: /\.ts(x?)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
      },
    },
  });

  return config;
}
