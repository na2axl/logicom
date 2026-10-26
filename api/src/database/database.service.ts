import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import sql from 'mssql';
import { ConfigService } from '@nestjs/config';
import type { Config } from '../config/index.js';

/** Something a request can run on: the pool, or an open transaction. */
export type SqlExecutor = sql.ConnectionPool | sql.Transaction;

/**
 * Owns the mssql connection pool. Every query goes through parameterized
 * `sql.Request` objects; no SQL string is ever built from user input.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: sql.ConnectionPool;

  constructor(config: ConfigService<Config, true>) {
    const db = config.get('db', { infer: true });
    this.pool = new sql.ConnectionPool({
      server: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.name,
      options: {
        // The SQL Server container uses a self-signed certificate.
        trustServerCertificate: true,
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.connect();
    this.logger.log('Connected to SQL Server');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.close();
  }

  request(executor: SqlExecutor = this.pool): sql.Request {
    return new sql.Request(executor as sql.ConnectionPool);
  }

  /**
   * Runs `work` inside a transaction: committed if it resolves, rolled back if
   * it throws (business errors included), so a refused action leaves no trace.
   */
  async transaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await this.rollbackQuietly(tx);
      throw error;
    }
  }

  private async rollbackQuietly(tx: sql.Transaction): Promise<void> {
    try {
      await tx.rollback();
    } catch (rollbackError) {
      // SQL Server may already have aborted the transaction (e.g. deadlock victim).
      this.logger.warn(`Rollback failed: ${String(rollbackError)}`);
    }
  }
}
