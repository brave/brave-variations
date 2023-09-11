// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
module.exports = {
  entry: './web/build/web/src/index.js',
  mode: 'production',
  output: {
    path: path.join(__dirname, 'web', 'static'),
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      css: path.resolve(__dirname, 'web/css/'),
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
    ],
  },
};
