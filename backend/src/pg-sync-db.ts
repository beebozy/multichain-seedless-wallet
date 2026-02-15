import { spawnSync } from 'node:child_process';

type Primitive = string | number | boolean | null | undefined | Date;

class PgSyncStatement {
  constructor(
    private readonly db: PgSyncDatabase,
    private readonly sql: string,
  ) {}

  run(...params: Primitive[]) {
    this.db.execSql(this.sql, params, 'run');
    return { changes: 0 };
  }

  get<T = unknown>(...params: Primitive[]): T | undefined {
    return this.db.execSql<T>(this.sql, params, 'get') as T | undefined;
  }

  all<T = unknown>(...params: Primitive[]): T[] {
    return this.db.execSql<T>(this.sql, params, 'all') as T[];
  }
}

export class PgSyncDatabase {
  constructor(private readonly connectionString?: string) {}

  pragma(_value: string) {
    // SQLite-only pragma noop for compatibility.
  }

  prepare(sql: string) {
    return new PgSyncStatement(this, sql);
  }

  exec(sql: string) {
    this.execSql(sql, [], 'run');
  }

  close() {
    // no-op: each query uses a short-lived psql process.
  }

  execSql<T = unknown>(sql: string, params: Primitive[], mode: 'run' | 'get' | 'all'): T | T[] | undefined {
    const inlined = this.inlineParams(sql, params);
    const trimmed = inlined.trim().replace(/;+\s*$/, '');

    const query =
      mode === 'run'
        ? trimmed
        : mode === 'get'
          ? `SELECT row_to_json(t)::text AS row_json FROM (${trimmed}) t LIMIT 1`
          : `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)::text AS rows_json FROM (${trimmed}) t`;

    const args = ['-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q', '-c', query];
    if (this.connectionString) {
      args.unshift(this.connectionString);
    }

    const result = spawnSync('psql', args, {
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const err = (result.stderr || result.stdout || 'Unknown PostgreSQL error').trim();
      throw new Error(err);
    }

    if (mode === 'run') {
      return undefined;
    }

    const output = (result.stdout ?? '').trim();
    if (!output) {
      return mode === 'all' ? ([] as T[]) : undefined;
    }

    const lastLine = output.split('\n').filter(Boolean).pop() ?? '';
    if (!lastLine) {
      return mode === 'all' ? ([] as T[]) : undefined;
    }

    if (mode === 'get') {
      return JSON.parse(lastLine) as T;
    }

    return JSON.parse(lastLine) as T[];
  }

  private inlineParams(sql: string, params: Primitive[]) {
    let index = 0;
    return sql.replace(/\?/g, () => {
      if (index >= params.length) {
        throw new Error('Missing SQL parameter value');
      }
      const value = params[index++];
      return this.toSqlLiteral(value);
    });
  }

  private toSqlLiteral(value: Primitive): string {
    if (value === undefined || value === null) {
      return 'NULL';
    }
    if (value instanceof Date) {
      return `'${this.escape(value.toISOString())}'`;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error('Invalid numeric SQL parameter');
      }
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return `'${this.escape(value)}'`;
  }

  private escape(value: string) {
    return value.replace(/'/g, "''");
  }
}
