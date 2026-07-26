const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
    return {
        ...options,
        externals: [
            nodeExternals({
                allowlist: [/^@lib/],
            }),
            // thread-stream is a transitive dep of pino (used internally by
            // pino.transport() in libs/common/src/utils/logger/pino-http.config.ts).
            // It has no top-level node_modules symlink under pnpm, so
            // webpack-node-externals' directory scan misses it and webpack bundles
            // it — which rewrites its __dirname to the bundle output dir, breaking
            // thread-stream's `join(__dirname, 'lib', 'worker.js')` worker path
            // (resolves to dist/apps/<app>/lib/worker.js, which doesn't exist).
            { 'thread-stream': 'commonjs thread-stream' },
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
