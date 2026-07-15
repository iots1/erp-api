module.exports = {
    displayName: '@lib/database',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/libs/database',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/../common/src/$1',
        '^@lib/database(|/.*)$': '<rootDir>/src/$1',
    },
};
