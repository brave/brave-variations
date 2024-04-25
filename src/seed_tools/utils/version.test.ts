// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Version } from './version';

describe('Version', () => {
  describe('parse', () => {
    const testCases = [
      { input: '', parts: 0, firstpart: 0, success: false },
      { input: ' ', parts: 0, firstpart: 0, success: false },
      { input: '\t', parts: 0, firstpart: 0, success: false },
      { input: '\n', parts: 0, firstpart: 0, success: false },
      { input: '  ', parts: 0, firstpart: 0, success: false },
      { input: '.', parts: 0, firstpart: 0, success: false },
      { input: ' . ', parts: 0, firstpart: 0, success: false },
      { input: '0', parts: 1, firstpart: 0, success: true },
      { input: '0.', parts: 0, firstpart: 0, success: false },
      { input: '0.0', parts: 2, firstpart: 0, success: true },
      {
        input: '4294967295.0',
        parts: 2,
        firstpart: 4294967295,
        success: true,
      },
      { input: '4294967296.0', parts: 0, firstpart: 0, success: false },
      { input: '-1.0', parts: 0, firstpart: 0, success: false },
      { input: '1.-1.0', parts: 0, firstpart: 0, success: false },
      { input: '1,--1.0', parts: 0, firstpart: 0, success: false },
      { input: '+1.0', parts: 0, firstpart: 0, success: false },
      { input: '1.+1.0', parts: 0, firstpart: 0, success: false },
      { input: '1+1.0', parts: 0, firstpart: 0, success: false },
      { input: '++1.0', parts: 0, firstpart: 0, success: false },
      { input: '1.0a', parts: 0, firstpart: 0, success: false },
      {
        input: '1.2.3.4.5.6.7.8.9.0',
        parts: 10,
        firstpart: 1,
        success: true,
      },
      { input: '02.1', parts: 0, firstpart: 0, success: false },
      { input: '0.01', parts: 2, firstpart: 0, success: true },
      { input: 'f.1', parts: 0, firstpart: 0, success: false },
      { input: '15.007.20011', parts: 3, firstpart: 15, success: true },
      { input: '15.5.28.130162', parts: 4, firstpart: 15, success: true },
    ];

    testCases.forEach((testCase) => {
      it(`should ${testCase.success ? 'parse' : 'fail'} "${testCase.input}"`, () => {
        if (!testCase.success) {
          expect(() => new Version(testCase.input)).toThrowError();
        } else {
          const version = new Version(testCase.input);
          expect(
            () => new Version(testCase.input, { disallowWildcard: true }),
          ).not.toThrow();
          expect(version.components.length).toBe(testCase.parts);
          expect(version.components[0]).toBe(testCase.firstpart);
          expect(version.isWildcard).toBe(false);
        }
      });
    });

    describe('wildcard', () => {
      const testCases = [
        { version: '1.2.3.*', expected: true, isWildcard: true },
        { version: '1.2.3.5*', expected: false, isWildcard: false },
        { version: '1.2.3.56*', expected: false, isWildcard: false },
        { version: '1.*.3', expected: false, isWildcard: false },
        { version: '20.*', expected: true, isWildcard: true },
        { version: '+2.*', expected: false, isWildcard: false },
        { version: '*', expected: false, isWildcard: false },
        { version: '*.2', expected: false, isWildcard: true },
      ];

      testCases.forEach((testCase) => {
        it(`should ${testCase.expected ? 'parse' : 'fail'} "${testCase.version}"`, () => {
          if (testCase.expected) {
            const version = new Version(testCase.version);
            expect(version.isWildcard).toBe(testCase.isWildcard);
            expect(
              () => new Version(testCase.version, { disallowWildcard: true }),
            ).toThrowError();
          } else {
            expect(() => new Version(testCase.version)).toThrowError();
          }
        });
      });
    });

    describe('leading zeroes', () => {
      describe('allowed', () => {
        it('should not allow in the first component', () => {
          expect(() => new Version('01.1')).toThrowError();
        });

        it('should allow in subsequent components and ignore them', () => {
          const v1 = new Version('1.01');
          expect(v1.toString()).toEqual('1.1');
          const v2 = new Version('1.1');
          expect(v1).toEqual(v2);
        });

        it('should compare versions correctly when leading zeros are ignored', () => {
          expect(new Version('1.02').gt(new Version('1.1'))).toBe(true);
        });
      });

      describe('disallow', () => {
        it('should not allow leading zeroes everywhere', () => {
          const testCases = ['01.1', '1.01'];
          testCases.forEach((testCase) => {
            expect(
              () => new Version(testCase, { disallowLeadingZeros: true }),
            ).toThrowError();
          });
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
      expect(lhs.compare(rhs)).toBe(expected);
      expect(rhs.compare(lhs)).toBe(-expected + 0);

      switch (expected) {
        case -1:
          expect(lhs.lt(rhs));
          expect(lhs.lte(rhs));
          expect(!lhs.eq(rhs));
          expect(lhs.compare(rhs)).not.toBe(0);
          expect(!lhs.gte(rhs));
          expect(!lhs.gt(rhs));
          break;
        case 0:
          expect(!lhs.lt(rhs));
          expect(!lhs.lte(rhs));
          expect(lhs.eq(rhs));
          expect(lhs.compare(rhs)).toBe(0);
          expect(!lhs.gte(rhs));
          expect(!lhs.gt(rhs));
          break;
        case 1:
          expect(!lhs.lt(rhs));
          expect(!lhs.lte(rhs));
          expect(!lhs.eq(rhs));
          expect(lhs.compare(rhs)).not.toBe(0);
          expect(lhs.gte(rhs));
          expect(lhs.gt(rhs));
          break;
      }
    }

    testCases.forEach((testCase) => {
      it(`should compare ${testCase.lhs} and ${testCase.rhs}`, () => {
        const lhs = new Version(testCase.lhs);
        const rhs = new Version(testCase.rhs);
        expectCompare(lhs, rhs, testCase.expected);
      });
    });

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

      testCases.forEach((testCase) => {
        it(`should compare ${testCase.lhs} and ${testCase.rhs}`, () => {
          const lhs = new Version(testCase.lhs);
          const rhs = new Version(testCase.rhs);
          expectCompare(lhs, rhs, testCase.expected);
        });
      });
    });
  });

  describe('toString', () => {
    const testCases = ['1', '1.0', '0.0.1.0', '1.2.3.4.5.6'];

    testCases.forEach((testCase) => {
      it(`should return "${testCase}" for "${testCase}"`, () => {
        const v = new Version(testCase);
        expect(v.toString()).toBe(testCase);
      });

      const wildcardTestCase = testCase + '.*';
      it(`should return "${wildcardTestCase}" for "${wildcardTestCase}"`, () => {
        const v = new Version(wildcardTestCase);
        expect(v.toString()).toBe(wildcardTestCase);
      });
    });
  });
});
