---
name: microservice-proxy-event
description: Implement the Microservice Proxy-Event pattern in the MediTech NestJS monorepo. Use when a consumer BC (e.g., opd-bc, emergency-bc) needs to call a resource owned by another BC (e.g., emr-bc) via TCP transport, instead of accessing the database directly. Triggers on requests like "add proxy for X from BC-A to BC-B", "let opd-bc call emr-bc X", "cross-BC CRUD for X", "proxy X resource", "add TCP event handler for X".
---

# Microservice Proxy-Event Pattern

Implements cross-BC communication via TCP transport using 3 coordinated components:
1. **EventsController** (owner BC) — `@MessagePattern` handlers that call the local service
2. **ProxyService** (consumer BC) — `MicroserviceClientService.sendWithContext()` wrappers
3. **ProxyController** (consumer BC) — REST endpoints that delegate to ProxyService

## Architecture

```
[Client]
   │  HTTP
   ▼
[Consumer BC - ProxyController]   ← REST API (e.g., GET /group-orders/:id/clinical-findings)
   │  calls ProxyService
   ▼
[Consumer BC - ProxyService]      ← sends TCP message via MicroserviceClientService
   │  TCP (AppMicroservice.OwnerBc.cmd.ResourceResources.ActionResource)
   ▼
[Owner BC - EventsController]     ← @MessagePattern handler
   │  calls local Service
   ▼
[Owner BC - Service + Database]
```

**Rule**: Consumer BC NEVER imports the owner BC's `Repository` or `TypeORM` entities directly. All cross-BC data access MUST go through TCP.

---

## DTO Placement Rule (CRITICAL)

Any DTO or entity type that is **imported by a consumer BC** MUST live in `@lib/common`, not inside the owner BC's app directory.

| Situation | Where to put the DTO |
|-----------|---------------------|
| DTO used only inside owner BC | `apps/owner-bc/src/modules/.../dto/` |
| DTO shared across BCs (ProxyService/ProxyController imports it) | `libs/common/src/dto/medical/create-xxx.dto.ts` |

**Correct** (shared DTO in `@lib/common`):
```typescript
// ✅ In ProxyService / ProxyController of consumer BC
import { CreateClinicalFindingDTO } from '@lib/common/dto/medical/create-clinical-finding.dto';
import { UpdateClinicalFindingDTO } from '@lib/common/dto/medical/update-clinical-finding.dto';
```

**Wrong** (cross-app import — violates BC boundary):
```typescript
// ❌ NEVER do this in a consumer BC
import { CreateXxxDTO } from '@apps/owner-bc/src/modules/.../dto/create-xxx.dto';
```

When implementing the proxy pattern, **move the DTO to `libs/common/src/dto/medical/`** if it doesn't already live there. The owner BC's own files can then import from `@lib/common` too.

---

## Step 0 — Move/Create shared DTOs in `@lib/common`

Before writing any proxy code, ensure Create/Update/Response DTOs are in `libs/common/src/dto/medical/`:

```
libs/common/src/dto/medical/
  create-xxx.dto.ts      ← CreateXxxDTO + XxxResponseDTO (in the same file)
  update-xxx.dto.ts      ← UpdateXxxDTO extends PartialType(CreateXxxDTO)
```

Both owner BC and consumer BC then import from `@lib/common/dto/medical/create-xxx.dto`.

### ResponseDTO — always co-locate in `create-xxx.dto.ts`

The ResponseDTO must live in the **same file** as `CreateXxxDTO`. It extends both the Create DTO and `BaseResponseDTO` using `IntersectionType`:

```typescript
// libs/common/src/dto/medical/create-xxx.dto.ts
import { IntersectionType } from '@nestjs/swagger';
import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

export class CreateXxxDTO {
    // ... fields
}

export class XxxResponseDTO extends IntersectionType(CreateXxxDTO, BaseResponseDTO) {}
```

Real example — `libs/common/src/dto/medical/create-emergency-accident-information.dto.ts`:
```typescript
export class EmergencyAccidentInformationResponseDTO extends IntersectionType(
    CreateEmergencyAccidentInformationDTO,
    BaseResponseDTO,
) {}
```

The ProxyController then imports `XxxResponseDTO` from the same `@lib/common` path:
```typescript
// ✅ In ProxyController — both CreateDTO and ResponseDTO from same file
import {
    CreateXxxDTO,
    XxxResponseDTO,
} from '@lib/common/dto/medical/create-xxx.dto';
```

Real example — `apps/emergency-bc/src/modules/emergency/controllers/emergency-accident-information.proxy-controller.ts`:
```typescript
import {
    CreateEmergencyAccidentInformationDTO,
    EmergencyAccidentInformationResponseDTO,
} from '@lib/common/dto/medical/create-emergency-accident-information.dto';
```

---

## Step 1 — Register CMD keys in `app-microservice.enum.ts`

File: `libs/common/src/enum/app-microservice.enum.ts`

Add a Resource const and nest it under the BC's `cmd`:

```typescript
// ── inside the owner BC section ───────────────────────────────
const XxxResources = {
    CreateXxx: 'ownerBC.xxx.create',
    GetXxxById: 'ownerBC.xxx.getById',
    GetXxxPaginated: 'ownerBC.xxx.getPaginated',
    UpdateXxx: 'ownerBC.xxx.update',
    DeleteXxx: 'ownerBC.xxx.delete',
};

export const OwnerBcMCS = {
    name: 'OWNER_BC_SERVICE',
    cmd: {
        // ...existing cmds...
        XxxResources: XxxResources,
    },
};
```

Naming convention: `<bcCamelCase>.<resourceCamelCase>.<action>` — all lowercase camelCase, dot-separated.

---

## Step 2 — EventsController (Owner BC)

File: `apps/owner-bc/src/modules/<domain>/controllers/<resource>-events.controller.ts`

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { type IMicroservicePayload, type IResponsePaginatedService, type IUserSession, throwAsRpcException } from '@lib/common';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { CreateXxxDTO } from '@lib/common/dto/medical/create-xxx.dto';
import { UpdateXxxDTO } from '@lib/common/dto/medical/update-xxx.dto';
import { Xxx } from '../entities/xxx.entity';
import { XxxService } from '../services/xxx.service';

@Controller()
export class XxxEventsController {
    constructor(
        private readonly logger: LogsService,
        private readonly xxxService: XxxService,
    ) {}

    @MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.CreateXxx })
    async handleCreateXxx(
        @Payload()
        data: IMicroservicePayload<{ data: CreateXxxDTO; current_user: IUserSession }>,
    ): Promise<Xxx | null> {
        this.logger.setContextFromPayload(data._context);
        this.logger.info({ message: `Create xxx`, context: { action: 'CREATE_XXX' } });
        try {
            return await this.xxxService.create(data.payload.data, data.payload.current_user);
        } catch (error: unknown) {
            throwAsRpcException(error);
        }
    }

    @MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.GetXxxById })
    async handleGetXxxById(
        @Payload() data: IMicroservicePayload<{ id: string }>,
    ): Promise<Xxx | null> {
        this.logger.setContextFromPayload(data._context);
        this.logger.info({ message: `Get xxx by id: ${data.payload.id}`, context: { action: 'GET_XXX_BY_ID' } });
        try {
            return await this.xxxService.findById(data.payload.id);
        } catch (error: unknown) {
            throwAsRpcException(error);
        }
    }

    @MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.GetXxxPaginated })
    async handleGetXxxPaginated(
        @Payload()
        data: IMicroservicePayload<{ group_order_id: string; query: QueryParamsDTO }>,
    ): Promise<IResponsePaginatedService<Xxx[]> | null> {
        this.logger.setContextFromPayload(data._context);
        this.logger.info({ message: `Get xxx paginated`, context: { action: 'GET_XXX_PAGINATED' } });

        const modifiedQuery: QueryParamsDTO = {
            ...data.payload.query,
            filter: ([] as string[])
                .concat(data.payload.query.filter ?? [])
                .concat(`group_order_id||$eq||${data.payload.group_order_id}`),
        };
        try {
            return await this.xxxService.findPaginated(modifiedQuery);
        } catch (error: unknown) {
            throwAsRpcException(error);
        }
    }

    @MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.UpdateXxx })
    async handleUpdateXxx(
        @Payload()
        data: IMicroservicePayload<{ id: string; data: UpdateXxxDTO; current_user: IUserSession }>,
    ): Promise<Xxx | null> {
        this.logger.setContextFromPayload(data._context);
        this.logger.info({ message: `Update xxx: ${data.payload.id}`, context: { action: 'UPDATE_XXX' } });
        try {
            return await this.xxxService.update(data.payload.id, data.payload.data, data.payload.current_user);
        } catch (error: unknown) {
            throwAsRpcException(error);
        }
    }

    @MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.DeleteXxx })
    async handleDeleteXxx(
        @Payload()
        data: IMicroservicePayload<{ id: string; current_user: IUserSession }>,
    ): Promise<void | null> {
        this.logger.setContextFromPayload(data._context);
        this.logger.info({ message: `Delete xxx: ${data.payload.id}`, context: { action: 'DELETE_XXX' } });
        try {
            return await this.xxxService.delete(data.payload.id, true, data.payload.current_user);
        } catch (error: unknown) {
            throwAsRpcException(error);
        }
    }
}
```

### Key rules for EventsController
- `@Controller()` with **no path** — this is a microservice controller, not HTTP
- `@MessagePattern({ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.ActionXxx })`
- `@Payload()` type is always `IMicroservicePayload<{ ... }>` — never raw type
- Always call `this.logger.setContextFromPayload(data._context)` first
- **Every handler MUST wrap service calls in `try/catch (error: unknown) { throwAsRpcException(error) }`** — this ensures the consumer BC receives a structured `IRpcErrorPayload` instead of an unhandled TCP error
- For paginated: inject filter `group_order_id||$eq||<id>` into `query.filter` array
- Register in the owner BC's module `controllers` array

---

## Step 3 — ProxyService (Consumer BC)

File: `apps/consumer-bc/src/integrations/<owner-bc>/<resource>.proxy-service.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { IResponsePaginatedService, IUserSession, MicroserviceClientService } from '@lib/common';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { CreateXxxDTO } from '@lib/common/dto/medical/create-xxx.dto';
import { UpdateXxxDTO } from '@lib/common/dto/medical/update-xxx.dto';
import { Xxx } from '@apps/owner-bc/src/modules/.../entities/xxx.entity'; // entity stays in owner BC

/**
 * XxxProxyService
 *
 * Proxy between <ConsumerBC> and <OwnerBC> for Xxx management.
 * Data Flow: ConsumerBC Controller → ProxyService → OwnerBC (TCP) → OwnerBC Service → DB
 */
@Injectable()
export class XxxProxyService {
    constructor(
        private readonly logger: LogsService,
        private readonly microserviceClient: MicroserviceClientService,
        @Inject(AppMicroservice.OwnerBc.name)
        private readonly ownerBcClient: ClientProxy,
    ) {}

    async createXxx(
        groupOrderId: string,
        createDTO: CreateXxxDTO,
        currentUser: IUserSession,
    ): Promise<Xxx | null> {
        return await this.microserviceClient.sendWithContext<
            Xxx,
            { data: CreateXxxDTO; current_user: IUserSession }
        >(
            this.logger,
            this.ownerBcClient,
            { cmd: AppMicroservice.OwnerBc.cmd.XxxResources.CreateXxx },
            { data: { ...createDTO, group_order_id: groupOrderId }, current_user: currentUser },
            null,
        );
    }

    async getXxxById(id: string): Promise<Xxx | null> {
        return await this.microserviceClient.sendWithContext<Xxx, { id: string }>(
            this.logger,
            this.ownerBcClient,
            { cmd: AppMicroservice.OwnerBc.cmd.XxxResources.GetXxxById },
            { id },
            null,
        );
    }

    async getXxxPaginated(
        groupOrderId: string,
        query: QueryParamsDTO,
    ): Promise<IResponsePaginatedService<Xxx[]> | null> {
        return await this.microserviceClient.sendWithContext<
            IResponsePaginatedService<Xxx[]>,
            { group_order_id: string; query: QueryParamsDTO }
        >(
            this.logger,
            this.ownerBcClient,
            { cmd: AppMicroservice.OwnerBc.cmd.XxxResources.GetXxxPaginated },
            { group_order_id: groupOrderId, query },
            null,
        );
    }

    async updateXxx(
        id: string,
        updateDTO: UpdateXxxDTO,
        currentUser: IUserSession,
    ): Promise<Xxx | null> {
        return await this.microserviceClient.sendWithContext<
            Xxx,
            { id: string; data: UpdateXxxDTO; current_user: IUserSession }
        >(
            this.logger,
            this.ownerBcClient,
            { cmd: AppMicroservice.OwnerBc.cmd.XxxResources.UpdateXxx },
            { id, data: updateDTO, current_user: currentUser },
            null,
        );
    }

    async deleteXxx(id: string, currentUser: IUserSession): Promise<void | null> {
        return await this.microserviceClient.sendWithContext<
            void,
            { id: string; current_user: IUserSession }
        >(
            this.logger,
            this.ownerBcClient,
            { cmd: AppMicroservice.OwnerBc.cmd.XxxResources.DeleteXxx },
            { id, current_user: currentUser },
            null,
        );
    }
}
```

### Key rules for ProxyService
- `sendWithContext<ReturnType, PayloadType>(logger, client, { cmd }, payload, fallback)`
- fallback is `null` for single entity, `null` for paginated (never throw from proxy)
- For create: merge `group_order_id` into DTO before sending
- Never import TypeORM `Repository` — this BC does NOT own the data
- Place file in `apps/<consumer-bc>/src/integrations/<owner-bc>/`

---

## Step 4 — ProxyController (Consumer BC)

File: `apps/consumer-bc/src/controllers/<resource>.proxy-controller.ts`

```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser, IResponsePaginatedService, RequirePermission, ValidatedQuery, type IUserSession } from '@lib/common';
import {
    ApiJsonApiCollectionResponse,
    ApiJsonApiCreatedResponse,
    ApiJsonApiResponse,
} from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { CreateXxxDTO, XxxResponseDTO } from '@lib/common/dto/medical/create-xxx.dto';
import { UpdateXxxDTO } from '@lib/common/dto/medical/update-xxx.dto';
import { Xxx } from '@apps/owner-bc/src/modules/.../entities/xxx.entity'; // entity stays in owner BC
import { XxxProxyService } from '../integrations/owner-bc/xxx.proxy-service';

@ApiTags('Xxx')
@Controller('group-orders')
@ResourceType('proxy-xxxs')
export class XxxProxyController {
    constructor(private readonly xxxProxyService: XxxProxyService) {}

    @Post(':group_order_id/xxxs')
    @RequirePermission('xxx:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create xxx' })
    @ApiBody({ type: CreateXxxDTO })
    @ApiJsonApiCreatedResponse('proxy-xxxs', XxxResponseDTO)
    async createXxx(
        @Param('group_order_id') groupOrderId: string,
        @Body() createDTO: CreateXxxDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<Xxx | null> {
        return await this.xxxProxyService.createXxx(groupOrderId, createDTO, currentUser);
    }

    @Get(':group_order_id/xxxs')
    @RequirePermission('xxx:view')
    @ApiOperation({ summary: 'Get xxxs for group order' })
    @ApiParam({ name: 'group_order_id', type: 'string', format: 'uuid' })
    @ApiQuery({ type: QueryParamsDTO, required: false })
    @ApiJsonApiCollectionResponse('proxy-xxxs', 200, XxxResponseDTO)
    async getXxxsPaginated(
        @Param('group_order_id') groupOrderId: string,
        @ValidatedQuery({ dto: QueryParamsDTO }) query: QueryParamsDTO,
    ): Promise<IResponsePaginatedService<Xxx[]> | null> {
        return await this.xxxProxyService.getXxxPaginated(groupOrderId, query);
    }

    @Get(':group_order_id/xxxs/:xxx_id')
    @RequirePermission('xxx:view')
    @ApiOperation({ summary: 'Get xxx by ID' })
    @ApiParam({ name: 'group_order_id', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'xxx_id', type: 'string', format: 'uuid' })
    @ApiJsonApiResponse('proxy-xxxs', 200, XxxResponseDTO)
    async getXxxById(
        @Param('group_order_id') _groupOrderId: string,
        @Param('xxx_id') xxxId: string,
    ): Promise<Xxx | null> {
        return await this.xxxProxyService.getXxxById(xxxId);
    }

    @Put(':group_order_id/xxxs/:xxx_id')
    @RequirePermission('xxx:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update xxx' })
    @ApiParam({ name: 'group_order_id', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'xxx_id', type: 'string', format: 'uuid' })
    @ApiBody({ type: UpdateXxxDTO })
    @ApiJsonApiResponse('proxy-xxxs', 200, XxxResponseDTO)
    async updateXxx(
        @Param('group_order_id') _groupOrderId: string,
        @Param('xxx_id') xxxId: string,
        @Body() updateDTO: UpdateXxxDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<Xxx | null> {
        return await this.xxxProxyService.updateXxx(xxxId, updateDTO, currentUser);
    }

    @Delete(':group_order_id/xxxs/:xxx_id')
    @RequirePermission('xxx:delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete xxx (soft)' })
    @ApiParam({ name: 'group_order_id', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'xxx_id', type: 'string', format: 'uuid' })
    async deleteXxx(
        @Param('group_order_id') _groupOrderId: string,
        @Param('xxx_id') xxxId: string,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<void | null> {
        return await this.xxxProxyService.deleteXxx(xxxId, currentUser);
    }
}
```

### Key rules for ProxyController
- `@Controller('group-orders')` — nested under parent resource
- `@ResourceType('proxy-xxxs')` — always prefix with `proxy-` to avoid collision
- Always `@Put` for update — NEVER `@Patch`
- Unused `_groupOrderId` prefix with `_` to suppress lint error
- `@RequirePermission('xxx:action')` on every endpoint — NEVER omit

---

## Step 5 — Module Registration

### Owner BC module

```typescript
// In owner-bc <domain>.module.ts
import { XxxEventsController } from './controllers/xxx-events.controller';

@Module({
    controllers: [
        // ...existing
        XxxEventsController,  // ← add here
    ],
})
```

### Consumer BC module

```typescript
// In consumer-bc app.module.ts or relevant feature module
import { XxxProxyController } from './controllers/xxx.proxy-controller';
import { XxxProxyService } from './integrations/owner-bc/xxx.proxy-service';

@Module({
    controllers: [XxxProxyController],
    providers: [XxxProxyService],
})
```

---

## Checklist

- [ ] Create/Update DTOs moved to `libs/common/src/dto/medical/` before writing proxy code
- [ ] `XxxResponseDTO extends IntersectionType(CreateXxxDTO, BaseResponseDTO)` defined in the **same file** as `CreateXxxDTO`
- [ ] ProxyService and ProxyController import DTOs from `@lib/common/dto/medical/` — NOT from `@apps/owner-bc/...`
- [ ] ProxyController `@ApiJsonApi*Response` decorators use `XxxResponseDTO` (not the entity class)
- [ ] CMD keys added in `app-microservice.enum.ts` with correct naming `<bc>.<resource>.<action>`
- [ ] `EventsController` has `@Controller()` with NO path
- [ ] Every `@MessagePattern` uses `{ cmd: AppMicroservice.OwnerBc.cmd.XxxResources.ActionXxx }`
- [ ] `IMicroservicePayload<{ ... }>` wraps all `@Payload()` types
- [ ] `logger.setContextFromPayload(data._context)` is first line of every handler
- [ ] Every handler wraps service calls in `try/catch (error: unknown) { throwAsRpcException(error) }`
- [ ] `ProxyService` uses `MicroserviceClientService.sendWithContext()` — NOT `client.send()`
- [ ] `ProxyService` fallback argument is `null`
- [ ] `ProxyController` uses `@Put` (never `@Patch`) for update
- [ ] `ProxyController` `@ResourceType` has `proxy-` prefix
- [ ] `EventsController` registered in owner BC module `controllers`
- [ ] `ProxyService` + `ProxyController` registered in consumer BC module

---

## Real Example Reference

| File | Role |
|------|------|
| `apps/emr-bc/src/modules/medical/modules/controllers/clinical-finding-events-controller.ts` | EventsController (owner: emr-bc) |
| `apps/opd-bc/src/integrations/emr-bc/clinical-findings.proxy-service.ts` | ProxyService (consumer: opd-bc) |
| `apps/opd-bc/src/controllers/clinical-findings.proxy-controller.ts` | ProxyController (consumer: opd-bc) |
| `libs/common/src/enum/app-microservice.enum.ts` | CMD key registry |
