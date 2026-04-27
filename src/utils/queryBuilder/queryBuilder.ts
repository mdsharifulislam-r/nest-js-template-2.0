import { SelectQueryBuilder, ObjectLiteral, Repository } from 'typeorm';

/**
 * Fluent TypeORM query builder wrapper.
 * Supports pagination, search, filter, sort, field selection, and relations.
 *
 * @example
 * const qb = new TypeOrmQueryBuilder(repo, query, 'user')
 *   .search(['name', 'email'])
 *   .filter()
 *   .sort()
 *   .paginate();
 *
 * const [data, pagination] = await Promise.all([qb.getMany(), qb.getPaginationInfo()]);
 */
class TypeOrmQueryBuilder<T extends ObjectLiteral> {
  public qb: SelectQueryBuilder<T>;
  private readonly query: Record<string, any>;
  private readonly alias: string;

  constructor(repo: Repository<T>, query: Record<string, any>, alias: string) {
    this.qb = repo.createQueryBuilder(alias);
    this.query = query;
    this.alias = alias;
  }

  /** Full-text search across specified fields */
  search(fields: string[]) {
    const term = this.query.searchTerm?.trim();
    if (term && fields.length) {
      const conditions = fields.map((f, i) => `${this.alias}.${f} LIKE :search${i}`);
      const params = fields.reduce((acc, _f, i) => {
        acc[`search${i}`] = `%${term}%`;
        return acc;
      }, {} as Record<string, any>);
      this.qb.andWhere(`(${conditions.join(' OR ')})`, params);
    }
    return this;
  }

  /**
   * Apply column equality filters from query params.
   * @param excludeFields additional query param names to skip
   */
  filter(excludeFields: string[] = []) {
    const skip = new Set([
      'searchTerm', 'sort', 'page', 'limit', 'fields', ...excludeFields,
    ]);
    for (const [key, value] of Object.entries(this.query)) {
      if (!skip.has(key) && value !== undefined) {
        this.qb.andWhere(`${this.alias}.${key} = :${key}`, { [key]: value });
      }
    }
    return this;
  }

  /**
   * Sort results. Prefix field with '-' for DESC order.
   * @example sort=-createdAt  (newest first)
   */
  sort() {
    const raw = this.query.sort || '-createdAt';
    const desc = raw.startsWith('-');
    const field = raw.replace(/^-/, '');
    this.qb.orderBy(`${this.alias}.${field}`, desc ? 'DESC' : 'ASC');
    return this;
  }

  /** Paginate results */
  paginate() {
    const limit = Math.min(Number(this.query.limit) || 10, 100); // cap at 100
    const page = Math.max(Number(this.query.page) || 1, 1);
    this.qb.skip((page - 1) * limit).take(limit);
    return this;
  }

  /** Select only specified comma-separated fields */
  fields() {
    const fields: string[] = this.query.fields?.split(',') ?? [];
    if (fields.length) {
      this.qb.select(fields.map((f) => `${this.alias}.${f.trim()}`));
    }
    return this;
  }

  /** Eager-load relations */
  populate(relations: string[]) {
    for (const rel of relations) {
      this.qb.leftJoinAndSelect(`${this.alias}.${rel}`, rel);
    }
    return this;
  }

  async getMany(): Promise<T[]> {
    return this.qb.getMany();
  }

  async getOne(): Promise<T | null> {
    return this.qb.getOne();
  }

  /**
   * Returns pagination metadata.
   * Uses a cloned query builder so skip/take don't affect the count.
   */
  async getPaginationInfo() {
    const limit = Math.min(Number(this.query.limit) || 10, 100);
    const page = Math.max(Number(this.query.page) || 1, 1);
    const total = await this.qb.clone().skip(0).take(undefined).getCount();
    return { total, limit, page, totalPage: Math.ceil(total / limit) };
  }
}

export default TypeOrmQueryBuilder;
