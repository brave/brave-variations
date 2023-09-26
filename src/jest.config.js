/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/finch_tracker/build/',
  ],
  testEnvironment: 'node',
};
