---
name: testing
description: "Advanced NestJS testing patterns and best practices for MediTech. Covers ESLint compliance in tests, mock typing patterns, BaseControllerOperations delegation pattern, type casting pitfalls, boolean expression safety, and real-world testing examples. Use when writing unit tests, E2E tests, fixing test ESLint errors, mocking services/repositories, or testing controllers that extend BaseControllerOperations."
---

# Testing SKILL - Advanced Patterns & Best Practices

> **Version**: 2.1.0
> **Last Updated**: 2026-07-20
> **Category**: Testing & Quality Assurance

## Overview

This document captures advanced testing patterns, ESLint compliance strategies, and architectural patterns discovered through real-world testing scenarios in the MediTech medication-drug module. It supplements the base testing guide with practical solutions to common testing pitfalls.

## Table of Contents

1. [ESLint Compliance in Tests](#eslint-compliance-in-tests)
2. [Mock Typing Patterns](#mock-typing-patterns)
3. [BaseControllerOperations Delegation Pattern](#basecontrolleroperations-delegation-pattern)
4. [Type Casting Pitfalls](#type-casting-pitfalls)
5. [Boolean Expression Safety](#boolean-expression-safety)
6. [Real-World Examples](#real-world-examples)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## ESLint Compliance in Tests

### Issue: `@typescript-eslint/unbound-method` Rule Violations

The `@typescript-eslint/unbound-method` rule prevents accessing methods from objects without binding context. This commonly occurs in tests when type casting mocks to real service types.

#### ❌ WRONG: Type Casting Mocks

```typescript
describe('PatientsController (Unit)', () => {
    let controller: PatientsController;
    let service: PatientsService; // ← This is the problem!

    const mockService = createMockPatientsService();

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            controllers: [PatientsController],
            providers: [{ provide: PatientsService, useValue: mockService }],
        }).compile();

        controller = module.get(PatientsController);
        service = module.get(PatientsService); // ← Type casting happens here implicitly
    });

    it('should call service method', async () => {
        mockService.create.mockResolvedValue(mockEntity);
        await controller.create(dto);

        // ❌ ERROR: Unbound method violation
        expect(service.create).toHaveBeenCalledWith(dto);
        //     ^^^^^^ Accessing method from service variable
    });
});
```

**Why this fails**: TypeScript sees `service: PatientsService` as a reference to the real service type. When you access `service.create`, ESLint complains that you're accessing a method that might not have the correct `this` binding.

#### ✅ CORRECT: Use Mock Objects Directly

```typescript
describe('PatientsController (Unit)', () => {
    let controller: PatientsController;

    const mockService = createMockPatientsService();

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            controllers: [PatientsController],
            providers: [{ provide: PatientsService, useValue: mockService }],
        }).compile();

        controller = module.get(PatientsController);
        // ✅ Don't assign service to a variable with type annotation
    });

    it('should call service method', async () => {
        mockService.create.mockResolvedValue(mockEntity);
        await controller.create(dto);

        // ✅ CORRECT: Use mock object directly
        expect(mockService.create).toHaveBeenCalledWith(dto);
        //     ^^^^^^^^^^^ Reference to mock, not typed service
    });
});
```

### Key Rule: Never Type Cast Mocks to Real Service Types

**Pattern**: Use mock factories that return explicitly typed mock objects, not variables typed as real services.

```typescript
// ✅ GOOD: Return type is explicit MockPatientsService, not PatientsService
export type MockPatientsService = {
    create: jest.Mock<Promise<Patient>, [CreatePatientDTO, IUserSession]>;
    findById: jest.Mock<Promise<Patient>, [string]>;
    update: jest.Mock<Promise<Patient>, [string, UpdatePatientDTO, IUserSession]>;
};

export function createMockPatientsService(): MockPatientsService {
    return {
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
    };
}

// Use it
const mockService = createMockPatientsService(); // Type is MockPatientsService
expect(mockService.create).toHaveBeenCalled(); // ✅ No ESLint violation
```

---

## Mock Typing Patterns

### Problem: Untyped jest.fn() Calls

When you don't specify generic parameters for `jest.fn()`, TypeScript defaults to `jest.Mock<any, any>`, which bypasses type safety.

#### ❌ WRONG: Untyped jest.fn()

```typescript
export function createMockPatientsService() {
    return {
        create: jest.fn(), // ← Type is jest.Mock<any, any>
        findById: jest.fn(),
        update: jest.fn(),
    };
}

// Usage - no type safety
const result = await mockService.create('not a DTO'); // ← No error!
```

#### ✅ CORRECT: Explicitly Typed jest.fn()

Use the generic syntax: `jest.fn<ReturnType, [ArgumentType1, ArgumentType2, ...]>()`

```typescript
export type MockMedicationOrderItemService = {
    create: jest.Mock<
        Promise<MedicationOrderItem>,
        [Partial<CreateMedicationOrderItemDTO>, IUserSession]
    >;
    findById: jest.Mock<Promise<MedicationOrderItem | null>, [string]>;
    update: jest.Mock<
        Promise<MedicationOrderItem>,
        [string, Partial<UpdateMedicationOrderItemDTO>, IUserSession]
    >;
};

export function createMockMedicationOrderItemService(): MockMedicationOrderItemService {
    const mockData = createMockMedicationOrderItem();

    return {
        create: jest
            .fn<
                Promise<MedicationOrderItem>,
                [Partial<CreateMedicationOrderItemDTO>, IUserSession]
            >()
            .mockResolvedValue(mockData),

        findById: jest
            .fn<Promise<MedicationOrderItem | null>, [string]>()
            .mockResolvedValue(mockData),

        update: jest
            .fn<
                Promise<MedicationOrderItem>,
                [string, Partial<UpdateMedicationOrderItemDTO>, IUserSession]
            >()
            .mockResolvedValue(mockData),
    };
}
```

### Benefits of Explicit Typing

1. **Type Safety**: TypeScript will error if you call mock with wrong argument types
2. **IntelliSense**: IDEs provide proper autocomplete for mock methods
3. **Return Type Validation**: Ensures mock returns correct type
4. **Documentation**: Method signatures serve as documentation

### Pattern: Factory Type Definitions

Always define the mock service type **before** creating the factory function:

```typescript
// Step 1: Define the type
export type MockMedicationOrdersService = {
    findOneOrQuery: jest.Mock<
        Promise<MedicationOrder | null>,
        [{ s?: Record<string, unknown>; sort?: string }, { skipNotFound?: boolean }]
    >;
    create: jest.Mock<Promise<MedicationOrder>, [Partial<CreateMedicationOrderDTO>, IUserSession]>;
};

// Step 2: Create the factory implementing that type
export function createMockMedicationOrdersService(): MockMedicationOrdersService {
    return {
        findOneOrQuery: jest.fn(),
        create: jest.fn(),
    };
}
```

---

## BaseControllerOperations Delegation Pattern

### Understanding the Delegation

`BaseControllerOperations` is an abstract class that provides default CRUD implementations. When you call `super.softDelete()`, it delegates to `service.delete()` with specific parameters.

#### Pattern: softDelete() → delete()

```typescript
// In BaseControllerOperations source
async softDelete(id: string, currentUser: IUserSession) {
    // Delegates to service.delete with soft delete flag
    return this.service.delete(id, true, currentUser);
    //                   ^^^^^^ Note: NOT softDelete()!
}
```

#### When Testing Controllers That Extend BaseControllerOperations

Always verify what the parent class actually calls:

```typescript
describe('MedicationOrdersController (Unit)', () => {
    const mockService = createMockMedicationOrdersService();

    it('should call service.delete with soft delete flag when softDelete is called', async () => {
        mockService.delete.mockResolvedValue(undefined);

        await controller.softDelete(ORDER_ID, mockCurrentUser);

        // ✅ Verify the actual delegation: service.delete(id, true, currentUser)
        expect(mockService.delete).toHaveBeenCalledWith(
            ORDER_ID,
            true, // ← soft delete flag
            mockCurrentUser,
        );
    });
});
```

### Key Takeaway

When testing controllers that extend `BaseControllerOperations`, understand the delegation chain. Don't assume the method name matches the service method called.

---

## Type Casting Pitfalls

### Pitfall 1: Casting Mocks to Real Types

```typescript
// ❌ ANTI-PATTERN
const mockService = createMockMedicationOrdersService();
const service = mockService as unknown as MedicationOrdersService;
// Now accessing `service.create` triggers unbound-method rule

// ✅ PATTERN
const mockService = createMockMedicationOrdersService();
// Use mockService directly, which is type MockMedicationOrdersService
```

### Pitfall 2: Variable Assignment with Type Annotations

```typescript
// ❌ ANTI-PATTERN
let operationService: MedicationOperationService;
// ... later ...
operationService = mockService as unknown as MedicationOperationService;

// ✅ PATTERN
// Just use the mock directly:
const mockOperationService = createMockMedicationOperationService();
expect(mockOperationService.method).toHaveBeenCalled();
```

### Pitfall 3: Implicit Type Casting via Module.get()

```typescript
// ❌ ANTI-PATTERN
service = module.get(PatientsService); // Implicitly typed to PatientsService

// ✅ PATTERN for Unit Tests
// Don't assign to a typed variable; use mock directly
const mockService = createMockPatientsService();

// ✅ PATTERN for E2E Tests (if you must get real service)
const realService = moduleFixture.get(PatientsService);
// But in unit tests, always use mocks
```

---

## Boolean Expression Safety

### ESLint Rule: `@typescript-eslint/strict-boolean-expressions`

This rule requires explicit boolean checks instead of relying on truthy/falsy values.

#### ❌ WRONG: Implicit Truthy/Falsy

```typescript
// In embedding.service.ts - BAD
const response = await firstValueFrom(...);
const embedding = response?.data?.embedding;

if (embedding) { // ← Implicit truthy check
    return embedding;
}

// Problem: What if embedding is an empty array []? It's falsy but valid
```

#### ✅ CORRECT: Explicit Type Check

```typescript
// GOOD: Explicit Array.isArray() check
const response = await firstValueFrom(...);
const embedding = response?.data?.embedding;

if (Array.isArray(embedding)) { // ← Explicit type check
    return embedding;
}

throw new Error('Invalid response structure from embedding service');
```

### Pattern: Extract, Then Check

For complex conditions, extract the value first, then perform explicit checks:

```typescript
// ❌ WRONG
if (result?.data?.items && result.data.items.length) {
}

// ✅ CORRECT
const items = result?.data?.items;
if (Array.isArray(items) && items.length > 0) {
}
```

---

## Real-World Examples

### Example 1: Complete Mock Factory with Proper Typing

**File**: `test/mocks/mock-medication-order-item.ts`

```typescript
import { IResponsePaginatedService, IUserSession } from '@lib/common';

import { CreateMedicationOrderItemDTO } from '@apps/opd-bc/src/modules/medication-drug/dto/create-medication-order-item.dto';
import { MedicationOrderItem } from '@apps/opd-bc/src/modules/medication-drug/entities/medication-order-item.entity';

// Step 1: Define constant test data
export const MOCK_ORDER_ID = '550e8400-e29b-41d4-a716-446655440004';
export const MOCK_GENERIC_DRUG_ID = '550e8400-e29b-41d4-a716-446655440010';

// Step 2: Define mock entity factory
export function createMockMedicationOrderItem(
    overrides?: Partial<MedicationOrderItem>,
): MedicationOrderItem {
    return {
        id: 'item-uuid-123',
        medication_order_id: MOCK_ORDER_ID,
        generic_drug_id: MOCK_GENERIC_DRUG_ID,
        drug_display_name: 'Aspirin 500mg',
        route: 'PO',
        dosage_quantity: 500,
        dosage_unit: 'mg',
        frequency_text: '3 times daily',
        instruction: 'Take with water, swallow whole',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-uuid-123',
        updated_by: 'user-uuid-123',
        deleted_at: null,
        is_deleted: false,
        ...overrides,
    } as MedicationOrderItem;
}

// Step 3: Define mock DTO factory
export function createMockCreateMedicationOrderItemDTO(
    overrides?: Partial<CreateMedicationOrderItemDTO>,
): Partial<CreateMedicationOrderItemDTO> {
    return {
        generic_drug_id: MOCK_GENERIC_DRUG_ID,
        drug_display_name: 'Aspirin 500mg',
        route: 'PO',
        dosage_quantity: 500,
        dosage_unit: 'mg',
        frequency_text: '3 times daily',
        instruction: 'Take with water, swallow whole',
        ...overrides,
    };
}

// Step 4: Define explicit mock service type
export interface MockMedicationOrderItemService {
    create: jest.Mock<
        Promise<MedicationOrderItem>,
        [Partial<CreateMedicationOrderItemDTO>, IUserSession]
    >;
    findById: jest.Mock<Promise<MedicationOrderItem | null>, [string]>;
    findByOrderId: jest.Mock<Promise<MedicationOrderItem[]>, [string]>;
    findPaginated: jest.Mock<Promise<IResponsePaginatedService<MedicationOrderItem[]>>, [unknown]>;
    update: jest.Mock<
        Promise<MedicationOrderItem>,
        [string, Partial<CreateMedicationOrderItemDTO>, IUserSession]
    >;
    delete: jest.Mock<Promise<void>, [string, boolean, IUserSession]>;
}

// Step 5: Implement the factory
export function createMockMedicationOrderItemService(): MockMedicationOrderItemService {
    const mockData = createMockMedicationOrderItem();
    const mockPaginatedResponse: IResponsePaginatedService<MedicationOrderItem[]> = {
        data: [mockData],
        pagination: {
            page: 1,
            page_size: 10,
            total: 1,
            total_records: 1, // ← Important: Must include all fields
            total_pages: 1,
        },
    };

    return {
        create: jest
            .fn<
                Promise<MedicationOrderItem>,
                [Partial<CreateMedicationOrderItemDTO>, IUserSession]
            >()
            .mockResolvedValue(mockData),
        findById: jest
            .fn<Promise<MedicationOrderItem | null>, [string]>()
            .mockResolvedValue(mockData),
        findByOrderId: jest
            .fn<Promise<MedicationOrderItem[]>, [string]>()
            .mockResolvedValue([mockData]),
        findPaginated: jest
            .fn<Promise<IResponsePaginatedService<MedicationOrderItem[]>>, [unknown]>()
            .mockResolvedValue(mockPaginatedResponse),
        update: jest
            .fn<
                Promise<MedicationOrderItem>,
                [string, Partial<CreateMedicationOrderItemDTO>, IUserSession]
            >()
            .mockResolvedValue(mockData),
        delete: jest
            .fn<Promise<void>, [string, boolean, IUserSession]>()
            .mockResolvedValue(undefined),
    };
}
```

### Example 2: Unit Test Using Mock Factory (No Type Casting)

**File**: `test/unit/medication-order-item.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';

import { type IUserSession } from '@lib/common';

import {
    createMockCreateMedicationOrderItemDTO,
    createMockMedicationOrderItemService,
} from '@apps/opd-bc/test/mocks/mock-medication-order-item';

import { MedicationOrderItemsController } from '../../src/modules/medication-drug/controllers/medication-order-items.controller';
import { MedicationOrderItemsService } from '../../src/modules/medication-drug/services/medication-order-items.service';

describe('MedicationOrderItemsController (Unit)', () => {
    let controller: MedicationOrderItemsController;

    const mockCurrentUser: IUserSession = {
        id: 'user-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['medication:create'],
        fullname: 'Test User',
    };

    // ✅ CORRECT: Create mock using factory
    const mockItemsService = createMockMedicationOrderItemService();

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MedicationOrderItemsController],
            providers: [
                {
                    provide: MedicationOrderItemsService,
                    useValue: mockItemsService,
                },
            ],
        }).compile();

        // ✅ CORRECT: Just get the controller
        controller = module.get<MedicationOrderItemsController>(MedicationOrderItemsController);
        // ❌ DON'T DO: service = module.get(MedicationOrderItemsService)
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createOrderItem', () => {
        it('should create order item successfully', async () => {
            // ARRANGE
            const orderItemDTO = createMockCreateMedicationOrderItemDTO();
            mockItemsService.create.mockResolvedValue(/* mock item */);

            // ACT
            await controller.createOrderItem('order-id', orderItemDTO, mockCurrentUser);

            // ASSERT
            // ✅ CORRECT: Use mock object directly
            expect(mockItemsService.create).toHaveBeenCalledWith(
                expect.objectContaining(orderItemDTO),
                mockCurrentUser,
            );
        });
    });
});
```

---

## Troubleshooting Guide

### Problem 1: "Unbound method" ESLint Error

**Symptom**:

```
error  @typescript-eslint/unbound-method: Unsafe assignment of an 'any' value. Unsafe member access [expression].create on an 'any' value.
```

**Root Causes**:

1. Assigning mock to variable typed as real service
2. Type casting with `as unknown as RealService`
3. Getting service from module with type annotation

**Solutions**:

1. Use mock object directly: `mockService.create` (not `service.create`)
2. Don't assign to typed variables in unit tests
3. Remove type annotations for mocked services

### Problem 2: Missing Pagination Fields

**Symptom**:

```typescript
const paginated = mockPaginatedResponse; // Type error - missing total_records
```

**Solution**: Ensure `IResponsePaginatedService` has all required fields:

```typescript
const mockPaginatedResponse: IResponsePaginatedService<Item[]> = {
    data: [mockData],
    pagination: {
        page: 1,
        page_size: 10,
        total: 1,
        total_records: 1, // ← Don't forget this!
        total_pages: 1,
    },
};
```

### Problem 3: jest.fn() Type Inference Fails

**Symptom**: No autocomplete or type checking for mock calls

**Solution**: Explicitly specify generic parameters:

```typescript
// ❌ Before
create: jest.fn();

// ✅ After
create: jest.fn<
    Promise<MedicationOrderItem>,
    [Partial<CreateMedicationOrderItemDTO>, IUserSession]
>();
```

### Problem 4: `Config validation error: "NODE_ENV" must be one of [local, dev, staging, prod]`

**Symptom**: Running `pnpm run test:<bc>` (e.g. `test:iam`) crashes at startup with a `ConfigModule` validation error, before any test even runs.

**Root Cause**: Jest's own default (`NODE_ENV=test`) is not in this repo's Joi-validated range. As soon as a spec imports `@lib/config` (directly, or transitively via the `@lib/common` barrel), `ConfigModule` throws.

**Solution**: Already fixed centrally — every `apps/<bc>/jest.config.js` wires up `setupFiles: ['<rootDir>/../../libs/common/test/jest-setup-env.js']`, which force-sets `NODE_ENV` to `local` inside the Jest worker (only) if it isn't already a valid value. Nothing to do per test file or per BC; if you scaffold a brand-new app's `jest.config.js`, just copy the `setupFiles` line from an existing one (e.g. `apps/iam/jest.config.js`).

### Problem 5: Boolean Expression ESLint Error

**Symptom**:

```
error  @typescript-eslint/strict-boolean-expressions: Unexpected falsy value in conditional
```

**Solution**: Use explicit type checks:

```typescript
// ❌ Before
if (embedding) {
}

// ✅ After
if (Array.isArray(embedding)) {
}
```

---

## Checklist for Compliant Tests

- [ ] No variables typed as real service types
- [ ] Mock factories return explicit MockXxxService types
- [ ] All `jest.fn()` calls have explicit generic parameters
- [ ] No type casting (`as unknown as`) of mocks
- [ ] Mock objects used directly in assertions
- [ ] All boolean checks are explicit (`===`, `!==`, `Array.isArray()`, etc.)
- [ ] Pagination objects include `total_records` field
- [ ] No `any` types without explicit `// eslint-disable-next-line` comment
- [ ] Tests pass with no ESLint warnings

---

## Integration with Base Testing Guide

This document complements `/guides/testing-unit-e2e.md`. While that guide covers fundamental patterns, this document focuses on:

- ESLint compliance strategies
- Advanced mock typing patterns
- Common pitfalls and solutions
- Real architectural patterns (delegation, BaseControllerOperations)

Use both documents together when implementing tests in MediTech services.

---

## References

- [Testing Guide](/guides/testing-unit-e2e.md)
- [Base Operations Architecture](/guides/base-operations-architecture.md)
- [Entity & DTO Principle](/guides/entity-dto-principle.md)
- [Naming Conventions](/guides/naming-conventions.md)
