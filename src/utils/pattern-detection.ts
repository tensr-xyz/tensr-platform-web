/**
 * Pattern detection utilities for Excel-like auto-fill functionality
 */

export type PatternType = 'numeric' | 'date' | 'text' | 'weekday' | 'month' | 'none';

export interface DetectedPattern {
  type: PatternType;
  step?: number;
  baseValue?: any;
  values?: any[];
}

/**
 * Detects if a sequence of values follows a numeric pattern
 */
function detectNumericPattern(values: (string | number)[]): DetectedPattern | null {
  const numbers = values
    .map(v => {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(num) ? null : num;
    })
    .filter((v): v is number => v !== null);

  if (numbers.length < 2) return null;

  // Check for arithmetic sequence
  const differences: number[] = [];
  for (let i = 1; i < numbers.length; i++) {
    differences.push(numbers[i] - numbers[i - 1]);
  }

  // Check if all differences are the same (or very close)
  const firstDiff = differences[0];
  const allSame = differences.every(diff => Math.abs(diff - firstDiff) < 0.0001);

  if (allSame && firstDiff !== 0) {
    return {
      type: 'numeric',
      step: firstDiff,
      baseValue: numbers[0],
      values: numbers,
    };
  }

  // Check for geometric sequence (multiplying by constant)
  const ratios: number[] = [];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i - 1] !== 0) {
      ratios.push(numbers[i] / numbers[i - 1]);
    }
  }

  if (ratios.length === numbers.length - 1) {
    const firstRatio = ratios[0];
    const allSameRatio = ratios.every(ratio => Math.abs(ratio - firstRatio) < 0.0001);
    if (allSameRatio && firstRatio !== 1) {
      return {
        type: 'numeric',
        step: firstRatio,
        baseValue: numbers[0],
        values: numbers,
      };
    }
  }

  return null;
}

/**
 * Detects if a sequence follows a weekday pattern
 */
function detectWeekdayPattern(values: string[]): DetectedPattern | null {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekdaysShort = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const weekdaysAbbr = ['m', 't', 'w', 't', 'f', 's', 's'];

  const normalized = values.map(v => v.toLowerCase().trim());

  // Check for full weekday names
  let indices: number[] = [];
  for (const val of normalized) {
    const index = weekdays.findIndex(w => val.includes(w));
    if (index !== -1) {
      indices.push(index);
    } else {
      const shortIndex = weekdaysShort.findIndex(w => val.includes(w));
      if (shortIndex !== -1) {
        indices.push(shortIndex);
      } else {
        return null;
      }
    }
  }

  if (indices.length < 2) return null;

  // Check if indices form a sequence
  const step = indices[1] - indices[0];
  const isSequence = indices.every((idx, i) => {
    if (i === 0) return true;
    const expected = (indices[i - 1] + step + 7) % 7;
    return idx === expected || idx === indices[i - 1] + step;
  });

  if (isSequence) {
    return {
      type: 'weekday',
      step: step > 0 ? step : step + 7,
      baseValue: values[0],
      values,
    };
  }

  return null;
}

/**
 * Detects if a sequence follows a month pattern
 */
function detectMonthPattern(values: string[]): DetectedPattern | null {
  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const monthsShort = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];

  const normalized = values.map(v => v.toLowerCase().trim());

  let indices: number[] = [];
  for (const val of normalized) {
    const index = months.findIndex(m => val.includes(m));
    if (index !== -1) {
      indices.push(index);
    } else {
      const shortIndex = monthsShort.findIndex(m => val.includes(m));
      if (shortIndex !== -1) {
        indices.push(shortIndex);
      } else {
        return null;
      }
    }
  }

  if (indices.length < 2) return null;

  const step = indices[1] - indices[0];
  const isSequence = indices.every((idx, i) => {
    if (i === 0) return true;
    const expected = (indices[i - 1] + step + 12) % 12;
    return idx === expected || idx === indices[i - 1] + step;
  });

  if (isSequence) {
    return {
      type: 'month',
      step: step > 0 ? step : step + 12,
      baseValue: values[0],
      values,
    };
  }

  return null;
}

/**
 * Detects if a sequence follows a date pattern
 */
function detectDatePattern(values: (string | number)[]): DetectedPattern | null {
  const dates: Date[] = [];
  for (const val of values) {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    } else {
      return null;
    }
  }

  if (dates.length < 2) return null;

  // Check if dates form a sequence
  const differences: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    differences.push(dates[i].getTime() - dates[i - 1].getTime());
  }

  const firstDiff = differences[0];
  const allSame = differences.every(diff => Math.abs(diff - firstDiff) < 1000); // 1 second tolerance

  if (allSame) {
    const days = firstDiff / (1000 * 60 * 60 * 24);
    return {
      type: 'date',
      step: days,
      baseValue: dates[0],
      values: dates,
    };
  }

  return null;
}

/**
 * Detects if a sequence follows a text pattern (e.g., Item1, Item2, Item3)
 */
function detectTextPattern(values: string[]): DetectedPattern | null {
  if (values.length < 2) return null;

  // Try to extract numeric suffix pattern
  const patterns: Array<{ prefix: string; numbers: number[] }> = [];

  for (const val of values) {
    const match = val.match(/^(.+?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const number = parseInt(match[2], 10);
      const existing = patterns.find(p => p.prefix === prefix);
      if (existing) {
        existing.numbers.push(number);
      } else {
        patterns.push({ prefix, numbers: [number] });
      }
    }
  }

  // Check if any pattern has a numeric sequence
  for (const pattern of patterns) {
    if (pattern.numbers.length >= 2) {
      const step = pattern.numbers[1] - pattern.numbers[0];
      const isSequence = pattern.numbers.every((num, i) => {
        if (i === 0) return true;
        return num === pattern.numbers[i - 1] + step;
      });

      if (isSequence) {
        return {
          type: 'text',
          step,
          baseValue: values[0],
          values,
        };
      }
    }
  }

  return null;
}

/**
 * Detects the pattern in a sequence of values
 */
export function detectPattern(values: (string | number)[]): DetectedPattern {
  if (values.length < 2) {
    return { type: 'none' };
  }

  // Try different pattern detectors in order of specificity
  const stringValues = values.map(v => String(v));

  // Try weekday pattern
  const weekdayPattern = detectWeekdayPattern(stringValues);
  if (weekdayPattern) return weekdayPattern;

  // Try month pattern
  const monthPattern = detectMonthPattern(stringValues);
  if (monthPattern) return monthPattern;

  // Try date pattern
  const datePattern = detectDatePattern(values);
  if (datePattern) return datePattern;

  // Try numeric pattern
  const numericPattern = detectNumericPattern(values);
  if (numericPattern) return numericPattern;

  // Try text pattern
  const textPattern = detectTextPattern(stringValues);
  if (textPattern) return textPattern;

  return { type: 'none' };
}

/**
 * Generates the next value in a sequence based on the detected pattern
 */
export function generateNextValue(pattern: DetectedPattern, currentValue: any, index: number): any {
  if (pattern.type === 'none' || !pattern.step) {
    return currentValue; // Copy mode
  }

  switch (pattern.type) {
    case 'numeric':
      if (typeof currentValue === 'number') {
        return currentValue + pattern.step;
      }
      const num = parseFloat(String(currentValue));
      if (!isNaN(num)) {
        return num + pattern.step;
      }
      return currentValue;

    case 'date':
      if (currentValue instanceof Date) {
        const newDate = new Date(currentValue);
        newDate.setDate(newDate.getDate() + (pattern.step || 1));
        return newDate;
      }
      const date = new Date(currentValue);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + (pattern.step || 1));
        return date;
      }
      return currentValue;

    case 'weekday': {
      const weekdays = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      const weekdaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const currentStr = String(currentValue).toLowerCase();
      let currentIndex = -1;

      for (let i = 0; i < weekdays.length; i++) {
        if (currentStr.includes(weekdays[i].toLowerCase())) {
          currentIndex = i;
          break;
        }
      }

      if (currentIndex === -1) {
        for (let i = 0; i < weekdaysShort.length; i++) {
          if (currentStr.includes(weekdaysShort[i].toLowerCase())) {
            currentIndex = i;
            break;
          }
        }
      }

      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + (pattern.step || 1)) % 7;
        // Try to match the format of the original
        if (currentStr.length <= 4) {
          return weekdaysShort[nextIndex];
        }
        return weekdays[nextIndex];
      }
      return currentValue;
    }

    case 'month': {
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const monthsShort = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const currentStr = String(currentValue).toLowerCase();
      let currentIndex = -1;

      for (let i = 0; i < months.length; i++) {
        if (currentStr.includes(months[i].toLowerCase())) {
          currentIndex = i;
          break;
        }
      }

      if (currentIndex === -1) {
        for (let i = 0; i < monthsShort.length; i++) {
          if (currentStr.includes(monthsShort[i].toLowerCase())) {
            currentIndex = i;
            break;
          }
        }
      }

      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + (pattern.step || 1)) % 12;
        if (currentStr.length <= 4) {
          return monthsShort[nextIndex];
        }
        return months[nextIndex];
      }
      return currentValue;
    }

    case 'text': {
      const match = String(currentValue).match(/^(.+?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const number = parseInt(match[2], 10);
        return `${prefix}${number + (pattern.step || 1)}`;
      }
      return currentValue;
    }

    default:
      return currentValue;
  }
}

/**
 * Generates a sequence of values based on a pattern
 */
export function generateSequence(
  pattern: DetectedPattern,
  baseValues: (string | number)[],
  count: number
): (string | number)[] {
  if (pattern.type === 'none') {
    // Copy mode - repeat the last value
    return Array(count).fill(baseValues[baseValues.length - 1]);
  }

  const sequence: (string | number)[] = [];
  let currentValue = baseValues[baseValues.length - 1];

  for (let i = 0; i < count; i++) {
    currentValue = generateNextValue(pattern, currentValue, baseValues.length + i);
    sequence.push(currentValue);
  }

  return sequence;
}
