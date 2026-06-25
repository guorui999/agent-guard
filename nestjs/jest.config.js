module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/'],
  moduleNameMapper: {
    '^@agent-guard/nestjs$': '<rootDir>/src/index.ts',
    '^@agent-guard/nestjs/(.*)$': '<rootDir>/src/$1',
  },
};
