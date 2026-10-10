/**
 * Bun adapter for Pi Durable's portable SQLite storage core.
 *
 * Pi Durable ships a `node:sqlite` adapter; this one does the same on `bun:sqlite`:
 * every operation runs through one serial queue, and a transaction holds the queue
 * until it commits or rolls back (the contract in `SqliteDatabase`).
 */
import { Database, type Statement } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SqliteDatabase, SqliteExecutor, SqliteValue } from "@earendil-works/pi-durable/storage/sqlite";
import { SqliteStorage } from "@earendil-works/pi-durable/storage/sqlite";

type Params = SqliteValue[];

class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(op: () => T | Promise<T>): Promise<T> {
    const next = this.tail.then(op, op);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

abstract class BunExecutor implements SqliteExecutor {
  constructor(
    protected readonly db: Database,
    protected readonly statements: Map<string, Statement>,
  ) {}

  protected abstract op<T>(fn: () => T): Promise<T>;

  private stmt(sql: string): Statement {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  exec(sql: string): Promise<void> {
    return this.op(() => {
      this.db.exec(sql);
    });
  }
  run(sql: string, ...params: Params): Promise<void> {
    return this.op(() => {
      this.stmt(sql).run(...(params as never[]));
    });
  }
  get<T extends object>(sql: string, ...params: Params): Promise<T | undefined> {
    return this.op(() => (this.stmt(sql).get(...(params as never[])) as T | null) ?? undefined);
  }
  all<T extends object>(sql: string, ...params: Params): Promise<T[]> {
    return this.op(() => this.stmt(sql).all(...(params as never[])) as T[]);
  }
}

class BunTransaction extends BunExecutor {
  constructor(
    db: Database,
    statements: Map<string, Statement>,
    private readonly scope: { active: boolean },
  ) {
    super(db, statements);
  }
  protected async op<T>(fn: () => T): Promise<T> {
    if (!this.scope.active) throw new Error("SQLite transaction handle is no longer active");
    return fn();
  }
}

export class BunSqliteDatabase extends BunExecutor implements SqliteDatabase {
  private readonly queue = new SerialQueue();
  private closed = false;

  constructor(db: Database) {
    super(db, new Map());
  }

  protected op<T>(fn: () => T): Promise<T> {
    return this.queue.run(fn);
  }

  transaction<T>(callback: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      const scope = { active: true };
      try {
        const result = await callback(new BunTransaction(this.db, this.statements, scope));
        scope.active = false;
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        scope.active = false;
        try {
          this.db.exec("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "SQLite transaction failed and rollback failed");
        }
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.queue.run(() => {
      if (this.closed) return;
      this.closed = true;
      for (const s of this.statements.values()) s.finalize();
      this.statements.clear();
      try {
        this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } finally {
        this.db.close();
      }
    });
  }
}

export async function openBunSqliteStorage(path: string): Promise<SqliteStorage> {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: false });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  return SqliteStorage.open(new BunSqliteDatabase(db));
}
