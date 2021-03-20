module.exports = {
    entry: './js/app.js',
    mode: 'development',
    output: {
      path: `${__dirname}/static`,
      filename: 'bundle.js',
    },
    resolve: {
      alias: {
        vue: 'vue/dist/vue.min.js'
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
        }
      ],
    },
};