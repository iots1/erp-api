module.exports = {
    displayName: '@lib/common',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/libs/common',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/src/$1',
    },
};
