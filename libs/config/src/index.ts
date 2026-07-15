export * from './config.module';

// Re-export Nest's ConfigService so consumers import everything from '@lib/config'.
export { ConfigService } from '@nestjs/config';
