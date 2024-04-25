// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'assert';

export default class Result<T, E> {
  private readonly _value: T | undefined;
  private readonly _error: E | undefined;

  private constructor(value: T | undefined, error: E | undefined) {
    this._value = value;
    this._error = error;
  }

  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(value, undefined);
  }

  static error<E>(error: E): Result<never, E> {
    return new Result<never, E>(undefined, error);
  }

  get ok(): boolean {
    return this._error === undefined;
  }

  get value(): T {
    assert(this.ok);
    return this._value as T;
  }

  get error(): E {
    assert(!this.ok);
    return this._error as E;
  }
}
