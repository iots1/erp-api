const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
    return {
        ...options,
        externals: [
            nodeExternals({
                allowlist: [/^@lib/],
            }),
        ],
        resolve: {
            ...options.resolve,
            alias: {
                ...options.resolve?.alias,
                '@lib/common': path.resolve(__dirname, 'libs/common/src'),
                '@lib/config': path.resolve(__dirname, 'libs/config/src'),
                '@lib/database': path.resolve(__dirname, 'libs/database/src'),
                '@lib/contracts': path.resolve(__dirname, 'libs/contracts/src'),
            },
        },
    };
};
