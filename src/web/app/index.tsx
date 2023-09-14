// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as React from 'react';
import { App } from './app';

import 'css/bootstrap.min.css';
import 'css/style.css';

const root = document.getElementById('root');
if (root != null) {
  const reactRoot = createRoot(root);
  reactRoot.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
