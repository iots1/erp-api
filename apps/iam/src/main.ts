import { join } from 'path';

import { bootstrapApplication } from '@lib/common/utils/bootstrap.util';

import { IamModule } from './iam.module';

// Both `nest start` and `node dist/apps/iam/main.js` are launched via an npm
// script from the repo root, so process.cwd() is a stable anchor regardless of
// dev (ts-node) vs build (webpack) mode — unlike __dirname, which differs
// between the two.
const REPO_ROOT = process.cwd();

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: IamModule,
    globalPrefixNameEnv: 'IAM_PREFIX_NAME',
    globalPrefixVersionEnv: 'IAM_PREFIX_VERSION',
    defaultGlobalPrefixName: 'iam',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'IAM_MODULE_HTTP_PORT',
    microservice: 'Iam',
    // iam-view admin UI (EJS pages + esbuild-bundled assets, see
    // apps/iam/build-assets.mjs and .claude/skills/init-view). `views.dir` is
    // the EJS template root; `publicDir` is the esbuild *output* directory
    // (apps/iam/dist/public), not the public/ source tree — run
    // `npm run build:assets:iam` (or `:watch`) before starting the server.
    views: { dir: join(REPO_ROOT, 'apps/iam/views') },
    publicDir: join(REPO_ROOT, 'apps/iam/dist/public'),
    swagger: {
      title: 'IAM API',
      description:
        'Identity & access management (users, roles, permissions, policies).',
      tag: 'iam',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
