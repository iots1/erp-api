module.exports = {
    displayName: 'sales-bc',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/apps/sales-bc',
    setupFiles: ['<rootDir>/../../libs/common/test/jest-setup-env.js'],
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
        '^@lib/config(|/.*)$': '<rootDir>/../../libs/config/src/$1',
        '^@lib/database(|/.*)$': '<rootDir>/../../libs/database/src/$1',
    },
};
