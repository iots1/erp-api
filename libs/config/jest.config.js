module.exports = {
    displayName: '@lib/config',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/libs/config',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/config(|/.*)$': '<rootDir>/src/$1',
    },
};
