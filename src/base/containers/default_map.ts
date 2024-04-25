// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

export type DefaultFactory<K, V> = (key?: K) => V;

export default class DefaultMap<K, V> extends Map<K, V> {
  private readonly defaultFactory: DefaultFactory<K, V>;

  constructor(defaultFactory: DefaultFactory<K, V>) {
    super();
    this.defaultFactory = defaultFactory;
  }

  get(key: K): V {
    let v: V | undefined = super.get(key);
    if (v === undefined) {
      v = this.defaultFactory(key);
      this.set(key, v);
    }
    return v;
  }
}
