# Testing Skill

## Metadata

- **Name**: testing
- **Version**: 1.0.0
- **Category**: Testing & Quality Assurance
- **Status**: Stable

## Description

Comprehensive testing skill for implementing unit tests and end-to-end (E2E) tests in a NestJS microservice following MediTech standards. Guides through creating Jest configurations, controller unit tests, service unit tests, E2E tests with Supertest, mock factories, and comprehensive test coverage strategies.

## When to Use This Skill

- ✅ Writing unit tests for controllers and services
- ✅ Creating E2E tests for HTTP endpoints
- ✅ Setting up Jest configuration for unit and E2E tests
- ✅ Creating mock factories for services and DTOs
- ✅ Testing DTO validation with ValidationPipe
- ✅ Testing global interceptors and filters
- ✅ Testing error handling and exception scenarios
- ✅ Implementing test coverage strategies
- ✅ Following MediTech testing patterns and standards

## When NOT to Use

- ❌ Modifying existing test files without planning (use the guide for patterns)
- ❌ Testing external dependencies directly (mock them instead)
- ❌ Skipping unit tests and jumping to E2E only
- ❌ Creating tests without understanding the code under test

## Quick Reference: Testing Structure

| Component        | Location                 | Purpose                                       |
| ---------------- | ------------------------ | --------------------------------------------- |
| Jest Unit Config | `jest.config.js`         | Configure unit test runner and coverage       |
| Jest E2E Config  | `test/jest-e2e.json`     | Configure E2E test runner and coverage        |
| Unit Tests       | `test/unit/*.spec.ts`    | Test controllers and services in isolation    |
| E2E Tests        | `test/e2e/*.e2e-spec.ts` | Test full HTTP request/response pipeline      |
| Mock Factories   | `test/mocks/mock-*.ts`   | Reusable mock data and service definitions    |
| npm Scripts      | `package.json`           | Commands to run tests (watch, coverage, etc.) |

## Testing Workflow

| Step | Task                         | Output                                      |
| ---- | ---------------------------- | ------------------------------------------- |
| 1    | Set up Jest configurations   | `jest.config.js` + `test/jest-e2e.json`     |
| 2    | Create mock factories        | `test/mocks/mock-[entity].ts`               |
| 3    | Write unit tests             | `test/unit/[controller].controller.spec.ts` |
| 4    | Write unit tests for service | `test/unit/[service].service.spec.ts`       |
| 5    | Write E2E tests              | `test/e2e/[controller].e2e-spec.ts`         |
| 6    | Add npm scripts              | Update `package.json` with test commands    |
| 7    | Verify coverage              | Run tests and check coverage metrics        |

## Key Testing Concepts

### AAA Pattern

All tests follow the Arrange-Act-Assert pattern:

```typescript
it('should do something', async () => {
    // ARRANGE - Set up test data and mocks
    const input = { name: 'Test' };
    mockService.method.mockResolvedValue({ id: '123', ...input });

    // ACT - Execute the code under test
    const result = await controller.method(input);

    // ASSERT - Verify the results
    expect(result).toEqual({ id: '123', name: 'Test' });
    expect(mockService.method).toHaveBeenCalledWith(input);
});
```

### Mock Factory Pattern

Centralize mock creation to keep tests DRY:

```typescript
// test/mocks/mock-patients.ts
export function createMockPatientsService() {
    return {
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };
}

export function createMockPatientEntity(overrides = {}) {
    return { id: 'uuid-123', hn: 'HN001', ...overrides };
}
```

### Test Isolation

- Mock the entire service layer for unit tests
- Use `jest.clearAllMocks()` in `afterEach()`
- Test only what the code under test does
- Don't test the mocked dependencies

### Global Pipes and Interceptors in E2E

E2E tests apply global pipes and interceptors to test the full pipeline:

```typescript
app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }),
);

app.useGlobalInterceptors(new TransformInterceptor(reflector));
app.useGlobalFilters(new AllExceptionsFilter());
```

## Dependencies

This skill assumes you have:

- Jest and ts-jest installed
- Supertest installed (for E2E tests)
- NestJS version 11+
- @nestjs/testing module available
- Reflector from @nestjs/core (for interceptors)

## File Locations

```bash
apps/[SERVICE_NAME]/
├── jest.config.js
├── src/
│   └── modules/
│       └── [MODULE]/
│           ├── controllers/[controller].controller.ts
│           ├── services/[service].service.ts
│           └── dto/
│               ├── create-[entity].dto.ts
│               └── update-[entity].dto.ts
└── test/
    ├── jest-e2e.json
    ├── mocks/
    │   └── mock-[entity].ts
    ├── unit/
    │   ├── [controller].controller.spec.ts
    │   └── [service].service.spec.ts
    └── e2e/
        └── [controller].e2e-spec.ts
```

## Related Documentation

- [Testing Guide](/guides/testing-unit-e2e.md) - Comprehensive testing patterns and examples
- [API Response & Error Handling](/guides/api-response-error-handling.md) - Understanding exception patterns
- [Entity & DTO Principle](/guides/entity-dto-principle.md) - DTO validation standards
- [Base Operations Architecture](/guides/base-operations-architecture.md) - Service patterns
- [Essential Best Practices - REST API](/guides/essential-best-practices-rest-api.md) - API design

## Example Usage

When implementing tests for a new controller:

1. **Read** the comprehensive guide in `guide.md`
2. **Review** existing test examples in the repository
3. **Create** Jest config files (copy from template)
4. **Create** mock factories for test data
5. **Write** unit tests following AAA pattern
6. **Write** E2E tests testing full HTTP pipeline
7. **Verify** coverage meets thresholds (>80%)
8. **Run** tests locally before committing

## Testing Standards

### Coverage Requirements

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Test Organization

Group related tests using `describe` blocks. Use descriptive test names that explain what is being tested:

```typescript
describe('PatientsController', () => {
    describe('createPatient', () => {
        it('should create patient with valid data', () => {});
        it('should return 400 for invalid data', () => {});
        it('should call service with correct arguments', () => {});
    });
});
```

### Naming Conventions

- **Test files**: `[name].spec.ts` (unit), `[name].e2e-spec.ts` (e2e)
- **Mock files**: `mock-[entity].ts`
- **Describe blocks**: Use PascalCase for class names
- **Test names**: Use "should..." describing the expected behavior

## Common Patterns

### Unit Test: Controller

```typescript
describe('PatientsController', () => {
    let controller: PatientsController;
    const mockService = createMockPatientsService();

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            controllers: [PatientsController],
            providers: [{ provide: PatientsService, useValue: mockService }],
        }).compile();

        controller = module.get(PatientsController);
    });

    afterEach(() => { jest.clearAllMocks(); });

    it('should call service method with correct arguments', async () => {
        const dto = createMockPatientDTO();
        mockService.create.mockResolvedValue(createMockPatientEntity());

        await controller.create(dto as CreatePatientDTO);

        expect(mockService.create).toHaveBeenCalledWith(dto);
    });
});
```

### E2E Test: HTTP Request

```typescript
describe('POST /patients', () => {
    it('should create patient and return 201', async () => {
        const dto = createMockPatientDTO();

        const response = await request(app.getHttpServer()).post('/patients').send(dto).expect(201);

        expect(response.body.data.id).toBeDefined();
        expect(mockService.create).toHaveBeenCalled();
    });

    it('should return 400 for invalid data', async () => {
        await request(app.getHttpServer())
            .post('/patients')
            .send({}) // Missing required fields
            .expect(400);
    });
});
```

## Troubleshooting

**Issue**: Pipes or interceptors not working in E2E tests

**Solution**: Ensure `createTestApp` registers global utilities:

```typescript
app.useGlobalPipes(new ValidationPipe(...));
app.useGlobalInterceptors(new TransformInterceptor(reflector));
app.useGlobalFilters(new AllExceptionsFilter());
await app.init();
```

**Issue**: Mocks not clearing between tests

**Solution**: Call `jest.clearAllMocks()` in `afterEach()` or `beforeEach()`:

```typescript
afterEach(() => {
    jest.clearAllMocks();
});
```

**Issue**: Module aliases not resolving (e.g., @lib/common)

**Solution**: Verify `moduleNameMapper` in Jest config points to correct paths

## Support & Feedback

For issues or improvements to this skill:

1. Check the comprehensive guide in `guide.md`
2. Review existing test examples in the codebase
3. Consult testing-unit-e2e.md for detailed patterns
4. Refer to Jest and Supertest documentation
5. Ask the team for clarification on patterns
