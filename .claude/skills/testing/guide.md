# Testing Guide for NestJS Microservices

## Overview

Testing is critical in medical technology systems to ensure reliability, correctness, and maintainability. This guide provides comprehensive instructions for writing **unit tests** and **end-to-end (E2E) tests** for NestJS microservices using **Jest** and **Supertest**.

## Part 1: Understanding the Testing Pyramid

The testing pyramid shows the recommended distribution of tests:

```
        /\
       /  \      E2E Tests (Few)
      /____\     - Test full workflows (HTTP, Pipes, Interceptors)
     /      \    - Slower, but prove integration
    /  Unit  \   Integration Tests (Some)
   /  Tests   \  - Test module/service interactions
  /____________\ Unit Tests (Many)
                 - Test a single function/class in isolation
                 - Fast, focused, and predictable
```

**Why?**

- **Unit Tests** (Many): Fast feedback, easy to debug, cheap to run
- **Integration Tests** (Some): Verify modules work together
- **E2E Tests** (Few): Prove the complete system works end-to-end

## Part 2: Coding Standards for Tests

All test code must adhere to these rules:

### 1. Explicit Types (Never use `any`)

```typescript
// ❌ BAD
const data: any = mockService.method();

// ✅ GOOD
const data: Patient = mockService.method();
```

### 2. Naming Conventions

- **Variables**: `camelCase` (e.g., `mockService`, `patientId`)
- **Classes**: `PascalCase` (e.g., `PatientsController`, `CreatePatientDTO`)
- **Test names**: "should..." describing expected behavior
- **Boolean variables**: Prefix with `is`, `has`, `should` (e.g., `isValid`, `hasPermission`)

### 3. Strict Boolean Checks

```typescript
// ❌ BAD - Implicit truthy/falsy
if (users.length) {
}
if (user) {
}

// ✅ GOOD - Explicit checks
if (users.length > 0) {
}
if (user !== null) {
}
```

### 4. No Console.log in Tests

Tests should not output to console except through proper logging libraries.

### 5. Use Mocking Properly

```typescript
// ❌ BAD - Using jest.fn() as any
const mockService = jest.fn() as any;

// ✅ GOOD - Using createMock or dedicated factory
const mockService = createMockPatientsService();
```

## Part 3: Project Testing Structure

Each microservice follows this standardized structure:

```
apps/[SERVICE_NAME]/
├── jest.config.js              # Unit test configuration
├── src/
│   └── modules/
│       └── [MODULE]/
│           ├── controllers/[name].controller.ts
│           ├── services/[name].service.ts
│           ├── entities/[name].entity.ts
│           └── dto/
│               ├── create-[name].dto.ts
│               └── update-[name].dto.ts
└── test/
    ├── jest-e2e.json           # E2E test configuration
    ├── mocks/                  # Reusable mock factories
    │   └── mock-[name].ts
    ├── unit/                   # Unit tests
    │   ├── [name].controller.spec.ts
    │   └── [name].service.spec.ts
    └── e2e/                    # End-to-end tests
        └── [name].e2e-spec.ts
```

## Part 4: The AAA Pattern

All tests follow **Arrange-Act-Assert**:

```typescript
it('should do something', async () => {
    // 1. ARRANGE - Set up test data and mocks
    const input = { name: 'John' };
    mockService.method.mockResolvedValue({ id: '123', name: 'John' });

    // 2. ACT - Execute the code under test
    const result = await controller.method(input);

    // 3. ASSERT - Verify the results
    expect(result).toEqual({ id: '123', name: 'John' });
    expect(mockService.method).toHaveBeenCalledWith(input);
});
```

## Part 5: Setting Up Jest Configurations

### Unit Test Configuration (`jest.config.js`)

```javascript
module.exports = {
    displayName: '[SERVICE_NAME]:unit',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
    coverageDirectory: '../../coverage/[SERVICE_NAME]/unit',
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
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    transformIgnorePatterns: ['/node_modules/(?!uuid)'],
    moduleNameMapper: {
        '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
        '^@lib/config(|/.*)$': '<rootDir>/../../libs/config/src/$1',
        '^@lib/database(|/.*)$': '<rootDir>/../../libs/database/src/$1',
        '^apps/[SERVICE_NAME](|/.*)$': '<rootDir>/$1',
    },
};
```

### E2E Test Configuration (`test/jest-e2e.json`)

```json
{
    "displayName": "[SERVICE_NAME]:e2e",
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "testEnvironment": "node",
    "testMatch": ["<rootDir>/e2e/**/*.e2e-spec.ts"],
    "transform": {
        "^.+\\.(t|j)s$": "ts-jest"
    },
    "transformIgnorePatterns": ["/node_modules/(?!uuid)"],
    "moduleNameMapper": {
        "^@lib/common(|/.*)$": "<rootDir>/../../../libs/common/src/$1",
        "^@lib/config(|/.*)$": "<rootDir>/../../../libs/config/src/$1",
        "^@lib/database(|/.*)$": "<rootDir>/../../../libs/database/src/$1",
        "^@apps/[SERVICE_NAME](|/.*)$": "<rootDir>/../$1",
        "^apps/[SERVICE_NAME](|/.*)$": "<rootDir>/../$1",
        "^@apps/(.*)$": "<rootDir>/../../$1"
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

### NPM Scripts (`package.json`)

```json
{
    "scripts": {
        "test:[SERVICE_NAME]": "cross-env NODE_ENV=dev jest --config ./apps/[SERVICE_NAME]/jest.config.js --watch",
        "test:[SERVICE_NAME]:e2e": "cross-env NODE_ENV=dev jest --config ./apps/[SERVICE_NAME]/test/jest-e2e.json --watch",
        "test": "jest",
        "test:watch": "jest --watch",
        "test:cov": "jest --coverage"
    }
}
```

## Part 6: Mock Factory Pattern

**Key Principle**: Create reusable mock factories to keep tests DRY and maintainable.

### Structure of a Mock Factory

```typescript
// test/mocks/mock-[entity].ts

import { CreatePatientDTO } from '../../src/modules/patient/dto/create-patient.dto';
import { Patient } from '../../src/modules/patient/entities/patient.entity';

// Export the type for IntelliSense — use explicit generics for type safety
export type MockPatientsService = {
    findOne: jest.Mock<Promise<Patient | null>, [string]>;
    create: jest.Mock<Promise<Patient>, [CreatePatientDTO]>;
    update: jest.Mock<Promise<Patient>, [string, Partial<CreatePatientDTO>]>;
    findAll: jest.Mock<Promise<Patient[]>, []>;
    delete: jest.Mock<Promise<void>, [string]>;
};

// Helper to create fake entity data
export function createMockPatientEntity(overrides: Partial<Patient> = {}): Patient {
    const defaultEntity: Patient = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        hn: 'HN001',
        first_name_thai: 'สมชาย',
        last_name_thai: 'รักษาดี',
        birth_date: new Date('1990-01-15'),
        created_at: new Date(),
        updated_at: new Date(),
    } as Patient;

    return { ...defaultEntity, ...overrides };
}

// Helper to create fake DTO
export function createMockPatientDTO(overrides: Partial<CreatePatientDTO> = {}): CreatePatientDTO {
    const defaultDTO: CreatePatientDTO = {
        first_name_thai: 'สมชาย',
        last_name_thai: 'รักษาดี',
        birth_date: '1990-01-15',
    } as CreatePatientDTO;

    return { ...defaultDTO, ...overrides };
}

// Main factory function
export function createMockPatientsService(): MockPatientsService {
    const defaultEntity = createMockPatientEntity();

    return {
        findOne: jest.fn<Promise<Patient | null>, [string]>().mockResolvedValue(defaultEntity),
        create: jest.fn<Promise<Patient>, [CreatePatientDTO]>().mockResolvedValue(defaultEntity),
        update: jest
            .fn<Promise<Patient>, [string, Partial<CreatePatientDTO>]>()
            .mockResolvedValue(defaultEntity),
        findAll: jest.fn<Promise<Patient[]>, []>().mockResolvedValue([defaultEntity]),
        delete: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    };
}
```

## Part 7: Unit Testing Controllers

**Key Principle**: Mock the entire service layer. Test only the controller's logic.

### Controller Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';

import { createMockPatientsService } from '@apps/[SERVICE_NAME]/test/mocks/mock-patients';

import { PatientsController } from '../../src/modules/patient/controllers/patients.controller';
import { CreatePatientDTO } from '../../src/modules/patient/dto/create-patient.dto';
import { PatientsService } from '../../src/modules/patient/services/patients.service';

describe('PatientsController (Unit)', () => {
    let controller: PatientsController;

    const mockService = createMockPatientsService();

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PatientsController],
            providers: [
                {
                    provide: PatientsService,
                    useValue: mockService,
                },
            ],
        }).compile();

        controller = module.get<PatientsController>(PatientsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
        expect(mockService).toBeDefined();
    });

    describe('create', () => {
        it('should create a patient successfully', async () => {
            // ARRANGE
            const createDTO = createMockPatientDTO();

            mockService.create.mockResolvedValue({
                id: 'patient-uuid-123',
                ...createDTO,
            } as Patient);

            // ACT
            const result = await controller.create(createDTO as CreatePatientDTO);

            // ASSERT
            expect(result).toBeDefined();
            expect(mockService.create).toHaveBeenCalledWith(createDTO);
            expect(mockService.create).toHaveBeenCalledTimes(1);
        });

        it('should handle service errors', async () => {
            const error = new Error('Database error');
            mockService.create.mockRejectedValue(error);

            await expect(
                controller.create(createMockPatientDTO() as CreatePatientDTO),
            ).rejects.toThrow('Database error');
        });
    });

    describe('findAll', () => {
        it('should return a list of patients', async () => {
            // ARRANGE
            const mockPatients = [createMockPatientEntity(), createMockPatientEntity()];
            mockService.findAll.mockResolvedValue(mockPatients);

            // ACT
            const result = await controller.findAll();

            // ASSERT
            expect(result).toEqual(mockPatients);
            expect(mockService.findAll).toHaveBeenCalled();
        });
    });
});
```

### Best Practices for Controller Tests

1. **Test one method per describe block** - Group related tests using `describe`
2. **Verify service was called correctly** - Check arguments and call count
3. **Test both success and error cases** - Always test error handling
4. **Mock completely** - Don't call real service or repository
5. **Clear mocks** - Use `jest.clearAllMocks()` in `afterEach()`

## Part 8: Unit Testing Services

**Key Principle**: Mock the EntityManager or Repository. Test business logic in isolation.

### Service Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';

import { EntityManager } from 'typeorm';

import { Patient } from '../../src/modules/patient/entities/patient.entity';
import { PatientsService } from '../../src/modules/patient/services/patients.service';

describe('PatientsService (Unit)', () => {
    let service: PatientsService;

    const mockEntityManager = {
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        delete: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PatientsService,
                {
                    provide: EntityManager,
                    useValue: mockEntityManager,
                },
            ],
        }).compile();

        service = module.get<PatientsService>(PatientsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create and save a patient', async () => {
            // ARRANGE
            const dto = createMockPatientDTO();
            const expectedPatient = createMockPatientEntity();

            mockEntityManager.save.mockResolvedValue(expectedPatient);

            // ACT
            const result = await service.create(dto as CreatePatientDTO);

            // ASSERT
            expect(result).toEqual(expectedPatient);
            expect(mockEntityManager.save).toHaveBeenCalledTimes(1);
        });

        it('should handle database errors', async () => {
            mockEntityManager.save.mockRejectedValue(new Error('Database error'));

            await expect(
                service.create(createMockPatientDTO() as CreatePatientDTO),
            ).rejects.toThrow('Database error');
        });
    });
});
```

## Part 9: End-to-End Testing with Supertest

**Key Principle**: Test the FULL HTTP request/response pipeline. This is the ONLY way to test:

- Routing (does `/patients` map to correct controller?)
- ValidationPipe (does DTO validation work?)
- TransformInterceptor (is response JSON:API formatted?)
- AllExceptionsFilter (are errors formatted correctly?)
- Decorators (do @Param, @Body work?)

### E2E Test Template

```typescript
import * as http from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';

import { createMockPatientsService } from '@apps/[SERVICE_NAME]/test/mocks/mock-patients';

import { PatientsController } from '../../src/modules/patient/controllers/patients.controller';
import { PatientsService } from '../../src/modules/patient/services/patients.service';

describe('PatientsController (e2e)', () => {
    let app: INestApplication;
    let server: http.Server;

    const mockService = createMockPatientsService();
    const MOCK_PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PatientsController],
            providers: [
                {
                    provide: PatientsService,
                    useValue: mockService,
                },
            ],
        }).compile();

        app = module.createNestApplication();

        // Apply global pipes for validation
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
                forbidNonWhitelisted: true,
            }),
        );

        // Apply global interceptors
        const reflector = app.get(Reflector);
        app.useGlobalInterceptors(new TransformInterceptor(reflector));
        app.useGlobalFilters(new AllExceptionsFilter());

        await app.init();
        server = app.getHttpServer() as http.Server;
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /patients', () => {
        it('should create patient and return 201', async () => {
            // ARRANGE
            const createDTO = {
                first_name_thai: 'สมชาย',
                last_name_thai: 'รักษาดี',
                birth_date: '1990-01-15',
            };

            // ACT
            const response = await request(server).post('/patients').send(createDTO).expect(201);

            // ASSERT
            expect(response.body).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: 'patients',
                        id: expect.any(String),
                    }),
                }),
            );
            expect(mockService.create).toHaveBeenCalledWith(createDTO);
        });

        it('should return 400 for invalid DTO (ValidationPipe test)', async () => {
            // Missing required fields
            await request(server)
                .post('/patients')
                .send({}) // Empty object
                .expect(400);

            expect(mockService.create).not.toHaveBeenCalled();
        });

        it('should strip unknown properties (whitelist)', async () => {
            const dtoWithExtra = {
                first_name_thai: 'สมชาย',
                last_name_thai: 'รักษาดี',
                unknownField: 'should be removed',
            };

            await request(server).post('/patients').send(dtoWithExtra).expect(201);

            expect(mockService.create).toHaveBeenCalledWith(
                expect.not.objectContaining({ unknownField: 'should be removed' }),
            );
        });
    });

    describe('GET /patients/:id', () => {
        it('should return patient by ID', async () => {
            const response = await request(server).get(`/patients/${MOCK_PATIENT_ID}`).expect(200);

            expect(response.body.data.id).toBe(MOCK_PATIENT_ID);
            expect(mockService.findOne).toHaveBeenCalledWith(MOCK_PATIENT_ID);
        });

        it('should return 404 when patient not found', async () => {
            mockService.findOne.mockRejectedValueOnce(new NotFoundException());

            await request(server).get('/patients/invalid-id').expect(404);
        });
    });
});
```

## Part 10: Best Practices

### Do's ✅

- ✅ Write descriptive test names explaining expected behavior
- ✅ Test both success and error cases
- ✅ Use mock factories to keep tests DRY
- ✅ Clear mocks in `afterEach()` to prevent cross-test pollution
- ✅ Mock external dependencies completely
- ✅ Verify service/repository methods were called correctly
- ✅ Test validation in E2E tests (ValidationPipe)
- ✅ Test response formatting in E2E tests (TransformInterceptor)
- ✅ Test error handling (AllExceptionsFilter)
- ✅ Organize tests with `describe` blocks

### Don'ts ❌

- ❌ Don't test the mocked dependencies (you're testing your mocks, not your code)
- ❌ Don't use `console.log` in tests
- ❌ Don't rely on test execution order (tests should be independent)
- ❌ Don't forget to clear mocks between tests
- ❌ Don't skip error cases (always test error handling)
- ❌ Don't test multiple things in one test (use AAA pattern)
- ❌ Don't use `any` type without explicit reason
- ❌ Don't skip the E2E tests (unit tests alone can't prove integration works)

## Part 11: Troubleshooting

### Issue: ValidationPipe not working in E2E tests

**Symptom**: Invalid DTOs return 201 instead of 400

**Solution**: Ensure ValidationPipe is applied before init():

```typescript
app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }),
);
await app.init();
```

### Issue: Module aliases not resolving (@lib/common)

**Symptom**: `Cannot find module '@lib/common'` when running tests

**Solution**: Verify `moduleNameMapper` in Jest config:

```javascript
moduleNameMapper: {
    '^@lib/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
}
```

### Issue: Mocks still have data from previous test

**Symptom**: Test fails with "Expected 1 call, received 2 calls"

**Solution**: Clear mocks in `afterEach()` or `beforeEach()`:

```typescript
afterEach(() => {
    jest.clearAllMocks();
});
```

### Issue: Test timeout

**Symptom**: `Timeout - Async callback was not invoked within 5000ms`

**Solution**: Ensure async functions use `mockResolvedValue` (not `mockReturnValue`):

```typescript
// ❌ BAD (for async function)
mockService.create.mockReturnValue(mockEntity);

// ✅ GOOD
mockService.create.mockResolvedValue(mockEntity);
```

## Part 12: Coverage Requirements

### Minimum Thresholds

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Excluded from Coverage

```javascript
collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',           // Bootstrap file
    '!src/**/*.module.ts',    // Module definitions
    '!src/**/*.dto.ts',       // Data transfer objects
    '!src/**/*.entity.ts',    // Database entities
    '!src/**/*.enum.ts',      // Enums
    '!src/**/*.interface.ts', // Type definitions
],
```

### Generate Coverage Report

```bash
npm run test:cov
open coverage/lcov-report/index.html  # View in browser
```

## Part 13: Quick Reference

### Run Tests

```bash
npm run test                      # All tests
npm run test:watch               # Watch mode
npm run test:cov                 # With coverage
npm run test:[SERVICE_NAME]       # Unit tests for service
npm run test:[SERVICE_NAME]:e2e   # E2E tests for service
```

### Supertest Common Patterns

```typescript
// GET request
await request(server).get('/patients').expect(200);

// POST with body
await request(server).post('/patients').send(dto).expect(201);

// PUT request
await request(server).put('/patients/123').send(updateDTO).expect(200);

// DELETE request
await request(server).delete('/patients/123').expect(204);

// With query parameters
await request(server).get('/patients').query({ page: 1, limit: 10 }).expect(200);

// Check response body
const response = await request(server).get('/patients/123').expect(200);
expect(response.body.data.id).toBe('123');
```

### Mock Patterns

```typescript
// Success response
mockService.findOne.mockResolvedValue(mockEntity);

// Error response
mockService.findOne.mockRejectedValue(new NotFoundException());

// Multiple calls with different responses
mockService.findOne
    .mockResolvedValueOnce({ id: '1' })
    .mockResolvedValueOnce({ id: '2' })
    .mockResolvedValueOnce({ id: '3' });

// Custom logic
mockService.findOne.mockImplementation(async (id: string) => {
    if (id === 'valid') return { id, name: 'Test' };
    throw new NotFoundException();
});
```

## Summary Checklist

Before submitting tests:

- [ ] Unit tests cover all controller methods
- [ ] Unit tests cover success and error cases
- [ ] Service is mocked (not called directly)
- [ ] Mock factory exists in `test/mocks/`
- [ ] E2E tests cover HTTP request/response pipeline
- [ ] ValidationPipe is tested (400 for invalid DTOs)
- [ ] TransformInterceptor is tested (JSON:API response format)
- [ ] AllExceptionsFilter is tested (error responses)
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Descriptive test names explain expected behavior
- [ ] Coverage meets thresholds (>80%)
- [ ] Mocks cleared in `afterEach()`
- [ ] No `any` types without explicit reason
- [ ] No `console.log` in tests
- [ ] All tests pass locally

## Full Reference Guide

For comprehensive examples and detailed patterns, see:

- `/guides/testing-unit-e2e.md` - Complete testing guide with full examples
- `nest.js` monorepo examples in `apps/emr-bc/test/`
- Repository test examples for reference patterns
