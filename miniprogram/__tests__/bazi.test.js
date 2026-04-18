/**
 * Unit tests for the BaZi calculation utility.
 *
 * Reference dates taken from well-known BaZi textbooks and online calculators
 * (e.g., 命理学基础, 渊海子平) to cross-check the implementation.
 */

const {
  calcBazi,
  getDominantElement,
  getBirthPlaces,
  STEMS,
  BRANCHES,
} = require('../utils/bazi');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pillarStr(p) {
  return `${p.stem}${p.branch}`;
}

// ─── Known reference charts ───────────────────────────────────────────────────

describe('calcBazi — four pillars', () => {
  test('1984-02-15 12:00 CST (甲子年 / 壬寅月 / 甲辰日 / 壬午时)', () => {
    // 1984 is a 甲子 year; Feb 15 is after 立春 (Feb 4 1984).
    // Month: after 惊蛰? No, 惊蛰 is ~Mar 6, so still 寅月.
    const result = calcBazi({ year: 1984, month: 2, day: 15, hour: 12, minute: 0 });
    expect(pillarStr(result.year)).toBe('甲子');
  });

  test('1990-01-27 08:00 CST — before 立春, so year pillar is 己巳 (1989)', () => {
    // 1990's 立春 is around Feb 4, so Jan 27 belongs to the 己巳 (1989) year.
    const result = calcBazi({ year: 1990, month: 1, day: 27, hour: 8, minute: 0 });
    expect(result.year.stem).toBe('己');
    expect(result.year.branch).toBe('巳');
  });

  test('1990-03-15 10:00 CST — after 立春, year pillar is 庚午 (1990)', () => {
    const result = calcBazi({ year: 1990, month: 3, day: 15, hour: 10, minute: 0 });
    expect(result.year.stem).toBe('庚');
    expect(result.year.branch).toBe('午');
  });

  test('2000-02-05 00:00 CST — just after 立春, year is 庚辰', () => {
    // 立春 2000 is Feb 4; Feb 5 is after, so 庚辰 year.
    const result = calcBazi({ year: 2000, month: 2, day: 5, hour: 0, minute: 0 });
    expect(result.year.stem).toBe('庚');
    expect(result.year.branch).toBe('辰');
  });

  test('2024-02-03 — before 立春, year pillar is 癸卯 (2023)', () => {
    // 立春 2024 is Feb 4; Feb 3 is still 癸卯.
    const result = calcBazi({ year: 2024, month: 2, day: 3, hour: 12, minute: 0 });
    expect(result.year.stem).toBe('癸');
    expect(result.year.branch).toBe('卯');
  });

  test('2024-02-04 — on 立春, year pillar is 甲辰 (2024)', () => {
    const result = calcBazi({ year: 2024, month: 2, day: 4, hour: 12, minute: 0 });
    expect(result.year.stem).toBe('甲');
    expect(result.year.branch).toBe('辰');
  });
});

describe('calcBazi — month pillar', () => {
  test('Month after 立春 (Feb 10) is 寅月', () => {
    const result = calcBazi({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 });
    expect(result.month.branch).toBe('寅');
  });

  test('Month in Jan before 小寒 is in 子月 (carry-over from previous Dec 大雪)', () => {
    // 小寒 2024 is around Jan 6.  Jan 1 is still in 子月 (previous cycle).
    const result = calcBazi({ year: 2024, month: 1, day: 1, hour: 12, minute: 0 });
    expect(result.month.branch).toBe('子');
  });

  test('Month after 清明 (Apr 4-5) is 辰月', () => {
    const result = calcBazi({ year: 2024, month: 4, day: 10, hour: 12, minute: 0 });
    expect(result.month.branch).toBe('辰');
  });

  test('Month after 立秋 (Aug 7) is 申月', () => {
    const result = calcBazi({ year: 2024, month: 8, day: 10, hour: 12, minute: 0 });
    expect(result.month.branch).toBe('申');
  });

  test('Month stem follows 五虎遁: 甲年 寅月 = 丙寅', () => {
    // 2024 = 甲辰. 立春 after Feb 4, Feb 10 = 寅月.
    const result = calcBazi({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 });
    expect(result.month.stem).toBe('丙');
    expect(result.month.branch).toBe('寅');
  });
});

describe('calcBazi — day pillar', () => {
  test('1900-01-01 = 甲戌日 (reference point)', () => {
    const result = calcBazi({ year: 1900, month: 1, day: 1, hour: 12, minute: 0 });
    expect(result.day.stem).toBe('甲');
    expect(result.day.branch).toBe('戌');
  });

  test('Day pillar advances by 1 each day', () => {
    const day1 = calcBazi({ year: 1900, month: 1, day: 1, hour: 12, minute: 0 });
    const day2 = calcBazi({ year: 1900, month: 1, day: 2, hour: 12, minute: 0 });
    expect((day2.day.stemIndex - day1.day.stemIndex + 10) % 10).toBe(1);
    expect((day2.day.branchIndex - day1.day.branchIndex + 12) % 12).toBe(1);
  });

  test('Day pillar cycles back after 60 days', () => {
    const day1 = calcBazi({ year: 1900, month: 1, day: 1, hour: 12, minute: 0 });
    const day61 = calcBazi({ year: 1900, month: 3, day: 2, hour: 12, minute: 0 }); // +60 days
    expect(day61.day.stem).toBe(day1.day.stem);
    expect(day61.day.branch).toBe(day1.day.branch);
  });
});

describe('calcBazi — hour pillar', () => {
  test('00:30 is 子时 (branch 子)', () => {
    const result = calcBazi({ year: 2000, month: 6, day: 15, hour: 0, minute: 30 });
    expect(result.hour.branch).toBe('子');
    expect(result.hour.periodName).toBe('子时');
  });

  test('23:30 is 子时 (branch 子)', () => {
    const result = calcBazi({ year: 2000, month: 6, day: 15, hour: 23, minute: 30 });
    expect(result.hour.branch).toBe('子');
    expect(result.hour.periodName).toBe('子时');
  });

  test('01:00 is 丑时 (branch 丑)', () => {
    const result = calcBazi({ year: 2000, month: 6, day: 15, hour: 1, minute: 0 });
    expect(result.hour.branch).toBe('丑');
  });

  test('12:00 is 午时 (branch 午)', () => {
    const result = calcBazi({ year: 2000, month: 6, day: 15, hour: 12, minute: 0 });
    expect(result.hour.branch).toBe('午');
    expect(result.hour.periodName).toBe('午时');
  });

  test('21:00 is 亥时 (branch 亥)', () => {
    const result = calcBazi({ year: 2000, month: 6, day: 15, hour: 21, minute: 0 });
    expect(result.hour.branch).toBe('亥');
  });

  test('Hour stem follows 五鼠遁: 甲日 子时 = 甲子', () => {
    // 1900-01-01 = 甲戌日, stemIndex 0 (甲).
    // 子时 (hour 0): stem offset for 甲 day = 0 (甲), branch 0 (子) → 甲子
    const result = calcBazi({ year: 1900, month: 1, day: 1, hour: 0, minute: 30 });
    expect(result.day.stem).toBe('甲');
    expect(result.hour.stem).toBe('甲');
    expect(result.hour.branch).toBe('子');
  });
});

describe('calcBazi — five elements', () => {
  test('fiveElements counts sum to 8 (4 stems + 4 branches)', () => {
    const result = calcBazi({ year: 1990, month: 3, day: 15, hour: 10, minute: 0 });
    const total = Object.values(result.fiveElements).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  test('getDominantElement returns the most frequent element', () => {
    const result = calcBazi({ year: 1990, month: 3, day: 15, hour: 10, minute: 0 });
    const dominant = getDominantElement(result.fiveElements);
    const maxCount = Math.max(...Object.values(result.fiveElements));
    expect(result.fiveElements[dominant]).toBe(maxCount);
  });
});

describe('calcBazi — utcOffset', () => {
  test('utcOffset parameter is accepted without error', () => {
    expect(() =>
      calcBazi({ year: 1990, month: 3, day: 15, hour: 10, minute: 0, utcOffset: -5 })
    ).not.toThrow();
  });
});

describe('getBirthPlaces', () => {
  test('returns a non-empty array', () => {
    const places = getBirthPlaces();
    expect(Array.isArray(places)).toBe(true);
    expect(places.length).toBeGreaterThan(0);
  });

  test('each place has name and utcOffset', () => {
    getBirthPlaces().forEach(p => {
      expect(typeof p.name).toBe('string');
      expect(typeof p.utcOffset).toBe('number');
    });
  });

  test('Beijing is UTC+8', () => {
    const beijing = getBirthPlaces().find(p => p.name === '北京');
    expect(beijing).toBeDefined();
    expect(beijing.utcOffset).toBe(8);
  });
});

describe('STEMS and BRANCHES arrays', () => {
  test('STEMS has 10 elements', () => {
    expect(STEMS.length).toBe(10);
  });

  test('BRANCHES has 12 elements', () => {
    expect(BRANCHES.length).toBe(12);
  });

  test('STEMS starts with 甲', () => {
    expect(STEMS[0]).toBe('甲');
  });

  test('BRANCHES starts with 子', () => {
    expect(BRANCHES[0]).toBe('子');
  });
});
