# Entity Implementation Guide - MediTech Skill

## Overview

This guide provides a complete 5-step workflow for implementing a new entity in a MediTech microservice Bounded Context. Follow these steps to create database models, API contracts, business logic, HTTP endpoints, and module configuration.

## 5-Step Entity Implementation Workflow

### Step 1: Create Entity

**File**: `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/entities/[entity].entity.ts`

**Key Points**:

- Entity must **extend `BaseEntity`** from `@lib/common/abstracts/base-entity.abstract` — never implement `ITimestamp` directly
- Must specify `@Entity()` decorator with **three properties**:
    - `name`: table name in database (snake_case)
    - `database`: which database to use (from MeditechDatabases enum)
    - `comment`: description of what the table stores (optional but recommended)
- **❌ Do NOT use `@ApiProperty()`** in entities - Swagger docs are for DTOs only
- All columns must have comments
- Primary key must be `id: uuid`
- Nullable columns must use `| null` union type
- Use `snake_case` for column names
- **❌ Never use `type: 'date'`** — always use `type: 'timestamptz'` for all date/time columns. TypeScript property type must be `Date | null`

**Example**:

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { MeditechDatabases } from '@lib/common/enum/meditech-databases.enum';

import { LookupUser } from '@apps/emr-bc/src/modules/lookup/entities/lookup-user.entity';

@Entity({ name: 'patient_insurances', database: MeditechDatabases.MEDITECH_CORE })
@Index('idx_patient_insurances_patient_id', ['patient_id'])
export class PatientInsurance extends BaseEntity {
    @ManyToOne(() => Patient, (patient) => patient.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'patient_id' })
    patient: Patient;

    @Column({
        type: 'uuid',
        comment: 'Patient ID (FK → patients.id)',
    })
    patient_id: string;

    @Column({
        type: 'varchar',
        length: 50,
        nullable: true,
        comment: 'หมายเลขกรมธรรม์ / Policy number',
    })
    policy_number: string | null;

    // ✅ Always use timestamptz — never use type: 'date'
    @Column({
        type: 'timestamptz',
        nullable: true,
        comment: 'วันที่มีผล / Effective date',
    })
    effective_date: Date | null;

    @Column({
        type: 'timestamptz',
        nullable: true,
        comment: 'วันหมดอายุ / Expiry date',
    })
    expiry_date: Date | null;

    @Column({
        type: 'boolean',
        default: true,
        comment: 'สถานะใช้งาน / Is active',
    })
    is_active: boolean;

    // Always add LookupUser relations for audit trail (createForeignKeyConstraints: false)
    @ManyToOne(() => LookupUser, { createForeignKeyConstraints: false })
    @JoinColumn({ name: 'created_by' })
    lookup_created_by?: LookupUser;

    @ManyToOne(() => LookupUser, { createForeignKeyConstraints: false })
    @JoinColumn({ name: 'updated_by' })
    lookup_updated_by?: LookupUser;

    @ManyToOne(() => LookupUser, { createForeignKeyConstraints: false })
    @JoinColumn({ name: 'deleted_by' })
    lookup_deleted_by?: LookupUser;
}
```

---

### Financial Fields Convention

Fields that represent monetary values (price, cost, amount, fee, etc.) must follow these rules:

**Entity `@Column`** — use `numeric` type with `precision: 10, scale: 4` and `transformer: new NumericTransformer()`:

```typescript
import { NumericTransformer } from '@lib/common/transformers/numberic.transformer';

@Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    comment: 'ราคา / Price',
    transformer: new NumericTransformer(),
})
price: number;

@Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: 'ส่วนลด / Discount amount',
    transformer: new NumericTransformer(),
})
discount_amount: number | null;
```

**Create DTO** — use `@IsNumber()` with `@ApiProperty({ type: Number })`:

```typescript
import { IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@IsNumber()
@ApiProperty({ type: Number, description: 'ราคา / Price', example: 150.5 })
price: number;

@IsOptional()
@IsNumber()
@ApiPropertyOptional({ type: Number, description: 'ส่วนลด / Discount amount', example: 10.0 })
discount_amount: number | null;
```

**Response DTO** — add `@Transform(NumericTransformer.toDTO)` so PostgreSQL `numeric` string → `number` in JSON response:

```typescript
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NumericTransformer } from '@lib/common/transformers/numberic.transformer';

@Transform(NumericTransformer.toDTO)
@ApiProperty({ type: Number, description: 'ราคา / Price', example: 150.5 })
price: number;

@Transform(NumericTransformer.toDTO)
@ApiPropertyOptional({ type: Number, description: 'ส่วนลด / Discount amount', example: 10.0 })
discount_amount: number | null;
```

> **Why `@Transform` in Response DTO?** PostgreSQL returns `numeric` columns as strings. Without the transformer, JSON response would have `"price": "150.5000"` instead of `"price": 150.5`.

---

### Step 2: Create DTOs

**Files**:

- `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/dto/create-[entity].dto.ts`
- `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/dto/update-[entity].dto.ts`
- `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/dto/[entity]-response.dto.ts`

**Key Points**:

- Use `@IsNotEmpty()`, `@IsString()`, `@IsEmail()`, etc. from `class-validator`
- Use `@Type()` from `class-transformer` for type conversion
- Properties must use `snake_case`
- Use `@ApiProperty()` and `@ApiPropertyOptional()` for Swagger documentation
- Create DTOs are for POST requests (all required fields)
- Update DTOs inherit from Create DTO using `OmitType` and `PartialType`
- Response DTOs represent the API response structure
- **❌ NEVER use `?` optional marker** (e.g., `field?: string`) — this breaks unit test mock completeness
- **✅ nullable entity column** → DTO uses union type: `field: string | null` + `@IsOptional()`
- **✅ entity column with default** → DTO uses plain type: `field: string` + `@IsOptional()`
- **❌ Never use `@IsDateString()`** — always use `@IsISO8601()` from `@lib/common/decorators/custom-validate-dto/is-iso-8601.decorator.ts`. DTO property type is `string | null` (receives ISO 8601 string from client, entity stores as `Date`)

**Date field convention**:

| Layer | Type | Validator | Example value |
|-------|------|-----------|---------------|
| Entity `@Column` | `type: 'timestamptz'` / `Date \| null` | — | stored as UTC |
| Create/Update DTO | `string \| null` | `@IsISO8601()` | `"2024-12-18T14:30:00+07:00"` |
| Response DTO | inherited from Create DTO | — | ISO string in response |

**Example - Create DTO**:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsISO8601 } from '@lib/common/decorators/custom-validate-dto/is-iso-8601.decorator';

export class CreatePatientInsuranceDTO {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'ID ของผู้ป่วย / Patient UUID', example: 'uuid-here' })
    patient_id: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    @ApiPropertyOptional({ description: 'หมายเลขกรมธรรม์', example: 'POL-2025-123456' })
    policy_number: string | null;

    // ✅ Use @IsISO8601() for all date fields — never @IsDateString()
    @IsOptional()
    @IsISO8601()
    @ApiPropertyOptional({
        description: 'วันที่มีผล / Effective date',
        example: '2025-01-01T00:00:00+07:00',
    })
    effective_date: string | null;

    @IsOptional()
    @IsISO8601()
    @ApiPropertyOptional({
        description: 'วันหมดอายุ / Expiry date',
        example: '2026-01-01T00:00:00+07:00',
    })
    expiry_date: string | null;
}
```

**Example - Update DTO**:

```typescript
import { PartialType } from '@nestjs/swagger';

import { CreatePatientInsuranceDTO } from './create-patient-insurance.dto';

export class UpdatePatientInsuranceDTO extends PartialType(CreatePatientInsuranceDTO) {}
```

**Example - Response DTO**:

Uses `IntersectionType(CreateDTO, BaseResponseDTO)` to automatically include audit fields (`id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`) in Swagger without duplicating them.

```typescript
import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreatePatientInsuranceDTO } from './create-patient-insurance.dto';

export class PatientInsuranceResponseDTO extends IntersectionType(
    CreatePatientInsuranceDTO,
    BaseResponseDTO,
) {}
```

---

### Step 3: Create Service

**File**: `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/services/[entity]s.service.ts`

**Key Points**:

- Service must **extend `BaseServiceOperations`** — services do **not** extend `BaseEntity` (that is for entity classes only)
- Must provide entity, Create DTO, and Update DTO type parameters
- Must inject `Repository` and `LogsService`
- Use `this.executeDbOperation()` wrapper for database calls
- Override base methods only when custom business logic needed
- Constructor params used **only** in `super()` call must **not** be declared as `private readonly` (avoids unused-property TS warnings)

**Example**:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { IResponsePaginatedService } from '@lib/common';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { MeditechDatabases } from '@lib/common/enum/meditech-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreatePatientInsuranceDTO } from '../dto/create-patient-insurance.dto';
import { UpdatePatientInsuranceDTO } from '../dto/update-patient-insurance.dto';
import { PatientInsurance } from '../entities/patient-insurance.entity';

@Injectable()
export class PatientInsurancesService extends BaseServiceOperations<
    PatientInsurance,
    CreatePatientInsuranceDTO,
    UpdatePatientInsuranceDTO
> {
    protected readonly allowedRelations: string[] = [];

    constructor(
        protected readonly logger: LogsService,
        // No `private readonly` — configService & repository used only in super()
        configService: ConfigService,
        @InjectRepository(PatientInsurance, MeditechDatabases.MEDITECH_CORE)
        patientInsuranceRepository: Repository<PatientInsurance>,
    ) {
        super(patientInsuranceRepository, {
            logging: {
                logger: logger,
                serviceName: configService.get('EMR_PREFIX_NAME'),
                serviceVersion: configService.get('EMR_PREFIX_VERSION'),
            },
        });
    }

    // Custom method: filter by parent ID + paginate
    async findPaginatedByPatientId(
        patientId: string,
        query: QueryParamsDTO,
    ): Promise<IResponsePaginatedService<PatientInsurance[]>> {
        return super.findPaginated({
            ...query,
            filter: ([] as string[])
                .concat(query.filter ?? [])
                .concat(`patient_id||$eq||${patientId}`),
        });
    }
}
```

---

### Step 4: Create Controller

**File**: `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/controllers/[entity]s.controller.ts`

**Key Points**:

- Controller must **extend `BaseControllerOperations`**
- Must use `@ResourceType('[resource-name]')` decorator for JSON:API formatting
- Must use `@RequirePermission()` for authorization
- Use `@CurrentUser()` to inject authenticated user session
- Use `@ValidatedQuery()` for query parameter validation
- All public methods must be documented with `@ApiOperation()` and response decorators
- **Swagger description strings must NOT be inlined** — import them from `constants/[entity].swagger.ts` (`@ApiOperation` summary/description, `@ApiQuery`/`@ApiBody`/`@ApiParam` descriptions, response descriptions). Use `UPPER_SNAKE_CASE` consts or one grouped object per file. Cross-controller strings go in `constants/swagger-common.ts`. See "Swagger description file" below.
- ⚠️ File-name rule: `*.swagger.ts` holds API documentation strings; `*.constants.ts` holds real domain constants (enums, `*_ALLOWED_RELATIONS`, codes). Do not put descriptions in a `*.constants.ts`.
- Delegate business logic to service, not controller
- Constructor param used **only** in `super()` must **not** be declared as `private readonly`

#### Query Params Pattern — `allowedRelations`

**When `allowedRelations` is empty** (`protected readonly allowedRelations = []`):
Use plain `QueryParamsDTO` directly in the controller.

**When `allowedRelations` is non-empty**: create two extra files so Scalar renders `relations` as a multi-select enum dropdown (single source of truth):

```
constants/patient-insurance.constants.ts   ← array declared here
dto/patient-insurance-query-params.dto.ts  ← DTO subclass uses the array
```

`constants/patient-insurance.constants.ts`:
```typescript
export const PATIENT_INSURANCE_ALLOWED_RELATIONS = ['health_right', 'lookup_created_by'] as const;
```

`dto/patient-insurance-query-params.dto.ts`:
```typescript
import { queryParamsWithRelations } from '@lib/common/dto/query-params.dto';
import { PATIENT_INSURANCE_ALLOWED_RELATIONS } from '../constants/patient-insurance.constants';

export class PatientInsuranceQueryParamsDTO extends queryParamsWithRelations(
    PATIENT_INSURANCE_ALLOWED_RELATIONS,
) {}
```

Then in the service, reference the same constant:
```typescript
import { PATIENT_INSURANCE_ALLOWED_RELATIONS } from '../constants/patient-insurance.constants';

protected readonly allowedRelations = [...PATIENT_INSURANCE_ALLOWED_RELATIONS];
```

**Example - Flat controller (with allowedRelations)**:

```typescript
import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
    CurrentUser,
    IResponsePaginatedService,
    ParseUuidParamPipe,
    RequirePermission,
    type IUserSession,
} from '@lib/common';
import {
    ApiJsonApiCollectionResponse,
    ApiJsonApiCreatedResponse,
    ApiJsonApiResponse,
} from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { BaseControllerOperations } from '@lib/common/utils/base-operations/base-controller-operations.util';

import {
    CREATE_PATIENT_INSURANCE_SUMMARY,
    DELETE_PATIENT_INSURANCE_SUMMARY,
    GET_PATIENT_INSURANCE_SUMMARY,
    GET_PATIENT_INSURANCES_SUMMARY,
    PATIENT_INSURANCE_ID_PARAM_DESCRIPTION,
    UPDATE_PATIENT_INSURANCE_SUMMARY,
} from '../constants/patient-insurance.swagger';
import { CreatePatientInsuranceDTO } from '../dto/create-patient-insurance.dto';
import { PatientInsuranceQueryParamsDTO } from '../dto/patient-insurance-query-params.dto';
import { PatientInsuranceResponseDTO } from '../dto/patient-insurance-response.dto';
import { UpdatePatientInsuranceDTO } from '../dto/update-patient-insurance.dto';
import { PatientInsurance } from '../entities/patient-insurance.entity';
import { PatientInsurancesService } from '../services/patient-insurances.service';

@ResourceType('patient-insurances')
@ApiTags('Patient Insurances')
@Controller('patient-insurances')
export class PatientInsurancesController extends BaseControllerOperations<
    PatientInsurance,
    CreatePatientInsuranceDTO,
    UpdatePatientInsuranceDTO,
    PatientInsurancesService
> {
    // No `private readonly` — only passed to super()
    constructor(patientInsurancesService: PatientInsurancesService) {
        super(patientInsurancesService);
    }

    @Post()
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: CREATE_PATIENT_INSURANCE_SUMMARY })
    @ApiJsonApiCreatedResponse('patient-insurances', PatientInsuranceResponseDTO)
    create(
        @Body() createDTO: CreatePatientInsuranceDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<PatientInsurance> {
        return super.create(createDTO, currentUser);
    }

    @Get()
    @RequirePermission('patient:view', { th: 'ดูข้อมูลผู้ป่วย', en: 'View patient' })
    @ApiOperation({ summary: GET_PATIENT_INSURANCES_SUMMARY })
    @ApiQuery({ type: PatientInsuranceQueryParamsDTO })
    @ApiJsonApiCollectionResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    findPaginated(
        @ValidatedQuery(PatientInsuranceQueryParamsDTO) query: PatientInsuranceQueryParamsDTO,
    ): Promise<IResponsePaginatedService<PatientInsurance[]>> {
        return super.findPaginated(query);
    }

    @Get(':id')
    @RequirePermission('patient:view', { th: 'ดูข้อมูลผู้ป่วย', en: 'View patient' })
    @ApiOperation({ summary: GET_PATIENT_INSURANCE_SUMMARY })
    @ApiParam({ name: 'id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    @ApiQuery({ type: PatientInsuranceQueryParamsDTO })
    @ApiJsonApiResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    findOne(
        @Param('id', ParseUuidParamPipe) id: string,
        @ValidatedQuery(PatientInsuranceQueryParamsDTO) query: PatientInsuranceQueryParamsDTO,
    ): Promise<PatientInsurance> {
        return super.findOneOrQuery({
            ...query,
            filter: ([] as string[]).concat(query.filter ?? []).concat(`id||$eq||${id}`),
        });
    }

    @Put(':id')
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: UPDATE_PATIENT_INSURANCE_SUMMARY })
    @ApiParam({ name: 'id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    @ApiJsonApiResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    update(
        @Param('id', ParseUuidParamPipe) id: string,
        @Body() updateDTO: UpdatePatientInsuranceDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<PatientInsurance> {
        return super.update(id, updateDTO, currentUser);
    }

    @Delete(':id')
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: DELETE_PATIENT_INSURANCE_SUMMARY })
    @ApiParam({ name: 'id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    softDelete(
        @Param('id', ParseUuidParamPipe) id: string,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<void> {
        return super.softDelete(id, currentUser);
    }
}
```

> Note: `@RequirePermission(permission, { th, en })` names are synced into iam's `permissions` catalog by `npm run permissions:sync` — always supply the name so the catalog gets a real display name instead of a placeholder. See the **Permission Rules** section in `SKILL.md`.

#### Swagger description file

All Swagger/Scalar strings the controller uses live in `constants/[entity].swagger.ts` — never inlined in the controller. This keeps route handlers readable and the documentation in one place.

`constants/patient-insurance.swagger.ts`:
```typescript
/**
 * Swagger/Scalar documentation strings for `PatientInsurancesController`.
 */

export const CREATE_PATIENT_INSURANCE_SUMMARY = 'Create patient insurance record';
export const GET_PATIENT_INSURANCES_SUMMARY = 'Get patient insurances';
export const GET_PATIENT_INSURANCE_SUMMARY = 'Get patient insurance by ID';
export const UPDATE_PATIENT_INSURANCE_SUMMARY = 'Update patient insurance record';
export const DELETE_PATIENT_INSURANCE_SUMMARY = 'Delete patient insurance record';

export const PATIENT_INSURANCE_ID_PARAM_DESCRIPTION = 'Patient insurance ID';

// Nested controller (patients/:patient_id/insurances) — same file, same rule: no inline strings
export const CREATE_PATIENT_INSURANCE_NESTED_SUMMARY = 'Create insurance record for a patient';
export const GET_PATIENT_INSURANCES_NESTED_SUMMARY = 'Get insurance records for a patient';
export const GET_PATIENT_INSURANCE_NESTED_SUMMARY = 'Get a single insurance record for a patient';
export const UPDATE_PATIENT_INSURANCE_NESTED_SUMMARY = 'Update insurance record for a patient';
export const DELETE_PATIENT_INSURANCE_NESTED_SUMMARY = 'Delete insurance record for a patient (soft delete)';

export const PATIENT_ID_PARAM_DESCRIPTION = 'Patient ID';
```

Rules:
- **File name**: `*.swagger.ts` for API description strings; `*.constants.ts` for real domain constants (enums, `*_ALLOWED_RELATIONS`, codes). Do not mix — a `*.constants.ts` that holds only descriptions is misnamed.
- **Export style**: individual `UPPER_SNAKE_CASE` consts (shown above) **or** one grouped object per file (e.g. `export const PatientInsuranceApiDescriptions = { create: '…' }`). Pick one per file.
- **Shared strings**: text reused across controllers in the BC goes in `constants/swagger-common.ts` (e.g. `GROUP_ORDER_ID_PARAM_DESCRIPTION`, `PAGINATION_QUERY_DESCRIPTION`).
- **Long Markdown descriptions** (multi-paragraph `@ApiOperation` bodies) belong here too — use a template literal.

---

### Nested Resource Controller Pattern

When a resource belongs to a parent (e.g., `patients/:patient_id/insurances`), create a **separate file** for the nested controller: `[entity]s-nested.controller.ts`.

**Key Points**:

- Use `@Controller('parent-resource')` as the base (e.g., `@Controller('patients')`)
- Inject the **same service** as the flat controller — do NOT create a new service
- **`POST`**: accept a separate DTO that omits the parent FK (`OmitType`), then inject the FK from the URL param
- **`GET` (list)**: use `service.findPaginated()` with the parent ID appended to `filter` via `concat()`
- **`GET` (single)**: use `service.findById(id)` — the child `id` is the primary key, no need to re-filter by parent
- **`PUT`**: use `service.update(id, dto, currentUser)`
- **`DELETE`**: use `service.delete(id, true, currentUser)` (soft delete)
- Register the nested controller in the **same module** as the flat controller

**Nested DTO** — omit the parent FK field:

```typescript
// dto/create-patient-insurance-nested.dto.ts
import { OmitType } from '@nestjs/swagger';
import { CreatePatientInsuranceDTO } from './create-patient-insurance.dto';

export class CreatePatientInsuranceNestedDTO extends OmitType(CreatePatientInsuranceDTO, [
    'patient_id',
] as const) {}
```

**Example - Nested controller** (`patient-insurances-nested.controller.ts`):

```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
    CurrentUser,
    IResponsePaginatedService,
    ParseUuidParamPipe,
    RequirePermission,
    type IUserSession,
} from '@lib/common';
import {
    ApiJsonApiCollectionResponse,
    ApiJsonApiCreatedResponse,
    ApiJsonApiResponse,
} from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import {
    CREATE_PATIENT_INSURANCE_NESTED_SUMMARY,
    DELETE_PATIENT_INSURANCE_NESTED_SUMMARY,
    GET_PATIENT_INSURANCE_NESTED_SUMMARY,
    GET_PATIENT_INSURANCES_NESTED_SUMMARY,
    PATIENT_ID_PARAM_DESCRIPTION,
    PATIENT_INSURANCE_ID_PARAM_DESCRIPTION,
    UPDATE_PATIENT_INSURANCE_NESTED_SUMMARY,
} from '../constants/patient-insurance.swagger';
import { CreatePatientInsuranceNestedDTO } from '../dto/create-patient-insurance-nested.dto';
import { PatientInsuranceResponseDTO } from '../dto/patient-insurance-response.dto';
import { UpdatePatientInsuranceDTO } from '../dto/update-patient-insurance.dto';
import { PatientInsurance } from '../entities/patient-insurance.entity';
import { PatientInsurancesService } from '../services/patient-insurances.service';

@ResourceType('patient-insurances')
@ApiTags('Patient Insurances')
@Controller('patients')
export class PatientInsurancesNestedController {
    constructor(private readonly patientInsurancesService: PatientInsurancesService) {}

    @Post(':patient_id/insurances')
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: CREATE_PATIENT_INSURANCE_NESTED_SUMMARY })
    @ApiParam({ name: 'patient_id', description: PATIENT_ID_PARAM_DESCRIPTION })
    @ApiJsonApiCreatedResponse('patient-insurances', PatientInsuranceResponseDTO)
    create(
        @Param('patient_id', ParseUuidParamPipe) patientId: string,
        @Body() createDTO: CreatePatientInsuranceNestedDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<PatientInsurance> {
        // Inject parent FK from URL param — never trust body for this
        return this.patientInsurancesService.create({ ...createDTO, patient_id: patientId }, currentUser);
    }

    @Get(':patient_id/insurances')
    @RequirePermission('patient:view', { th: 'ดูข้อมูลผู้ป่วย', en: 'View patient' })
    @ApiOperation({ summary: GET_PATIENT_INSURANCES_NESTED_SUMMARY })
    @ApiParam({ name: 'patient_id', description: PATIENT_ID_PARAM_DESCRIPTION })
    @ApiQuery({ type: QueryParamsDTO })
    @ApiJsonApiCollectionResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    findPaginated(
        @Param('patient_id', ParseUuidParamPipe) patientId: string,
        @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
    ): Promise<IResponsePaginatedService<PatientInsurance[]>> {
        // Append patient_id filter — preserves any other filters from the client
        return this.patientInsurancesService.findPaginated({
            ...query,
            filter: ([] as string[])
                .concat(query.filter ?? [])
                .concat(`patient_id||$eq||${patientId}`),
        });
    }

    @Get(':patient_id/insurances/:insurance_id')
    @RequirePermission('patient:view', { th: 'ดูข้อมูลผู้ป่วย', en: 'View patient' })
    @ApiOperation({ summary: GET_PATIENT_INSURANCE_NESTED_SUMMARY })
    @ApiParam({ name: 'patient_id', description: PATIENT_ID_PARAM_DESCRIPTION })
    @ApiParam({ name: 'insurance_id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    @ApiJsonApiResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    findOne(@Param('insurance_id', ParseUuidParamPipe) id: string): Promise<PatientInsurance> {
        // Use findById — child PK is sufficient, no need to re-filter by parent
        return this.patientInsurancesService.findById(id);
    }

    @Put(':patient_id/insurances/:insurance_id')
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: UPDATE_PATIENT_INSURANCE_NESTED_SUMMARY })
    @ApiParam({ name: 'patient_id', description: PATIENT_ID_PARAM_DESCRIPTION })
    @ApiParam({ name: 'insurance_id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    @ApiJsonApiResponse('patient-insurances', HttpStatus.OK, PatientInsuranceResponseDTO)
    update(
        @Param('insurance_id', ParseUuidParamPipe) id: string,
        @Body() updateDTO: UpdatePatientInsuranceDTO,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<PatientInsurance> {
        return this.patientInsurancesService.update(id, updateDTO, currentUser);
    }

    @Delete(':patient_id/insurances/:insurance_id')
    @RequirePermission('patient:update', { th: 'แก้ไขข้อมูลผู้ป่วย', en: 'Update patient' })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: DELETE_PATIENT_INSURANCE_NESTED_SUMMARY })
    @ApiParam({ name: 'patient_id', description: PATIENT_ID_PARAM_DESCRIPTION })
    @ApiParam({ name: 'insurance_id', description: PATIENT_INSURANCE_ID_PARAM_DESCRIPTION })
    softDelete(
        @Param('insurance_id', ParseUuidParamPipe) id: string,
        @CurrentUser() currentUser: IUserSession,
    ): Promise<void> {
        // service.delete(id, softDelete=true, currentUser)
        return this.patientInsurancesService.delete(id, true, currentUser);
    }
}
```

---

### Step 5: Define Module

**File**: `apps/[BOUNDED_CONTEXT]/src/modules/[MODULE]/[entity].module.ts`

**Key Points**:

- Module must be decorated with `@Module()`
- Import `TypeOrmModule.forFeature()` to register entities
- Register **both flat and nested controllers** in `controllers` array
- Register Controller and Service as providers
- Import `CommonModule` for shared guards and decorators

**Example**:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { MeditechDatabases } from '@lib/common/enum/meditech-databases.enum';

import { PatientInsurancesNestedController } from './controllers/patient-insurances-nested.controller';
import { PatientInsurancesController } from './controllers/patient-insurances.controller';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { PatientInsurancesService } from './services/patient-insurances.service';

@Module({
    imports: [
        CommonModule,
        TypeOrmModule.forFeature([PatientInsurance], MeditechDatabases.MEDITECH_CORE),
    ],
    controllers: [PatientInsurancesController, PatientInsurancesNestedController],
    providers: [PatientInsurancesService],
    exports: [PatientInsurancesService],
})
export class PatientInsuranceModule {}
```

---

## Complete File Structure Example

After completing all 5 steps, your module should have this structure:

```text
apps/emr-bc/src/modules/patient/
├── constants/
│   ├── patient-insurance.constants.ts            ← PATIENT_INSURANCE_ALLOWED_RELATIONS (if non-empty)
│   ├── patient-insurance.swagger.ts              ← API description strings (@ApiOperation/@ApiParam/etc.)
│   └── swagger-common.ts                         ← strings shared across controllers in this BC (optional)
├── entities/
│   └── patient-insurance.entity.ts
├── dto/
│   ├── create-patient-insurance.dto.ts
│   ├── create-patient-insurance-nested.dto.ts    ← OmitType(Create, ['patient_id'])
│   ├── update-patient-insurance.dto.ts
│   ├── patient-insurance-query-params.dto.ts     ← queryParamsWithRelations(...) (if non-empty)
│   └── patient-insurance-response.dto.ts
├── services/
│   └── patient-insurances.service.ts
├── controllers/
│   ├── patient-insurances.controller.ts          ← /patient-insurances  (flat CRUD)
│   └── patient-insurances-nested.controller.ts   ← /patients/:id/insurances
└── patient.module.ts
```

> `patient-insurance.constants.ts` and the query-params DTO are only created when `allowedRelations` is non-empty. `patient-insurance.swagger.ts` is always created (it holds the controller's `@ApiOperation`/`@ApiParam`/etc. description strings).

---

## Key Principles Recap

✅ **Entity extends BaseEntity** — Inherits id, timestamps, and audit fields automatically
✅ **Always `timestamptz`** — Never use `type: 'date'`; always `type: 'timestamptz'` with `Date | null`
✅ **Always `@IsISO8601()`** — Never use `@IsDateString()`; import from `@lib/common/decorators/custom-validate-dto/is-iso-8601.decorator.ts`
✅ **DTOs use class-validator** — Automatic validation
✅ **Service extends BaseServiceOperations** — Automatic CRUD handling
✅ **Controller extends BaseControllerOperations** — HTTP endpoint mapping
✅ **Nested controller in separate file** — `[entity]s-nested.controller.ts` at parent route
✅ **Nested GET list** — `findPaginated({ ...query, filter: [].concat(query.filter ?? []).concat('parent_id||$eq||id') })`
✅ **Nested GET single** — `findById(childId)` — child PK is sufficient
✅ **Nested POST** — `OmitType` DTO omits parent FK; inject from URL param
✅ **Nested DELETE** — `service.delete(id, true, currentUser)` for soft delete
✅ **No `private readonly` for super()-only params** — avoids TS unused-property warnings
✅ **@ResourceType() decorator** — JSON:API response formatting
✅ **@RequirePermission(permission, { th, en })** — Authorization checks; always pass the `{ th, en }` name, it's synced into iam's `permissions` catalog by `npm run permissions:sync`
✅ **@Param(name, ParseUuidParamPipe)** — Every UUID route param, on every endpoint (flat and nested), rejects malformed UUIDs with `400002` instead of a raw DB error
✅ **No @ApiBearerAuth()** — Auth is configured globally, not per-controller
✅ **Use @ValidatedQuery()** — Query parameter validation
✅ **`queryParamsWithRelations` factory** — When `allowedRelations` is non-empty, create `constants/<resource>.constants.ts` + `dto/<resource>-query-params.dto.ts`; use the resource-specific DTO in `@ApiQuery` and `@ValidatedQuery` so Scalar shows a multi-select enum for `relations`

---

## Related Resources

- [Base Operations Architecture](/guides/base-operations-architecture.md)
- [Entity & DTO Principles](/guides/entity-dto-principle.md)
- [API Response & Error Handling](/guides/api-response-error-handling.md)
- [Naming Conventions](/guides/naming-conventions.md)
- [Essential Best Practices - REST API](/guides/essential-best-practices-rest-api.md)
