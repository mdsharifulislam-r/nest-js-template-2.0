import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { RedisClientType } from 'redis';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,

    @Inject('REDIS_CLIENT')
    private readonly redis: RedisClientType,
  ) {}

  // =========================
  // KEY BUILDER
  // =========================
  private buildKey(key: string, query?: Record<string, any>) {
    if (!query) return `${key}:1`;

    const sorted = Object.keys(query)
      .sort()
      .reduce((acc, k) => {
        acc[k] = query[k];
        return acc;
      }, {} as Record<string, any>);

    return `${key}:${new URLSearchParams(sorted).toString()}`;
  }

  // =========================
  // GET
  // =========================
  async get<T>(key: string, query?: Record<string, any>) {
    const fullKey = this.buildKey(key, query);

    const data = await this.cache.get<string>(fullKey);
    if (!data) return null;

    return JSON.parse(data);
  }

  // =========================
  // SET
  // =========================
  async set(key: string, value: any, ttl = 60, query?: Record<string, any>) {
    const fullKey = this.buildKey(key, query);

    await this.cache.set(fullKey, JSON.stringify(value), ttl * 1000);
  }

  // =========================
  // DELETE SINGLE
  // =========================
  async del(key: string, query?: Record<string, any>) {
    const fullKey = this.buildKey(key, query);
    await this.cache.del(fullKey);
  }

  // =========================
  // 🚀 PATTERN DELETE (FIX YOU NEED)
  // =========================
  async deleteByPattern(pattern: string) {
    const keys = await this.redis.keys(`${pattern}*`);

    if (!keys.length) return;

    await this.redis.del(keys);
  }

  // =========================
  // RESET ALL CACHE
  // =========================
  async reset() {
    await this.redis.flushAll();
  }
}