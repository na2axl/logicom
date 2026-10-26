import sql from 'mssql';

/**
 * Binds a list of values as individual parameters (@prefix0, @prefix1, ...)
 * and returns the placeholder list to use in an `IN (...)` clause.
 */
export function bindList(
  request: sql.Request,
  prefix: string,
  values: readonly string[],
  type: sql.ISqlType = sql.NVarChar(20),
): string {
  return values
    .map((value, index) => {
      const name = `${prefix}${index}`;
      request.input(name, type, value);
      return `@${name}`;
    })
    .join(', ');
}

/** SQL Server `date` columns come back as UTC-midnight Date objects. */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `rowversion` comes back as an 8-byte Buffer; exposed to clients as hex. */
export function toVersion(value: Buffer): string {
  return value.toString('hex');
}
