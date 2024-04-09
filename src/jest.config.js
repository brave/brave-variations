/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testPathIgnorePatterns: [
    '/finch_tracker/build/',
  ],
  testEnvironment: 'node',
};
