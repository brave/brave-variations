// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

function isDevMode(argv) {
  return process.env.NODE_ENV === 'development' || argv.mode === 'development'
}

module.exports = (env, argv) => ({
  entry: './web/src/index.tsx',
  output: {
    path: path.join(__dirname, 'public', 'bundle'),
    filename: 'app.js',
  },
  devServer: {
    devMiddleware: {
      index: false,
      publicPath: '/bundle',
    },
    static: path.resolve(__dirname, 'public'),
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".css"],
    alias: {
      css: path.resolve(__dirname, 'css'),
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['url-loader'],
      },
      {
        test: /.(svg|jpg|jpeg|png)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
        },
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              transpileOnly: isDevMode(argv),
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
});
