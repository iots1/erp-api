module.exports = {
    displayName: 'storage-bc',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: 'src/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/apps/storage-bc',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
        '^@lib/config(|/.*)$': '<rootDir>/../../libs/config/src/$1',
        '^@lib/database(|/.*)$': '<rootDir>/../../libs/database/src/$1',
    },
};
