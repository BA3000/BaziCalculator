const { getBirthPlaces } = require('../../utils/bazi');

const birthPlaces = getBirthPlaces();

Page({
  data: {
    birthday: '',
    birthTime: '12:00',
    birthPlaceIndex: 0,
    birthPlaceNames: birthPlaces.map(p => p.name),
    showCustomOffset: false,
    customUtcOffset: '8',
    gender: 'male',
  },

  onLoad() {
    // Default birthday to today
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    this.setData({ birthday: `${yyyy}-${mm}-${dd}` });
  },

  onBirthdayChange(e) {
    this.setData({ birthday: e.detail.value });
  },

  onBirthTimeChange(e) {
    this.setData({ birthTime: e.detail.value });
  },

  onBirthPlaceChange(e) {
    const index = parseInt(e.detail.value, 10);
    const isCustom = birthPlaces[index].name === '其他/自定义';
    this.setData({
      birthPlaceIndex: index,
      showCustomOffset: isCustom,
    });
  },

  onCustomOffsetInput(e) {
    this.setData({ customUtcOffset: e.detail.value });
  },

  selectMale() {
    this.setData({ gender: 'male' });
  },

  selectFemale() {
    this.setData({ gender: 'female' });
  },

  onSubmit() {
    const { birthday, birthTime, birthPlaceIndex, customUtcOffset, gender, showCustomOffset } = this.data;

    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }

    const [year, month, day] = birthday.split('-').map(Number);
    const [hour, minute] = (birthTime || '00:00').split(':').map(Number);

    let utcOffset;
    if (showCustomOffset) {
      utcOffset = parseFloat(customUtcOffset);
      if (isNaN(utcOffset) || utcOffset < -12 || utcOffset > 14) {
        wx.showToast({ title: '时区偏移值无效（-12 到 14）', icon: 'none' });
        return;
      }
    } else {
      utcOffset = birthPlaces[birthPlaceIndex].utcOffset;
    }

    wx.navigateTo({
      url: `/pages/result/result?year=${year}&month=${month}&day=${day}&hour=${hour}&minute=${minute}&utcOffset=${utcOffset}&gender=${gender}&place=${encodeURIComponent(birthPlaces[birthPlaceIndex].name)}`,
    });
  },
});
