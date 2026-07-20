// Jest stub for '@scalar/nestjs-api-reference', which ships ESM-only and
// breaks the CJS ts-jest transform when a test imports the '@lib/common'
// barrel (libs/common/src/index.ts re-exports utils/bootstrap.util.ts,
// which imports this package purely to mount the Scalar docs UI at app
// bootstrap — irrelevant to unit tests, which never call bootstrap()).
module.exports = {
  apiReference: () => (_req, _res, next) => {
    if (typeof next === 'function') next();
  },
};
