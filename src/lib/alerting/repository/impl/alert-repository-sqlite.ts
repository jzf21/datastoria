import fs from "node:fs";
import path from "node:path";
import { knex, type Knex } from "knex";
import {
  readRepositorySchemaSql,
  splitSqlStatements,
} from "@/lib/ai/session/impl/server-session-repository-schema";
import { AbstractAlertRepository } from "./alert-repository-sql-shared";

function resolveSqliteLocation(location: string): string {
  if (location === ":memory:") {
    return location;
  }
  if (location.startsWith("file:")) {
    return new URL(location).pathname;
  }
  return location;
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class AlertRepositorySqlite extends AbstractAlertRepository {
  private sqliteKnex: Knex | null = null;
  private sqliteReadyPromise: Promise<void> | null = null;

  constructor(private readonly sqlitePath: string) {
    super({
      getDb: () => this.getSqliteKnex(),
      nowExpression: "STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')",
      supportsForUpdate: false,
      ensureReady: () => this.ensureSqliteReady(),
    });
  }

  private getSqliteKnex(): Knex {
    if (!this.sqliteKnex) {
      const resolvedPath = resolveSqliteLocation(this.sqlitePath);
      if (resolvedPath !== ":memory:") {
        ensureParentDir(resolvedPath);
      }
      this.sqliteKnex = knex({
        client: "better-sqlite3",
        connection: {
          filename: resolvedPath,
        },
        useNullAsDefault: true,
      });
    }
    return this.sqliteKnex;
  }

  private async ensureSqliteReady(): Promise<void> {
    if (!this.sqliteReadyPromise) {
      this.sqliteReadyPromise = (async () => {
        const db = this.getSqliteKnex();
        await db.raw("PRAGMA journal_mode = WAL");
        await db.raw("PRAGMA foreign_keys = OFF");
        await db.raw("PRAGMA busy_timeout = 5000");

        for (const statement of splitSqlStatements(readRepositorySchemaSql("sqlite.sql"))) {
          await db.raw(statement);
        }
      })();
    }

    await this.sqliteReadyPromise;
  }
}
