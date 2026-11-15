// Altitude in metres above sea level (MASL), stored on a coffee as text such as "1850" or "1700-1900".

// The altitude as one number: the average of a range, or null when there is none.
export const parseAltitude = (value) => {
    const numbers = ((value ?? '').toString().replace(/[.,](?=\d{3}\b)/g, '').match(/\d+(?:[.,]\d+)?/g) || [])
        .map((n) => Number(n.replace(',', '.')))
        .filter((n) => Number.isFinite(n) && n >= 100 && n <= 6000);
    if (!numbers.length) return null;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
};

// Low below 900 m, middle from 900 to 1200 m, high above 1200 m.
export const ALTITUDE_MIDDLE_MIN = 900;
export const ALTITUDE_MIDDLE_MAX = 1200;
export const altitudeBand = (value) => {
    const metres = parseAltitude(value);
    if (metres === null) return null;
    if (metres < ALTITUDE_MIDDLE_MIN) return 'low';
    if (metres <= ALTITUDE_MIDDLE_MAX) return 'middle';
    return 'high';
};

// "1850 MASL" or "1700-1900 MASL" for display; '-' when empty.
export const formatAltitude = (value) => {
    const text = (value ?? '').toString().trim().replace(/\s*(m|masl|m\.a\.s\.l\.?)$/i, '');
    return text ? `${text} MASL` : '-';
};
