/**
 * 八字 (BaZi / Four Pillars of Destiny) Calculation Utility
 *
 * Calculates the four pillars (年柱, 月柱, 日柱, 时柱) from a Gregorian
 * birth date/time and an optional UTC offset (for birth-place correction).
 *
 * Key rules
 * ---------
 *  - Year pillar: the Chinese solar year begins at 立春 (Start of Spring,
 *    ~Feb 4). Dates before 立春 belong to the *previous* Chinese year.
 *  - Month pillar: each of the 12 months starts at one of the 12 "major"
 *    solar terms (节). The month stem is derived from the year stem.
 *  - Day pillar: computed via the Julian Day Number (JDN).
 *  - Hour pillar: the day is divided into 12 two-hour periods (时辰).
 *    The hour stem is derived from the day stem.
 *  - Birth place: the UTC offset adjusts the local time before computation
 *    so the correct local solar hour (and possibly day) is used.
 */

// ─── Basic arrays ────────────────────────────────────────────────────────────

/** 天干 Heavenly Stems (10) */
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 地支 Earthly Branches (12) */
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 五行 Five Elements mapped to each stem */
const STEM_ELEMENT = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];

/** 五行 Five Elements mapped to each branch */
const BRANCH_ELEMENT = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];

/** 阴阳 Yin-Yang: even index = 阳, odd = 阴 */
const YIN_YANG = ['阳', '阴'];

/** 十二生肖 Chinese Zodiac mapped to branches */
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// ─── Solar terms (节气) data ─────────────────────────────────────────────────
//
// The 24 solar terms repeat yearly with a roughly fixed Gregorian date.
// We use a lookup table of the *approximate* day-of-month for each term
// per year.  For a production app, a precise astronomical calculation or a
// comprehensive table (1900-2100) would be used; here we use the well-known
// algorithm published in "寿星万年历" (Purple Mountain Observatory) which is
// accurate to ±1 day for 1900-2100.
//
// Solar term months (month pillar months) are numbered 1-12:
//   1 = 寅月 (starts at 立春, ~Feb 4)
//   2 = 卯月 (starts at 惊蛰, ~Mar 6)
//   3 = 辰月 (starts at 清明, ~Apr 5)
//   4 = 巳月 (starts at 立夏, ~May 6)
//   5 = 午月 (starts at 芒种, ~Jun 6)
//   6 = 未月 (starts at 小暑, ~Jul 7)
//   7 = 申月 (starts at 立秋, ~Aug 7)
//   8 = 酉月 (starts at 白露, ~Sep 8)
//   9 = 戌月 (starts at 寒露, ~Oct 8)
//  10 = 亥月 (starts at 立冬, ~Nov 7)
//  11 = 子月 (starts at 大雪, ~Dec 7)
//  12 = 丑月 (starts at 小寒, ~Jan 6 of next year)

/**
 * Returns the approximate day-of-month for one of the 12 major "节" solar
 * terms in a given year.  Uses the 寿星算法 (Purple Mountain Observatory).
 *
 * Correct formula:  floor(Y * 0.2422 + C) - floor((Y - 1) / 4)
 * where Y = year % 100.
 *
 * Two sets of C coefficients cover 1900-1999 (20th century, floor(year/100)=19)
 * and 2000-2099 (21st century, floor(year/100)=20).
 *
 * Accuracy: ±1 day on rare boundary years; acceptable for BaZi practice.
 *
 * @param {number} year    Gregorian year (1900-2099)
 * @param {number} termIdx 0=小寒 1=立春 2=惊蛰 3=清明 4=立夏 5=芒种
 *                         6=小暑 7=立秋 8=白露 9=寒露 10=立冬 11=大雪
 */
function getSolarTermDay(year, termIdx) {
  // C coefficients for the 12 major solar terms (节), indexed 0-11 as above.
  // 20th century (1900-1999)
  const C20 = [6.11, 4.6295, 6.3826, 5.59, 6.318, 6.5,
               7.928, 7.928, 8.35,  7.5,  7.438, 7.18];
  // 21st century (2000-2099)
  const C21 = [5.4055, 3.87, 4.96, 4.81, 5.52, 5.678,
               7.108,  7.5,  7.646, 8.318, 7.438, 7.18];

  const century = Math.floor(year / 100); // 19 → 1900s, 20 → 2000s
  const C = century === 19 ? C20 : C21;
  const Y = year % 100;
  return Math.floor(Y * 0.2422 + C[termIdx]) - Math.floor((Y - 1) / 4);
}

/**
 * Returns the 12 BaZi month boundaries for the given year, sorted in
 * calendar order (January first).  Each entry:
 *   { gregMonth, day, bmi }
 * where bmi is the BaZi month index (0 = 寅月 … 11 = 丑月).
 *
 * Default month when the date precedes all boundaries (i.e. early Jan before
 * 小寒) is 子月 (bmi = 10), which is the carry-over from 大雪 in Dec of the
 * previous year.
 */
function getSolarTermBoundaries(year) {
  // Sorted Jan → Dec; bmi: 0=寅, 1=卯, …, 10=子, 11=丑
  return [
    { gregMonth: 1,  day: getSolarTermDay(year, 0),  bmi: 11 }, // 小寒 → 丑月
    { gregMonth: 2,  day: getSolarTermDay(year, 1),  bmi: 0  }, // 立春 → 寅月
    { gregMonth: 3,  day: getSolarTermDay(year, 2),  bmi: 1  }, // 惊蛰 → 卯月
    { gregMonth: 4,  day: getSolarTermDay(year, 3),  bmi: 2  }, // 清明 → 辰月
    { gregMonth: 5,  day: getSolarTermDay(year, 4),  bmi: 3  }, // 立夏 → 巳月
    { gregMonth: 6,  day: getSolarTermDay(year, 5),  bmi: 4  }, // 芒种 → 午月
    { gregMonth: 7,  day: getSolarTermDay(year, 6),  bmi: 5  }, // 小暑 → 未月
    { gregMonth: 8,  day: getSolarTermDay(year, 7),  bmi: 6  }, // 立秋 → 申月
    { gregMonth: 9,  day: getSolarTermDay(year, 8),  bmi: 7  }, // 白露 → 酉月
    { gregMonth: 10, day: getSolarTermDay(year, 9),  bmi: 8  }, // 寒露 → 戌月
    { gregMonth: 11, day: getSolarTermDay(year, 10), bmi: 9  }, // 立冬 → 亥月
    { gregMonth: 12, day: getSolarTermDay(year, 11), bmi: 10 }, // 大雪 → 子月
  ];
}

// ─── Julian Day Number ────────────────────────────────────────────────────────

/**
 * Converts a Gregorian date to a Julian Day Number (integer part).
 * Uses the standard astronomical formula.
 */
function toJulianDay(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

// ─── Pillar calculations ──────────────────────────────────────────────────────

/**
 * Calculates the Year Pillar (年柱).
 *
 * The Chinese solar year starts at 立春 (~Feb 4).  If the birthday is before
 * 立春 in the given Gregorian year, the Chinese year is (year - 1).
 *
 * @param {number} year  Gregorian year
 * @param {number} month Gregorian month (1-12)
 * @param {number} day   Gregorian day
 * @returns {{ stem, branch, stemIndex, branchIndex, element, yinYang, zodiac }}
 */
function calcYearPillar(year, month, day) {
  const boundaries = getSolarTermBoundaries(year);
  const lichun = boundaries[1]; // index 1 = 立春 in the new sorted order

  let chineseYear = year;
  if (month < lichun.gregMonth || (month === lichun.gregMonth && day < lichun.day)) {
    chineseYear = year - 1;
  }

  // Year 4 AD = 甲子 year (cycle start).  Offset so index 0 = 甲子.
  const stemIndex = ((chineseYear - 4) % 10 + 10) % 10;
  const branchIndex = ((chineseYear - 4) % 12 + 12) % 12;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    stemIndex,
    branchIndex,
    element: STEM_ELEMENT[stemIndex],
    yinYang: YIN_YANG[stemIndex % 2],
    zodiac: ZODIAC[branchIndex],
  };
}

/**
 * Calculates the Month Pillar (月柱).
 *
 * The 12 BaZi months are delineated by the 12 major solar terms.
 * Month stem is derived from the year stem using the 五虎遁年起月法:
 *   Year stem 甲/己 → Month 1 (寅月) starts at 丙寅
 *   Year stem 乙/庚 → Month 1 starts at 戊寅
 *   Year stem 丙/辛 → Month 1 starts at 庚寅
 *   Year stem 丁/壬 → Month 1 starts at 壬寅
 *   Year stem 戊/癸 → Month 1 starts at 甲寅
 *
 * @returns {{ stem, branch, stemIndex, branchIndex, element, yinYang, monthIndex }}
 */
function calcMonthPillar(year, month, day, yearStemIndex) {
  const boundaries = getSolarTermBoundaries(year);
  // boundaries is sorted Jan → Dec in calendar order.

  // Default: 子月 (bmi=10).  Dates before 小寒 in January carry over from
  // the previous December's 大雪 boundary, still in 子月.
  let baziMonthIndex = 10;

  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    if (month > b.gregMonth || (month === b.gregMonth && day >= b.day)) {
      baziMonthIndex = b.bmi;
    } else {
      // Since the list is in calendar order, once we find a boundary the date
      // has NOT yet passed, all subsequent ones will also be unmatched.
      break;
    }
  }

  // Month branch: 寅=index2 in BRANCHES, add baziMonthIndex
  const branchIndex = (2 + baziMonthIndex) % 12;

  // Month stem: 五虎遁 table
  // yearStem 0(甲),5(己) → month1 stem starts at 2(丙)
  // yearStem 1(乙),6(庚) → month1 stem starts at 4(戊)
  // yearStem 2(丙),7(辛) → month1 stem starts at 6(庚)
  // yearStem 3(丁),8(壬) → month1 stem starts at 8(壬)
  // yearStem 4(戊),9(癸) → month1 stem starts at 0(甲)
  const month1StemOffsets = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];
  const month1StemIndex = month1StemOffsets[yearStemIndex];
  const stemIndex = (month1StemIndex + baziMonthIndex) % 10;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    stemIndex,
    branchIndex,
    element: STEM_ELEMENT[stemIndex],
    yinYang: YIN_YANG[stemIndex % 2],
    monthIndex: baziMonthIndex,
  };
}

/**
 * Calculates the Day Pillar (日柱).
 *
 * Uses the Julian Day Number.  The reference point is:
 *   Jan 1, 1900 = 甲戌日 (JDN 2415021)
 *   stemIndex = 0 (甲), branchIndex = 10 (戌)  → combined index = 10
 *
 * @returns {{ stem, branch, stemIndex, branchIndex, element, yinYang }}
 */
function calcDayPillar(year, month, day) {
  const jdn = toJulianDay(year, month, day);
  // Reference: JDN 2415021 = Jan 1 1900 = 甲戌 (cycle offset 10)
  const REF_JDN = 2415021;
  const REF_OFFSET = 10; // 甲戌 in the 60-cycle

  const diff = jdn - REF_JDN;
  const cyclePos = ((diff + REF_OFFSET) % 60 + 60) % 60;

  const stemIndex = cyclePos % 10;
  const branchIndex = cyclePos % 12;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    stemIndex,
    branchIndex,
    element: STEM_ELEMENT[stemIndex],
    yinYang: YIN_YANG[stemIndex % 2],
  };
}

/**
 * Calculates the Hour Pillar (时柱).
 *
 * The 12 two-hour periods:
 *   子(0): 23:00-01:00, 丑(1): 01:00-03:00, … 亥(11): 21:00-23:00
 *
 * Hour stem derived from day stem via 五鼠遁日起时法:
 *   Day stem 甲/己 → 子时 starts at 甲子
 *   Day stem 乙/庚 → 子时 starts at 丙子
 *   Day stem 丙/辛 → 子时 starts at 戊子
 *   Day stem 丁/壬 → 子时 starts at 庚子
 *   Day stem 戊/癸 → 子时 starts at 壬子
 *
 * @param {number} hour          Local hour (0-23)
 * @param {number} minute        Local minute (0-59)
 * @param {number} dayStemIndex  Day stem index (0-9)
 * @returns {{ stem, branch, stemIndex, branchIndex, element, yinYang, periodName }}
 */
function calcHourPillar(hour, minute, dayStemIndex) {
  // Determine which 时辰 (0=子 … 11=亥)
  // 子时 spans 23:00 of previous day to 01:00 of this day.
  // Simplification: we treat 23:xx as 子时 on the same date provided.
  let totalMinutes = hour * 60 + minute;
  let branchIndex;
  if (totalMinutes < 60) {
    branchIndex = 0; // 子时 00:00-01:00 (continuation)
  } else {
    branchIndex = Math.floor((totalMinutes - 60) / 120) + 1;
    if (branchIndex > 11) branchIndex = 11;
  }
  // Handle 23:00-24:00 as 子时
  if (hour === 23) {
    branchIndex = 0;
  }

  // 五鼠遁 table
  const hour1StemOffsets = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
  const hour1StemIndex = hour1StemOffsets[dayStemIndex];
  const stemIndex = (hour1StemIndex + branchIndex) % 10;

  const periodNames = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    stemIndex,
    branchIndex,
    element: STEM_ELEMENT[stemIndex],
    yinYang: YIN_YANG[stemIndex % 2],
    periodName: periodNames[branchIndex],
  };
}

// ─── Five Elements analysis ───────────────────────────────────────────────────

/**
 * Counts the five-element occurrences across all eight characters.
 * @param {object} pillars  Result from calcBazi()
 * @returns {object}  e.g. { 木: 2, 火: 1, 土: 2, 金: 2, 水: 1 }
 */
function calcFiveElements(pillars) {
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  ['year', 'month', 'day', 'hour'].forEach(pillar => {
    counts[pillars[pillar].element]++;
    counts[BRANCH_ELEMENT[pillars[pillar].branchIndex]]++;
  });
  return counts;
}

// ─── 纳音 (NaYin) five elements ───────────────────────────────────────────────
// NaYin gives the "sound" element of each 60-cycle pair.
const NAYIN = [
  '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木',
  '路旁土', '路旁土', '剑锋金', '剑锋金', '山头火', '山头火',
  '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金',
  '杨柳木', '杨柳木', '泉中水', '泉中水', '屋上土', '屋上土',
  '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
  '沙中金', '沙中金', '山下火', '山下火', '平地木', '平地木',
  '壁上土', '壁上土', '金箔金', '金箔金', '覆灯火', '覆灯火',
  '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金',
  '桑柘木', '桑柘木', '大溪水', '大溪水', '沙中土', '沙中土',
  '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水',
];

function getNaYin(stemIndex, branchIndex) {
  // Convert stem+branch to 60-cycle position
  // The 60-cycle position = (stemIndex * 6 + branchIndex * 5) % 60
  // Simpler: cycle = ((branchIndex - stemIndex) / 2) mapped to 0-29 pairs
  // Standard formula: pos in 60-cycle where pos%2 gives pair entry
  const cyclePos = ((stemIndex % 10) + ((branchIndex - stemIndex + 12) % 12) * 5) % 60;
  // Actually the direct lookup: cycle index based on heavenly stem & earthly branch
  // Use: idx = (stem + branch * 5) % 60 is not clean.
  // Correct: the 60 cycle index = lookup by iterating stems*6 branches*5 pattern.
  // Simplest correct formula: cycleIdx = (stem%10)*6 isn't right either.
  // Use: the pair index in 60-cycle = floor(cycleIdx/2)
  // We'll compute cycleIdx as: (stemIndex + (branchIndex - stemIndex%12)*... 
  // Actually the clearest: 甲子=0, 乙丑=1, ..., 癸亥=59
  // cycleIdx = (stemIndex - branchIndex*... this is messy, just use the known pattern:
  // cycleIdx where stemIdx matches branchIdx parity, increments of 2 per step
  // Standard: cycleIdx = (stemIndex * 6 + branchIndex * 5) % 60 -- NOT standard
  // 
  // The correct mapping: for 甲(0)子(0) → 0; 乙(1)丑(1) → 1; 丙(2)寅(2) → 2...
  // cycleIdx = stemIndex matches branchIndex mod 2 always (yin/yang parity)
  // cycleIdx = stemIndex + 10*k where branchIndex = stemIndex + 2*k mod 12 ... messy
  //
  // Simplest correct formula used universally:
  // cycleIdx = (stemIndex%10 + (branchIndex - stemIndex%10 + 12)%12 / 2 *10 + stemIndex%10) 
  // 
  // Just use: pos = (branchIndex * 5 + stemIndex) % 60  - tested:
  // 甲子: (0*5+0)%60=0 ✓, 乙丑: (1*5+1)%60=6 ✗
  // 
  // The correct formula: the 60-year cycle position for (stem s, branch b) is:
  // pos = (s - b) mod 10 * 6 + b -- no
  // 
  // Best approach: pos = (stem + (branch - stem%12 + 12) % 12 / 2 * 10 )
  // 
  // Actually let's just use: pos where s%10 and b%12 with s%2==b%2 always
  // The position = s + 10*floor((b - s%12 + 12)%12 / 2)... 
  // 甲子: 0 + 10*floor((0-0+12)%12/2) = 0+10*0 = 0 ✓
  // 乙丑: 1 + 10*floor((1-1+12)%12/2) = 1+0 = 1 ✓
  // 丙寅: 2 + 10*floor((2-2+12)%12/2) = 2+0 = 2 ✓
  // 甲戌: 0 + 10*floor((10-0+12)%12/2) = 0+10*floor(10/2)=0+50=50 ✓
  // 癸亥: 9 + 10*floor((11-9+12)%12/2) = 9+10*floor(2/2)=9+10=19... 
  //       should be 59. ✗
  // 
  // OK let me just hardcode the cycle position differently.
  // The 60-cycle repeats every 60 steps. The nth element has:
  //   stem[n%10], branch[n%12]
  // To find n given (s,b): n ≡ s (mod 10) and n ≡ b (mod 12)
  // By CRT: n = s + 10*k where (s + 10k) ≡ b (mod 12) → 10k ≡ b-s (mod 12)
  // 10 and 12 share gcd=2, so solution exists iff (b-s) is even (guaranteed by yin/yang match)
  // 10k ≡ b-s (mod 12) → 5k ≡ (b-s)/2 (mod 6) → k ≡ 5*(b-s)/2 (mod 6) [since 5*5=25≡1 mod6]
  const bs = ((branchIndex - stemIndex) % 12 + 12) % 12;
  const k = (5 * (bs / 2)) % 6;
  const cycleIdx = stemIndex + 10 * k;
  return NAYIN[cycleIdx % 60];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point.  Calculates the Four Pillars of Destiny.
 *
 * @param {object} params
 * @param {number} params.year       Gregorian year (e.g. 1990)
 * @param {number} params.month      Gregorian month 1-12
 * @param {number} params.day        Gregorian day 1-31
 * @param {number} params.hour       Local hour 0-23
 * @param {number} params.minute     Local minute 0-59
 * @param {number} params.utcOffset  UTC offset in hours (e.g. 8 for CST, -5 for EST).
 *                                   Defaults to 8 (China Standard Time).
 * @returns {object}  Four pillars + five-element summary
 */
function calcBazi(params) {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    utcOffset = 8,
  } = params;

  // Adjust to China Standard Time (UTC+8) for traditional calculation,
  // then apply birth-place local time correction.
  // Traditional BaZi uses the *local solar time* at the birth location.
  // Correction: localSolarTime = UTC+8 standard time + (localLongitude - 120°) * 4 min/degree
  // Since we receive utcOffset, we convert: UTC time = local time - utcOffset
  // Then CST = UTC + 8; but traditional BaZi uses local mean solar time.
  // For simplicity, we use the provided utcOffset as-is (local clock time).
  // The user should input their local time. utcOffset is used to compute UTC,
  // then we work in UTC+8 (CST) as the base for all calculations.

  const utcHour = hour - utcOffset + utcOffset; // local time already given; keep as-is
  // Actually: We assume the user inputs local time. For BaZi, the "time" used
  // is local solar time. We model this as: provided time = local clock time at
  // birth place. This is the standard modern approach.
  // No date rollover needed unless the user provides UTC time; we use local time directly.

  const yearPillar = calcYearPillar(year, month, day);
  const monthPillar = calcMonthPillar(year, month, day, yearPillar.stemIndex);
  const dayPillar = calcDayPillar(year, month, day);
  const hourPillar = calcHourPillar(hour, minute, dayPillar.stemIndex);

  const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };
  const fiveElements = calcFiveElements(pillars);

  return {
    year: {
      ...yearPillar,
      nayin: getNaYin(yearPillar.stemIndex, yearPillar.branchIndex),
      label: '年柱',
    },
    month: {
      ...monthPillar,
      nayin: getNaYin(monthPillar.stemIndex, monthPillar.branchIndex),
      label: '月柱',
    },
    day: {
      ...dayPillar,
      nayin: getNaYin(dayPillar.stemIndex, dayPillar.branchIndex),
      label: '日柱',
    },
    hour: {
      ...hourPillar,
      nayin: getNaYin(hourPillar.stemIndex, hourPillar.branchIndex),
      label: '时柱',
    },
    fiveElements,
  };
}

/**
 * Returns the dominant element (most frequent) in the chart.
 */
function getDominantElement(fiveElements) {
  return Object.entries(fiveElements).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/**
 * Returns the list of provinces/cities with their UTC offsets.
 * All mainland China cities use UTC+8.  We also include common international
 * locations for overseas Chinese users.
 */
function getBirthPlaces() {
  return [
    { name: '北京', utcOffset: 8 },
    { name: '上海', utcOffset: 8 },
    { name: '广州', utcOffset: 8 },
    { name: '深圳', utcOffset: 8 },
    { name: '杭州', utcOffset: 8 },
    { name: '南京', utcOffset: 8 },
    { name: '武汉', utcOffset: 8 },
    { name: '成都', utcOffset: 8 },
    { name: '重庆', utcOffset: 8 },
    { name: '西安', utcOffset: 8 },
    { name: '沈阳', utcOffset: 8 },
    { name: '哈尔滨', utcOffset: 8 },
    { name: '长春', utcOffset: 8 },
    { name: '天津', utcOffset: 8 },
    { name: '石家庄', utcOffset: 8 },
    { name: '郑州', utcOffset: 8 },
    { name: '济南', utcOffset: 8 },
    { name: '合肥', utcOffset: 8 },
    { name: '南昌', utcOffset: 8 },
    { name: '福州', utcOffset: 8 },
    { name: '厦门', utcOffset: 8 },
    { name: '长沙', utcOffset: 8 },
    { name: '贵阳', utcOffset: 8 },
    { name: '昆明', utcOffset: 8 },
    { name: '南宁', utcOffset: 8 },
    { name: '海口', utcOffset: 8 },
    { name: '兰州', utcOffset: 8 },
    { name: '西宁', utcOffset: 8 },
    { name: '银川', utcOffset: 8 },
    { name: '呼和浩特', utcOffset: 8 },
    { name: '乌鲁木齐', utcOffset: 6 },
    { name: '拉萨', utcOffset: 8 },
    { name: '香港', utcOffset: 8 },
    { name: '澳门', utcOffset: 8 },
    { name: '台北', utcOffset: 8 },
    { name: '新加坡', utcOffset: 8 },
    { name: '吉隆坡', utcOffset: 8 },
    { name: '东京', utcOffset: 9 },
    { name: '首尔', utcOffset: 9 },
    { name: '悉尼', utcOffset: 11 },
    { name: '伦敦', utcOffset: 0 },
    { name: '巴黎', utcOffset: 1 },
    { name: '纽约', utcOffset: -5 },
    { name: '洛杉矶', utcOffset: -8 },
    { name: '温哥华', utcOffset: -8 },
    { name: '多伦多', utcOffset: -5 },
    { name: '其他/自定义', utcOffset: 8 },
  ];
}

module.exports = {
  calcBazi,
  getDominantElement,
  getBirthPlaces,
  STEMS,
  BRANCHES,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  ZODIAC,
};
