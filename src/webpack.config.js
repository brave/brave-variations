// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')
module.exports = {
    entry: './web/src/app.ts',
    mode: 'production',
    output: {
      path: path.join(__dirname, 'web', 'static'),
      filename: 'bundle.js',
    },
    resolve: {
      alias: {
        vue: 'vue/dist/vue.esm.browser.min.js'
      },
      extensions: [".ts", ".js"],
      extensionAlias: {
        ".js": [".js", ".ts"],
      }
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            'style-loader',
            'css-loader',
          ],
        },
        {
          test: /\.ttf$/,
          use: [
            'url-loader',
          ],
        },
        {
          test: /.(svg|jpg|jpeg|png)$/,
          use: ['file-loader'],
        },
        {
          test: /.(ts)$/,
          // use: ['ts-loader'],
          loader: require.resolve('ts-loader'),
          options: {
            configFile: 'web/tsconfig.json',
          }
        }
      ],
    },
};
