import type { JsonValue, ValidationResult } from "../domain/commercial.types";

export type SqliteRunResult = { changes?: number; lastID?: number };
export type SqliteDatabase = {
  run(sql: string, ...params: unknown[]): Promise<SqliteRunResult>;
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>[]>(sql: string, ...params: unknown[]): Promise<T>;
  exec(sql: string): Promise<void>;
};

export class PersistenceValidationError extends Error {
  readonly validation: ValidationResult;
  constructor(validation: ValidationResult) {
    super(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "PersistenceValidationError";
    this.validation = validation;
  }
}

export function requireValid(validation: ValidationResult): void {
  if (!validation.valid) throw new PersistenceValidationError(validation);
}

export function stringifyJson(value: JsonValue | readonly unknown[]): string {
  return JSON.stringify(value);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function withSqliteTransaction<T>(db: SqliteDatabase, operation: () => Promise<T>): Promise<T> {
  await db.exec("BEGIN IMMEDIATE");
  try {
    const result = await operation();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function requireEstimate(db: SqliteDatabase, estimateId: string): Promise<void> {
  const row = await db.get<{ id: string }>("SELECT id FROM estimates WHERE id = ? LIMIT 1", estimateId);
  if (!row) throw new Error("Estimate ownership check failed.");
}
