// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Version } from './version';

describe('Version', () => {
  describe('parse', () => {
    const testCases = [
      { input: '', components: [] },
      { input: ' ', components: [] },
      { input: '\t', components: [] },
      { input: '\n', components: [] },
      { input: '  ', components: [] },
      { input: '.', components: [] },
      { input: ' . ', components: [] },
      { input: '0', components: [0] },
      { input: '0.', components: [] },
      { input: '0.0', components: [0, 0] },
      {
        input: '4294967295.0',
        components: [4294967295, 0],
      },
      { input: '4294967296.0', components: [] },
      { input: '-1.0', components: [] },
      { input: '1.-1.0', components: [] },
      { input: '1,--1.0', components: [] },
      { input: '+1.0', components: [] },
      { input: '1.+1.0', components: [] },
      { input: '1+1.0', components: [] },
      { input: '++1.0', components: [] },
      { input: '1.0a', components: [] },
      {
        input: '1.2.3.4.5.6.7.8.9.0',
        components: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      },
      { input: '02.1', components: [] },
      { input: '0.01', components: [0, 1] },
      { input: 'f.1', components: [] },
      { input: '15.007.20011', components: [15, 7, 20011] },
      { input: '15.5.28.130162', components: [15, 5, 28, 130162] },
    ];

    for (const testCase of testCases) {
      it(`should ${testCase.components.length > 0 ? 'parse' : 'fail'} "${testCase.input}"`, () => {
        if (testCase.components.length > 0) {
          const version = new Version(testCase.input);
          assert.doesNotThrow(
            () => new Version(testCase.input, { disallowWildcard: true }),
          );
          assert.deepStrictEqual(version.components, testCase.components);
          assert.strictEqual(version.isWildcard, false);
        } else {
          assert.throws(() => new Version(testCase.input));
        }
      });
    }

    describe('wildcard', () => {
      const testCases = [
        { version: '1.2.3.*', components: [1, 2, 3] },
        { version: '1.2.3.5*', components: [] },
        { version: '1.2.3.56*', components: [] },
        { version: '1.2.3.56.a.*', components: [] },
        { version: '1.2.3.56.*.a', components: [] },
        { version: '1.*.3', components: [] },
        { version: '20.*', components: [20] },
        { version: '+2.*', components: [] },
        { version: '*', components: [] },
        { version: '*.2', components: [] },
      ];

      for (const testCase of testCases) {
        it(`should ${testCase.components.length > 0 ? 'parse' : 'fail'} "${testCase.version}"`, () => {
          if (testCase.components.length > 0) {
            const version = new Version(testCase.version);
            assert.deepStrictEqual(version.components, testCase.components);
            assert.strictEqual(version.isWildcard, true);
            assert.throws(
              () => new Version(testCase.version, { disallowWildcard: true }),
            );
          } else {
            assert.throws(() => new Version(testCase.version));
            assert.throws(
              () => new Version(testCase.version, { disallowWildcard: true }),
            );
          }
        });
      }
    });

    describe('leading zeroes', () => {
      describe('allowed', () => {
        it('should not allow in the first component', () => {
          assert.throws(() => new Version('01.1'));
        });

        it('should allow in subsequent components and ignore them', () => {
          const v1 = new Version('1.01');
          assert.strictEqual(v1.toString(), '1.1');
          const v2 = new Version('1.1');
          assert.deepStrictEqual(v1, v2);
        });

        it('should compare versions correctly when leading zeros are ignored', () => {
          assert.strictEqual(new Version('1.02').gt(new Version('1.1')), true);
        });
      });

      describe('disallow', () => {
        it('should not allow leading zeroes everywhere', () => {
          const testCases = ['01.1', '1.01'];
          for (const testCase of testCases) {
            assert.throws(
              () => new Version(testCase, { disallowLeadingZeros: true }),
            );
          }
        });
      });
    });
  });

  describe('compare', () => {
    const testCases = [
      { lhs: '1.0', rhs: '1.0', expected: 0 },
      { lhs: '1.0', rhs: '0.0', expected: 1 },
      { lhs: '1.0', rhs: '2.0', expected: -1 },
      { lhs: '1.0', rhs: '1.1', expected: -1 },
      { lhs: '1.1', rhs: '1.0', expected: 1 },
      { lhs: '1.0', rhs: '1.0.1', expected: -1 },
      { lhs: '1.1', rhs: '1.0.1', expected: 1 },
      { lhs: '1.1', rhs: '1.0.1', expected: 1 },
      { lhs: '1.0.0', rhs: '1.0', expected: 0 },
      { lhs: '1.0.3', rhs: '1.0.20', expected: -1 },
      { lhs: '11.0.10', rhs: '15.007.20011', expected: -1 },
      { lhs: '11.0.10', rhs: '15.5.28.130162', expected: -1 },
      { lhs: '15.5.28.130162', rhs: '15.5.28.130162', expected: 0 },
    ];

    function expectCompare(lhs: Version, rhs: Version, expected: number) {
      assert.strictEqual(lhs.compare(rhs), expected);
      assert.strictEqual(rhs.compare(lhs), expected === 0 ? 0 : -expected);

      switch (expected) {
        case -1:
          assert.ok(lhs.lt(rhs));
          assert.ok(lhs.lte(rhs));
          assert.ok(!lhs.eq(rhs));
          assert.notStrictEqual(lhs.compare(rhs), 0);
          assert.ok(!lhs.gte(rhs));
          assert.ok(!lhs.gt(rhs));
          break;
        case 0:
          assert.ok(!lhs.lt(rhs));
          assert.ok(lhs.lte(rhs));
          assert.ok(lhs.eq(rhs));
          assert.strictEqual(lhs.compare(rhs), 0);
          assert.ok(lhs.gte(rhs));
          assert.ok(!lhs.gt(rhs));
          break;
        case 1:
          assert.ok(!lhs.lt(rhs));
          assert.ok(!lhs.lte(rhs));
          assert.ok(!lhs.eq(rhs));
          assert.notStrictEqual(lhs.compare(rhs), 0);
          assert.ok(lhs.gte(rhs));
          assert.ok(lhs.gt(rhs));
          break;
      }
    }

    for (const testCase of testCases) {
      it(`should compare ${testCase.lhs} and ${testCase.rhs}`, () => {
        const lhs = new Version(testCase.lhs);
        const rhs = new Version(testCase.rhs);
        expectCompare(lhs, rhs, testCase.expected);
      });
    }

    describe('wildcard', () => {
      const testCases = [
        { lhs: '1.0', rhs: '1.*', expected: 0 },
        { lhs: '1.0', rhs: '0.*', expected: 1 },
        { lhs: '1.0', rhs: '2.*', expected: -1 },
        { lhs: '1.2.3', rhs: '1.2.3.*', expected: 0 },
        { lhs: '10.0', rhs: '1.0.*', expected: 1 },
        { lhs: '1.0', rhs: '3.0.*', expected: -1 },
        { lhs: '1.4', rhs: '1.3.0.*', expected: 1 },
        { lhs: '1.3.9', rhs: '1.3.*', expected: 0 },
        { lhs: '1.4.1', rhs: '1.3.*', expected: 1 },
        { lhs: '1.3', rhs: '1.4.5.*', expected: -1 },
        { lhs: '1.5', rhs: '1.4.5.*', expected: 1 },
        { lhs: '1.3.9', rhs: '1.3.*', expected: 0 },
        { lhs: '1.2.0.0.0.0', rhs: '1.2.*', expected: 0 },
      ];

      for (const testCase of testCases) {
        it(`should compare ${testCase.lhs} and ${testCase.rhs}`, () => {
          const lhs = new Version(testCase.lhs);
          const rhs = new Version(testCase.rhs);
          expectCompare(lhs, rhs, testCase.expected);
        });
      }
    });
  });

  describe('toString', () => {
    const testCases = ['1', '1.0', '0.0.1.0', '1.2.3.4.5.6'];

    for (const testCase of testCases) {
      it(`should return "${testCase}" for "${testCase}"`, () => {
        const v = new Version(testCase);
        assert.strictEqual(v.toString(), testCase);
      });

      const wildcardTestCase = testCase + '.*';
      it(`should return "${wildcardTestCase}" for "${wildcardTestCase}"`, () => {
        const v = new Version(wildcardTestCase);
        assert.strictEqual(v.toString(), wildcardTestCase);
      });
    }
  });
});
