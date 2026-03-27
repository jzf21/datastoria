import { getServerSessionRepositoryConfig } from "@/lib/ai/session/server-session-repository-factory";
import path from "node:path";
import type { AlertRepository } from "./alert-repository";
import { AlertRepositoryMySql } from "./impl/alert-repository-mysql";
import { AlertRepositoryPg } from "./impl/alert-repository-pg";
import { AlertRepositorySqlite } from "./impl/alert-repository-sqlite";

const DEFAULT_EVENT_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_SQLITE_FILENAME = "alerts.sqlite";

let mySqlAlertRepository: AlertRepositoryMySql | null = null;
let pgAlertRepository: AlertRepositoryPg | null = null;
let sqliteAlertRepository: AlertRepositorySqlite | null = null;
let alertCleanupTimerStarted = false;

function getDefaultSqlitePath(): string {
  return path.join(process.cwd(), ".datastoria", DEFAULT_SQLITE_FILENAME);
}

function getEventRetentionDays(): number {
  const parsed = Number.parseInt(process.env.ALERT_EVENT_RETENTION_DAYS ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_EVENT_RETENTION_DAYS;
  }
  return parsed;
}

function startAlertCleanupTimer(repository: AlertRepository) {
  if (alertCleanupTimerStarted) {
    return;
  }

  alertCleanupTimerStarted = true;
  const runCleanup = async () => {
    const retentionDays = getEventRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await repository.cleanupOldEvents(cutoff);
  };

  void runCleanup();
  const timer = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);

  timer.unref?.();
}

export function getAlertRepository(): AlertRepository {
  const config = getServerSessionRepositoryConfig();

  if (config?.dialect === "mysql") {
    if (!mySqlAlertRepository) {
      mySqlAlertRepository = new AlertRepositoryMySql(config.url);
    }
    startAlertCleanupTimer(mySqlAlertRepository);
    return mySqlAlertRepository;
  }

  if (config?.dialect === "postgres") {
    if (!pgAlertRepository) {
      pgAlertRepository = new AlertRepositoryPg(config.url);
    }
    startAlertCleanupTimer(pgAlertRepository);
    return pgAlertRepository;
  }

  // Use configured SQLite path, or fall back to a local default so alerts work out of the box
  const sqlitePath = config?.url ?? getDefaultSqlitePath();
  if (!sqliteAlertRepository) {
    sqliteAlertRepository = new AlertRepositorySqlite(sqlitePath);
  }
  startAlertCleanupTimer(sqliteAlertRepository);
  return sqliteAlertRepository;
}
