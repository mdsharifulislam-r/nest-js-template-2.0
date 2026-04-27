import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const client = createClient({
          url: `redis://${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`,
        });

        await client.connect();

        return {
          store: client,
          ttl: 60,
        };
      },
    }),
  ],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (config: ConfigService) => {
        const client = createClient({
          url: `redis://${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`,
        });

        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService, 'REDIS_CLIENT'],
})
export class RedisCacheModule {}