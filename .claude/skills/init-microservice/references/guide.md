# Init Microservice — Full Implementation Guide

This guide contains **complete file templates** for every file that needs to be created or overwritten when initializing a new microservice. Replace all `{{PLACEHOLDERS}}` with actual values.

## Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{service-name}}` | kebab-case name | `notification` |
| `{{ServiceName}}` | PascalCase name | `Notification` |
| `{{SERVICE_NAME}}` | SCREAMING_SNAKE env prefix | `NOTIFICATION` |
| `{{HTTP_PORT}}` | HTTP port number | `3011` |
| `{{MICROSERVICE_PORT}}` | TCP microservice port | `5011` |
| `{{MICROSERVICE_HOST}}` | Host address | `10.0.0.70` |

---

## File 1: `apps/{{service-name}}/src/main.ts`

**Action**: Overwrite completely

```typescript
import { DocAuthKey } from '@lib/common/enum/auth/doc-auth-key.enum';
import { bootstrapApplication } from '@lib/common/utils/bootstrap.util';

import { {{ServiceName}}Module } from './{{service-name}}.module';

async function bootstrap(): Promise<void> {
    await bootstrapApplication({
        module: {{ServiceName}}Module,
        globalPrefixNameEnv: '{{SERVICE_NAME}}_PREFIX_NAME',
        globalPrefixVersionEnv: '{{SERVICE_NAME}}_PREFIX_VERSION',
        defaultGlobalPrefixName: '{{service-name}}',
        defaultGlobalPrefixVersion: 'v1',
        httpPortEnv: '{{SERVICE_NAME}}_MODULE_HTTP_PORT',
        microservicePortEnv: '{{SERVICE_NAME}}_MODULE_MICROSERVICE_PORT',
        swagger: {
            title: '{{ServiceName}} API',
            description:
                'The API documentation for the {{ServiceName}} Service.',
            tag: '{{service-name}}',
        },
        jwtAuth: {
            name: DocAuthKey.JWT_NAME,
            description: 'Enter your bearer token to authenticate',
        },
    });
}

void bootstrap();
```

**Key Points**:
- `bootstrapApplication()` handles everything: HTTP server, TCP microservice, Swagger, guards, pipes, filters
- `microservicePortEnv` is optional — omit it if the service does NOT need TCP transport
- `defaultGlobalPrefixName` becomes the URL prefix: `/<prefix>/v1/...`

---

## File 2: `apps/{{service-name}}/src/{{service-name}}.module.ts`

**Action**: Overwrite completely

### Variant A — Without Database

```typescript
import { Module } from '@nestjs/common';

import { CommonModule } from '@lib/common';

import { {{ServiceName}}Controller } from './{{service-name}}.controller';
import { {{ServiceName}}Service } from './{{service-name}}.service';

@Module({
    imports: [CommonModule],
    controllers: [{{ServiceName}}Controller],
    providers: [{{ServiceName}}Service],
})
export class {{ServiceName}}Module {}
```

### Variant B — With Database

```typescript
import { Module } from '@nestjs/common';

import { CommonModule } from '@lib/common';
import { MeditechDatabases } from '@lib/common/enum/meditech-databases.enum';
import { DatabaseModule } from '@lib/database';

import { {{ServiceName}}Controller } from './{{service-name}}.controller';
import { {{ServiceName}}Service } from './{{service-name}}.service';

@Module({
    imports: [
        CommonModule,
        DatabaseModule.registerAsync(MeditechDatabases.MEDITECH_CORE),
        // DatabaseModule.registerAsync(MeditechDatabases.MEDITECH_MASTER),
        // DatabaseModule.registerAsync(MeditechDatabases.MEDITECH_IAM),
    ],
    controllers: [{{ServiceName}}Controller],
    providers: [{{ServiceName}}Service],
})
export class {{ServiceName}}Module {}
```

**Key Points**:
- `CommonModule` is **mandatory** — it provides ConfigService, AuthGuard, PermissionsGuard, JWT, Redis, BullMQ
- `CommonModule` is `@Global()` so its exports are available in all sub-modules without re-importing
- Add `DatabaseModule.registerAsync()` for each database the service needs

---

## File 3: `apps/{{service-name}}/jest.config.js`

**Action**: Overwrite completely

```javascript
module.exports = {
    displayName: '{{service-name}}:unit',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
    coverageDirectory: '../../coverage/{{service-name}}/unit',
    collectCoverageFrom: [
        'src/**/*.(t|j)s',
        '!src/main.ts',
        '!src/**/*.module.ts',
        '!src/**/*.dto.ts',
        '!src/**/*.entity.ts',
        '!src/**/*.enum.ts',
        '!src/**/*.interface.ts',
    ],
    transform: {
        ['^.+\\.(t|j)s$']: 'ts-jest',
    },
    transformIgnorePatterns: ['/node_modules/(?!uuid)'],
    moduleNameMapper: {
        ['^@lib/common(|/.*)$']: '<rootDir>/../../libs/common/src/$1',
        ['^@lib/config(|/.*)$']: '<rootDir>/../../libs/config/src/$1',
        ['^@lib/database(|/.*)$']: '<rootDir>/../../libs/database/src/$1',
        ['^@apps/{{service-name}}/(.*)$']: '<rootDir>/$1',
        ['^@apps/(.*)$']: '<rootDir>/../$1',
        ['^apps/(.*)$']: '<rootDir>/../../apps/$1',
    },
};
```

**Key Points**:
- `testMatch` points to `test/unit/` — unit tests go here, NOT in `src/`
- `moduleNameMapper` must map ALL `@lib/*` and `@apps/*` paths
- `transformIgnorePatterns` must include `uuid` exception
- Coverage excludes: main.ts, modules, DTOs, entities, enums, interfaces

---

## File 4: `apps/{{service-name}}/project.json`

**Action**: Overwrite completely

```json
{
    "name": "{{service-name}}",
    "$schema": "../../node_modules/nx/schemas/project-schema.json",
    "projectType": "application",
    "sourceRoot": "apps/{{service-name}}/src",
    "targets": {
        "build": {
            "executor": "nx:run-commands",
            "options": {
                "command": "nest build {{service-name}}"
            },
            "outputs": ["{workspaceRoot}/dist/apps/{{service-name}}"]
        },
        "serve": {
            "executor": "nx:run-commands",
            "options": {
                "command": "pnpm nx build {{service-name}} && node -r tsconfig-paths/register dist/apps/{{service-name}}/main.js | pnpm exec pino-pretty -c -t -l"
            }
        },
        "test": {
            "executor": "@nx/jest:jest",
            "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
            "options": {
                "jestConfig": "apps/{{service-name}}/jest.config.js",
                "passWithNoTests": true
            }
        },
        "test:e2e": {
            "executor": "@nx/jest:jest",
            "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
            "options": {
                "jestConfig": "apps/{{service-name}}/test/jest-e2e.json",
                "passWithNoTests": true
            }
        }
    }
}
```

---

## File 5: `apps/{{service-name}}/test/jest-e2e.json`

**Action**: Overwrite completely

```json
{
    "displayName": "{{service-name}}:e2e",
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "testEnvironment": "node",
    "testMatch": ["<rootDir>/**/*.e2e-spec.ts"],
    "transform": {
        "^.+\\.(t|j)s$": "ts-jest"
    },
    "transformIgnorePatterns": ["/node_modules/(?!uuid)"],
    "moduleNameMapper": {
        "^@lib/common(|/.*)$": "<rootDir>/../../../libs/common/src/$1",
        "^@lib/config(|/.*)$": "<rootDir>/../../../libs/config/src/$1",
        "^@lib/database(|/.*)$": "<rootDir>/../../../libs/database/src/$1",
        "^@apps/{{service-name}}/(.*)$": "<rootDir>/../$1",
        "^@apps/(.*)$": "<rootDir>/../../$1",
        "^apps/{{service-name}}/(.*)$": "<rootDir>/../$1",
        "^apps/(.*)$": "<rootDir>/../../$1"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage/e2e",
    "coveragePathIgnorePatterns": [
        "/node_modules/",
        "main.ts$",
        ".module.ts$",
        ".dto.ts$",
        ".enum.ts$",
        ".interface.ts$"
    ]
}
```

**Key Points**:
- Path depth is **3 levels** (`<rootDir>/../../../libs/...`) because rootDir is `apps/<name>/test/`
- Must include BOTH `^@apps/<name>/` and `^apps/<name>/` mappers

---

## File 6: `apps/{{service-name}}/test/app.e2e-spec.ts`

**Action**: Overwrite completely

```typescript
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';

import { {{ServiceName}}Module } from '../src/{{service-name}}.module';

describe('{{ServiceName}}Controller (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [{{ServiceName}}Module],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/ (GET)', () => {
        return request(app.getHttpServer())
            .get('/')
            .expect(200)
            .expect('Hello World!');
    });
});
```

**Critical**: Use `import request from 'supertest'` (default import), NOT `import * as request from 'supertest'`.

---

## File 7: `nest-cli.json` — Add Project Entry

**Action**: Add entry to `projects` object

### With Swagger + Webpack (REST API service — most common)

```json
"{{service-name}}": {
    "type": "application",
    "root": "apps/{{service-name}}",
    "entryFile": "main",
    "sourceRoot": "apps/{{service-name}}/src",
    "compilerOptions": {
        "tsConfigPath": "apps/{{service-name}}/tsconfig.app.json",
        "plugins": ["@nestjs/swagger"],
        "webpackConfigPath": "webpack.config.js"
    }
}
```

### Without Swagger (internal-only service, no REST endpoints)

```json
"{{service-name}}": {
    "type": "application",
    "root": "apps/{{service-name}}",
    "entryFile": "main",
    "sourceRoot": "apps/{{service-name}}/src",
    "compilerOptions": {
        "tsConfigPath": "apps/{{service-name}}/tsconfig.app.json"
    }
}
```

**Key Points**:
- `plugins: ["@nestjs/swagger"]` enables automatic DTO metadata generation at compile time
- `webpackConfigPath` uses the root `webpack.config.js` which externalizes node_modules but keeps `@lib/*`

---

## File 8: `libs/config/src/config.module.ts` — Add Joi Validation

**Action**: Add block inside `Joi.object({...})`

```typescript
// {{ServiceName}} Service
{{SERVICE_NAME}}_PREFIX_NAME: Joi.string().required(),
{{SERVICE_NAME}}_PREFIX_VERSION: Joi.string().required(),
{{SERVICE_NAME}}_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
{{SERVICE_NAME}}_MODULE_MICROSERVICE_PORT: Joi.number().required(),
{{SERVICE_NAME}}_MODULE_HTTP_PORT: Joi.number().required(),
```

---

## File 9: `.env` and `.env.example` — Add Environment Variables

**Action**: Append to both files

```env
# {{ServiceName}} Service
{{SERVICE_NAME}}_PREFIX_NAME={{service-name}}
{{SERVICE_NAME}}_PREFIX_VERSION=v1
{{SERVICE_NAME}}_MODULE_MICROSERVICE_HOST={{MICROSERVICE_HOST}}
{{SERVICE_NAME}}_MODULE_MICROSERVICE_PORT={{MICROSERVICE_PORT}}
{{SERVICE_NAME}}_MODULE_HTTP_PORT={{HTTP_PORT}}
```

---

## File 10: `package.json` (root) — Add npm Scripts

**Action**: Add these scripts

```json
"start:dev:{{service-name}}": "nest start {{service-name}} --watch | pino-pretty -c -t -l",
"build:{{service-name}}": "nest build {{service-name}}",
"test:{{service-name}}": "cross-env NODE_ENV=dev jest --config ./apps/{{service-name}}/jest.config.js --watch",
"test:{{service-name}}:e2e": "cross-env NODE_ENV=dev jest --config ./apps/{{service-name}}/test/jest-e2e.json --watch",
"start:debug:{{service-name}}": "nest start {{service-name}} --debug --watch",
```

**Also update**:
- `build:all` — add `{{service-name}}` to the for loop
- `start:dev:all` — add `\"npm:start:dev:{{service-name}}\"` to concurrently args + name + color
- `dev:with-docs` — add `\"npm:start:dev:{{service-name}}\"` to concurrently args + name + color

---

## File 11: `package.json` (root) — Add moduleNameMapper

**Action**: Add to root `jest.moduleNameMapper`

```json
"^@apps/{{service-name}}/(.*)$": "<rootDir>/apps/{{service-name}}/$1"
```

---

## File 12: `ecosystem.config.js` — Add PM2 Process Entry

**Action**: Add entry to the `apps` array for production deployment

```javascript
{
    name: '{{service-name}}',
    script: 'dist/apps/{{service-name}}/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    node_args: '--experimental-specifier-resolution=node',
    env_file: '.env',
},
```

**Key Points**:
- `script` points to the compiled output in `dist/apps/{{service-name}}/main.js`
- `instances: 1` — increase for horizontal scaling with PM2 cluster mode
- `env_file: '.env'` — loads environment variables from `.env` in production
- Add the entry **before** the closing `],` of the `apps` array

---

## Optional: Register as Microservice Client

**Only if other services need to call this service via TCP `@MessagePattern`.**

### A. `libs/common/src/enum/app-microservice.enum.ts`

```typescript
export const {{ServiceName}}MCS = {
    name: '{{SERVICE_NAME}}_SERVICE',
    cmd: {},
};
```

Add to `AppMicroservice` object:
```typescript
export const AppMicroservice = {
    // ... existing entries
    {{ServiceName}}: {{ServiceName}}MCS,
};
```

### B. `libs/common/src/common.module.ts`

Add to `ClientsModule.registerAsync([...])`:

```typescript
{
    name: AppMicroservice.{{ServiceName}}.name,
    imports: [ConfigModule],
    useFactory: (configService: ConfigService) => ({
        transport: Transport.TCP,
        options: {
            host: configService.get<string>(
                '{{SERVICE_NAME}}_MODULE_MICROSERVICE_HOST',
                'localhost',
            ),
            port: configService.get<number>('{{SERVICE_NAME}}_MODULE_MICROSERVICE_PORT', {{MICROSERVICE_PORT}}),
        },
    }),
    inject: [ConfigService],
},
```
