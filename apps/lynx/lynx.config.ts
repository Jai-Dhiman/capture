import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginSass } from '@rsbuild/plugin-sass'
import Dotenv from 'dotenv-webpack'

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`
      },
    }),
    pluginReactLynx(),
    pluginSass({
      sassLoaderOptions: {},
    }),
  ],
  tools: {
    cssLoader: {
      modules: {
        auto: /\.module\.(css|scss|sass)$/,
        localIdentName: '[name]__[local]--[hash:base64:5]',
      },
    },
    rspack: {
      plugins: [
        new Dotenv({
          path: './.env',
          safe: true,
        }),
      ],
    },
  },
})
