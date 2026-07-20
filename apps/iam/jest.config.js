module.exports = {
    displayName: 'iam',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: '(src|test/unit)/.*\\.spec\\.ts$',
    coverageDirectory: '../../coverage/apps/iam',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@scalar/nestjs-api-reference$':
            '<rootDir>/test/mocks/stubs/scalar-nestjs-api-reference.stub.js',
        '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
        '^@lib/config(|/.*)$': '<rootDir>/../../libs/config/src/$1',
        '^@lib/database(|/.*)$': '<rootDir>/../../libs/database/src/$1',
        '^@apps/(.*)$': '<rootDir>/../$1',
    },
};
