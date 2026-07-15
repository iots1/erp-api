import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

/**
 * Global configuration module. Loads `.env` from the repo root and validates it
 * against a single schema shared by every ERP microservice.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        // --- General ---
        NODE_ENV: Joi.string()
          .valid('local', 'dev', 'staging', 'prod')
          .default('dev'),
        LOG_LEVEL: Joi.string()
          .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
          .default('info'),

        // --- Security ---
        SECRET_KEY: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        CORS_ORIGIN: Joi.string().default('*'),
        RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
        RATE_LIMIT_MAX: Joi.number().default(10000),

        // --- Inter-service transport (rmq default, tcp fallback) ---
        TRANSPORT: Joi.string().valid('rmq', 'tcp').default('rmq'),
        RABBITMQ_HOST: Joi.string().default('localhost'),
        RABBITMQ_PORT: Joi.number().default(5672),
        RABBITMQ_USER: Joi.string().default('guest'),
        RABBITMQ_PASS: Joi.string().allow('').default('guest'),
        RABBITMQ_VHOST: Joi.string().default('/'),

        // --- Redis (stateful auth sessions + CSRF) ---
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_USERNAME: Joi.string().allow('').default('default'),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
        REDIS_DB: Joi.number().default(0),
        AUTH_SESSION_TTL: Joi.number().default(7 * 24 * 60 * 60),

        // --- Databases (one per Bounded Context) ---
        // Auth DB (credentials/refresh_tokens/login_histories/blocked_users/security_logs only — no user profile data)
        AUTH_DB_HOST: Joi.string().default('localhost'),
        AUTH_DB_PORT: Joi.number().default(5432),
        AUTH_DB_USERNAME: Joi.string().default('postgres'),
        AUTH_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        AUTH_DB_NAME: Joi.string().default('erp_auth'),
        AUTH_DB_SYNCHRONIZE: Joi.boolean().default(false),
        AUTH_DB_LOGGING: Joi.boolean().default(false),

        // IAM DB
        IAM_DB_HOST: Joi.string().default('localhost'),
        IAM_DB_PORT: Joi.number().default(5432),
        IAM_DB_USERNAME: Joi.string().default('postgres'),
        IAM_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        IAM_DB_NAME: Joi.string().default('erp_iam'),
        IAM_DB_SYNCHRONIZE: Joi.boolean().default(false),
        IAM_DB_LOGGING: Joi.boolean().default(false),

        // Inventory DB
        INVENTORY_DB_HOST: Joi.string().default('localhost'),
        INVENTORY_DB_PORT: Joi.number().default(5432),
        INVENTORY_DB_USERNAME: Joi.string().default('postgres'),
        INVENTORY_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        INVENTORY_DB_NAME: Joi.string().default('erp_inventory'),
        INVENTORY_DB_SYNCHRONIZE: Joi.boolean().default(false),
        INVENTORY_DB_LOGGING: Joi.boolean().default(false),

        // Supplier DB
        SUPPLIER_DB_HOST: Joi.string().default('localhost'),
        SUPPLIER_DB_PORT: Joi.number().default(5432),
        SUPPLIER_DB_USERNAME: Joi.string().default('postgres'),
        SUPPLIER_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        SUPPLIER_DB_NAME: Joi.string().default('erp_supplier'),
        SUPPLIER_DB_SYNCHRONIZE: Joi.boolean().default(false),
        SUPPLIER_DB_LOGGING: Joi.boolean().default(false),

        // Sales DB
        SALES_DB_HOST: Joi.string().default('localhost'),
        SALES_DB_PORT: Joi.number().default(5432),
        SALES_DB_USERNAME: Joi.string().default('postgres'),
        SALES_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        SALES_DB_NAME: Joi.string().default('erp_sales'),
        SALES_DB_SYNCHRONIZE: Joi.boolean().default(false),
        SALES_DB_LOGGING: Joi.boolean().default(false),

        // Finance DB
        FINANCE_DB_HOST: Joi.string().default('localhost'),
        FINANCE_DB_PORT: Joi.number().default(5432),
        FINANCE_DB_USERNAME: Joi.string().default('postgres'),
        FINANCE_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        FINANCE_DB_NAME: Joi.string().default('erp_finance'),
        FINANCE_DB_SYNCHRONIZE: Joi.boolean().default(false),
        FINANCE_DB_LOGGING: Joi.boolean().default(false),

        // Report DB
        REPORT_DB_HOST: Joi.string().default('localhost'),
        REPORT_DB_PORT: Joi.number().default(5432),
        REPORT_DB_USERNAME: Joi.string().default('postgres'),
        REPORT_DB_PASSWORD: Joi.string().allow('').default('postgres'),
        REPORT_DB_NAME: Joi.string().default('erp_report'),
        REPORT_DB_SYNCHRONIZE: Joi.boolean().default(false),
        REPORT_DB_LOGGING: Joi.boolean().default(false),

        // --- Auth service (owns credentials/session security tables only, sessions in Redis) ---
        AUTH_PREFIX_NAME: Joi.string().default('auth'),
        AUTH_PREFIX_VERSION: Joi.string().default('v1'),
        AUTH_MODULE_HTTP_PORT: Joi.number().default(3001),
        AUTH_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        AUTH_MODULE_MICROSERVICE_PORT: Joi.number().default(4001),

        // --- IAM service ---
        IAM_PREFIX_NAME: Joi.string().default('iam'),
        IAM_PREFIX_VERSION: Joi.string().default('v1'),
        IAM_MODULE_HTTP_PORT: Joi.number().default(3002),
        IAM_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        IAM_MODULE_MICROSERVICE_PORT: Joi.number().default(4002),

        // --- Inventory BC ---
        INVENTORY_PREFIX_NAME: Joi.string().default('inventory'),
        INVENTORY_PREFIX_VERSION: Joi.string().default('v1'),
        INVENTORY_BC_MODULE_HTTP_PORT: Joi.number().default(3003),
        INVENTORY_BC_MODULE_MICROSERVICE_HOST:
          Joi.string().default('localhost'),
        INVENTORY_BC_MODULE_MICROSERVICE_PORT: Joi.number().default(4003),

        // --- Supplier BC ---
        SUPPLIER_PREFIX_NAME: Joi.string().default('supplier'),
        SUPPLIER_PREFIX_VERSION: Joi.string().default('v1'),
        SUPPLIER_BC_MODULE_HTTP_PORT: Joi.number().default(3004),
        SUPPLIER_BC_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        SUPPLIER_BC_MODULE_MICROSERVICE_PORT: Joi.number().default(4004),

        // --- Sales BC ---
        SALES_PREFIX_NAME: Joi.string().default('sales'),
        SALES_PREFIX_VERSION: Joi.string().default('v1'),
        SALES_BC_MODULE_HTTP_PORT: Joi.number().default(3005),
        SALES_BC_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        SALES_BC_MODULE_MICROSERVICE_PORT: Joi.number().default(4005),

        // --- Finance BC ---
        FINANCE_PREFIX_NAME: Joi.string().default('finance'),
        FINANCE_PREFIX_VERSION: Joi.string().default('v1'),
        FINANCE_BC_MODULE_HTTP_PORT: Joi.number().default(3006),
        FINANCE_BC_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        FINANCE_BC_MODULE_MICROSERVICE_PORT: Joi.number().default(4006),

        // --- Report BC ---
        REPORT_PREFIX_NAME: Joi.string().default('report'),
        REPORT_PREFIX_VERSION: Joi.string().default('v1'),
        REPORT_BC_MODULE_HTTP_PORT: Joi.number().default(3007),
        REPORT_BC_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        REPORT_BC_MODULE_MICROSERVICE_PORT: Joi.number().default(4007),

        // --- Storage service (stateless — image upload only, not a business BC) ---
        STORAGE_PREFIX_NAME: Joi.string().default('storage'),
        STORAGE_PREFIX_VERSION: Joi.string().default('v1'),
        STORAGE_MODULE_HTTP_PORT: Joi.number().default(3008),
        STORAGE_MODULE_MICROSERVICE_HOST: Joi.string().default('localhost'),
        STORAGE_MODULE_MICROSERVICE_PORT: Joi.number().default(4008),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
