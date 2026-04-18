const { calcBazi, getDominantElement, STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ZODIAC } = require('../../utils/bazi');

// Element → CSS class suffix
const ELEMENT_CLASS = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

Page({
  data: {
    bazi: null,
    fiveElements: null,
    dominantElement: '',
    birthInfo: '',
    yearStemClass: '',
    monthStemClass: '',
    dayStemClass: '',
    hourStemClass: '',
    stems: [],
    branches: [],
  },

  onLoad(options) {
    const {
      year, month, day, hour, minute, utcOffset, gender, place,
    } = options;

    const y = parseInt(year, 10);
    const mo = parseInt(month, 10);
    const d = parseInt(day, 10);
    const h = parseInt(hour, 10);
    const mi = parseInt(minute, 10);
    const tz = parseFloat(utcOffset);
    const genderLabel = gender === 'male' ? '男' : '女';

    try {
      const result = calcBazi({ year: y, month: mo, day: d, hour: h, minute: mi, utcOffset: tz });
      const dominant = getDominantElement(result.fiveElements);

      // Build birth info string
      const timeStr = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
      const birthInfo = `${y}年${mo}月${d}日 ${timeStr} · ${decodeURIComponent(place)} · ${genderLabel}`;

      // Build reference arrays for the footer table
      const stems = STEMS.map((char, i) => ({
        char,
        element: STEM_ELEMENT[i],
        yy: i % 2 === 0 ? '阳' : '阴',
      }));

      const branches = BRANCHES.map((char, i) => ({
        char,
        element: BRANCH_ELEMENT[i],
        zodiac: ZODIAC[i],
      }));

      this.setData({
        bazi: result,
        fiveElements: result.fiveElements,
        dominantElement: dominant,
        birthInfo,
        yearStemClass: 'stem-' + ELEMENT_CLASS[result.year.element],
        monthStemClass: 'stem-' + ELEMENT_CLASS[result.month.element],
        dayStemClass: 'stem-' + ELEMENT_CLASS[result.day.element],
        hourStemClass: 'stem-' + ELEMENT_CLASS[result.hour.element],
        stems,
        branches,
      });
    } catch (err) {
      wx.showModal({
        title: '计算错误',
        content: '八字计算时发生错误，请检查输入信息后重试。',
        showCancel: false,
        complete: () => wx.navigateBack(),
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
