/**
 * Date Utility Functions
 * Handles German date formats and normalization
 */

/**
 * Parse German date format (DD.MM.YYYY or DD.MM.YY)
 * @param dateStr Date string
 * @returns ISO date string or null
 */
export function parseGermanDate(dateStr: string): string | null {
    // Match DD.MM.YYYY or DD.MM.YY
    const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (!match) return null;

    let [, day, month, year] = match;

    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
        const yy = parseInt(year);
        year = yy > 50 ? `19${year}` : `20${year}`;
    }

    // Validate date
    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);

    if (m < 1 || m > 12 || d < 1 || d > 31) return null;

    // Create ISO date (YYYY-MM-DD)
    const isoDate = `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Validate by creating date object
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return null;

    return isoDate;
}

/**
 * Normalize date to ISO format
 * Handles multiple formats
 * @param dateStr Date string
 * @returns ISO date string or null
 */
export function normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // Try German format first
    const german = parseGermanDate(dateStr);
    if (german) return german;

    // Try ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return dateStr;
    }

    // Try parsing as general date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    return null;
}

/**
 * Get current ISO timestamp
 * @returns ISO timestamp string
 */
export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Calculate days between two dates
 * @param date1 First date
 * @param date2 Second date
 * @returns Number of days
 */
export function daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diff = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
