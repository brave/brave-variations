/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  testEnvironment: 'node',
  collectCoverage: true,
};
