// Shared Jest bootstrap for every BC app (apps/*/jest.config.js -> setupFiles).
// Edit this one file to change env/setup behavior for all microservices' unit tests.
//
// Jest's own default (`NODE_ENV=test`) is outside the app's Joi-validated
// range ([local, dev, staging, prod]), so `@lib/config`'s ConfigModule throws
// on load as soon as any spec imports it (directly or via the `@lib/common`
// barrel). Force a valid value here, before any spec runs — this only sets
// the env inside the Jest worker process, so it never affects CI/CD build or
// deploy steps, which set their own NODE_ENV independently.
const VALID_NODE_ENVS = ['local', 'dev', 'staging', 'prod'];

if (!VALID_NODE_ENVS.includes(process.env.NODE_ENV)) {
    process.env.NODE_ENV = 'local';
}
