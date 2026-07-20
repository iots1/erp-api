module.exports = {
    displayName: 'storage',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/apps/storage',
    setupFiles: ['<rootDir>/../../libs/common/test/jest-setup-env.js'],
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
        '^@lib/config(|/.*)$': '<rootDir>/../../libs/config/src/$1',
    },
};
