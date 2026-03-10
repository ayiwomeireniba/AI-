// mini program/app.js
App({
  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-8gfoyp4v10ef072a',
        traceUser: true,
      });
    }
    
    // 获取系统信息
    wx.getSystemInfo({
      success: e => {
        this.globalData.SystemInfo = e;
        this.globalData.CustomBar = e.statusBarHeight + 46;
      }
    });
  },
  
  globalData: {
    SystemInfo: null,
    CustomBar: null,
    userInfo: null
  }
});