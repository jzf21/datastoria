import type { FormatName } from "@/lib/formatter";

/**
 * Infers the appropriate format for a field based on sample data.
 * 
 * @param fieldName - The name of the field to infer format for
 * @param sampleRows - Array of sample data rows to analyze
 * @returns The inferred format name, or undefined if no format can be inferred
 */
export function inferFieldFormat(
  fieldName: string,
  sampleRows: Record<string, unknown>[]
): FormatName | undefined {
  if (sampleRows.length === 0) return undefined;

  // Sample up to 10 rows to infer type
  const sampleSize = Math.min(10, sampleRows.length);
  const samples = sampleRows.slice(0, sampleSize).map((row) => row[fieldName]);

  // Check if all samples are null/undefined
  const allNull = samples.every((val) => val === null || val === undefined);
  if (allNull) return undefined;

  // Find first non-null sample
  const firstNonNull = samples.find((val) => val !== null && val !== undefined);
  if (firstNonNull === undefined) return undefined;

  // Check for complex types
  const isArray = Array.isArray(firstNonNull);
  const isObject = typeof firstNonNull === "object" && firstNonNull !== null && !isArray;
  const isMap = isObject && Object.keys(firstNonNull as Record<string, unknown>).length > 0;

  // Check for Map type first (separate from other complex types)
  if (isMap) {
    const allMaps = samples
      .filter((val) => val !== null && val !== undefined)
      .every((val) => typeof val === "object" && !Array.isArray(val) && val !== null);

    if (allMaps) {
      return "map";
    }
  }

  // Check for Array or other complex types
  if (isArray) {
    const allArrays = samples
      .filter((val) => val !== null && val !== undefined)
      .every((val) => Array.isArray(val));

    if (allArrays) {
      return "complexType";
    }
  }

  // Check for other objects (non-map, non-array)
  if (isObject && !isMap) {
    const allObjects = samples
      .filter((val) => val !== null && val !== undefined)
      .every((val) => typeof val === "object" && !Array.isArray(val) && val !== null);

    if (allObjects) {
      return "complexType";
    }
  }

  // Check for numbers - default to comma_number format
  const allNumbers = samples
    .filter((val) => val !== null && val !== undefined)
    .every((val) => {
      if (typeof val === "number") return true;
      // Also check if string can be parsed as number
      if (typeof val === "string") {
        const num = Number(val);
        return !isNaN(num) && isFinite(num) && val.trim() !== "";
      }
      return false;
    });

  if (allNumbers) {
    return "comma_number";
  }

  // Check for long strings
  const stringValues = samples
    .filter((val) => val !== null && val !== undefined)
    .map((val) => (typeof val === "object" ? JSON.stringify(val) : String(val)));

  const maxLength = Math.max(...stringValues.map((s) => s.length));
  if (maxLength > 200) {
    return "truncatedText";
  }

  return undefined;
}

