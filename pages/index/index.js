// pages/index/index.js
Page({
  data: {
    // 页面基础数据
    todayDate: '',
    todayTotal: 0,
    todayTotalColor: '#667eea',
    dailyBudget: 200, // 默认日预算
    showBudgetModal: false,
    tempBudget: '',
    budgetProgress: 0,
    dailyAverage: 50,
    
    // 账单数据
    bills: [],
    groupedBills: [],
    isBillExpanded: false,
    
    // 连续记账
    consecutiveDays: 0,
    showConsecutiveBadge: false,
    
    // 语音相关
    isRecording: false,
    recordingTime: 0,
    showResult: false,
    showMultipleResult: false,
    multipleBills: [],
    aiResult: {
      category: '',
      merchant: '无',
      amount: 0,
      emotion_summary: '',
      originalText: ''
    },
    showManualInput: false,
    manualInputText: '',
    manualAmount: '', // 手动输入的金额
    
    // 零浪费日
    isZeroWasteDay: false,
    
    // 加载状态
    loading: false,
    
    // 呼吸动画
    breathingClass: 'breathing',
    breathingAnim: {},
    
    // WXML 中使用的字段
    themeClass: '',
    showBackupButtons: false,
    debugMode: false,
    autoFocusManualInput: true,
    showPermissionModal: false,
    showHelpTip: false
  },

  onLoad() {
    console.log('页面加载，初始化语音记账功能')
    this.initData()
    this.loadTodayBills()
    this.checkConsecutiveDays()
    this.startBreathingAnimation()
  },

  onShow() {
    this.loadTodayBills()
    this.checkTheme()
  },

  // 初始化基础数据
  initData() {
    const date = new Date()
    const todayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    // 从缓存读取预算
    const storedBudget = wx.getStorageSync('dailyBudget');
    
    this.setData({
      todayDate: todayStr,
      todayTotal: this.data.todayTotal !== undefined ? this.data.todayTotal : 0,
      dailyBudget: storedBudget || 200
    })
  },

  // 加载今日账单（云数据库+本地降级）
  async loadTodayBills() {
    // 如果已经在加载，直接返回
    if (this.data.loading) return;
    
    this.setData({ loading: true })
    
    try {
      // 暂时使用本地数据，避免云数据库集合不存在的错误
      console.log('使用本地账单数据');
      this.loadLocalBills();
      
    } catch (error) {
      console.error('加载云账单失败，降级到本地:', error)
      this.loadLocalBills()
    } finally {
      // 确保 loading 状态被重置
      wx.nextTick(() => {
        this.setData({ loading: false })
      })
    }
  },

  // 降级加载本地账单
  loadLocalBills() {
    try {
      const allBills = wx.getStorageSync('bills') || []
      const today = new Date().toISOString().split('T')[0]
      const bills = allBills.filter(bill => bill.date === today)
      const total = bills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
      
      const grouped = this.groupBillsByCategory(bills)
      const isZeroWasteDay = bills.length === 0
      
      const dailyBudget = this.data.dailyBudget || 200
      const progress = Math.min(Math.round((total / dailyBudget) * 100), 100)
      const overAmount = (total - dailyBudget).toFixed(2)
      const isOverBudget = total > dailyBudget
      
      let totalColor = '#ffcc33' // 黄色，正常
      if (isOverBudget) {
        totalColor = '#ff7070' // 粉红，超支
      } else if (total > dailyBudget * 0.8) {
        totalColor = '#202124' // 深灰，接近
      }

      this.setData({
        bills: bills,
        groupedBills: grouped,
        todayTotal: total.toFixed(2),
        todayTotalColor: totalColor,
        budgetProgress: progress,
        overAmount: overAmount,
        isOverBudget: isOverBudget,
        isZeroWasteDay: isZeroWasteDay,
        loading: false
      })
      
      console.log('本地账单加载完成，总金额:', total)
    } catch (error) {
      console.error('加载本地账单失败:', error)
      this.setData({ loading: false })
    }
  },

  // 按分类分组账单（增强版）
  groupBillsByCategory(bills) {
    const groups = {}
    
    bills.forEach(bill => {
      const category = bill.category || '其他'
      if (!groups[category]) {
        groups[category] = {
          category: category,
          total: 0,
          bills: [],
          expanded: true // 默认展开
        }
      }
      
      // 确保金额是数字
      const amount = parseFloat(bill.amount) || 0
      groups[category].total = parseFloat((groups[category].total + amount).toFixed(2))
      groups[category].bills.push({
        ...bill, 
        amount: amount,
        x: 0 // 用于左滑删除
      })
    })
    
    return Object.values(groups)
  },

  // 切换分类展开/折叠
  toggleCategory(e) {
    const { index } = e.currentTarget.dataset;
    const groupedBills = this.data.groupedBills;
    groupedBills[index].expanded = !groupedBills[index].expanded;
    this.setData({ groupedBills });
  },

  // 左滑删除相关的触摸处理
  onTouchStart(e) {
    this.startX = e.touches[0].pageX;
  },

  onTouchEnd(e) {
    const { gidx, bidx } = e.currentTarget.dataset;
    const endX = e.changedTouches[0].pageX;
    const distance = this.startX - endX;
    
    const groupedBills = this.data.groupedBills;
    const bill = groupedBills[gidx].bills[bidx];
    
    if (distance > 50) {
      // 左滑超过50px，显示删除按钮
      bill.x = -140; 
    } else {
      // 否则恢复原位
      bill.x = 0;
    }
    
    this.setData({ groupedBills });
  },

  // 检查连续记账天数
  checkConsecutiveDays() {
    try {
      const record = wx.getStorageSync('consecutiveDaysRecord') || {
        count: 0,
        lastDate: ''
      };
      
      const today = new Date().toDateString();
      const lastDate = record.lastDate ? new Date(record.lastDate).toDateString() : '';
      
      // 如果今天已经记录过，直接返回
      if (lastDate === today) {
        this.setData({
          consecutiveDays: record.count,
          showConsecutiveBadge: record.count > 0
        });
        return;
      }
      
      // 计算昨天的日期
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      let consecutiveDays = record.count;
      
      // 如果上次记录是昨天，连续天数+1；否则重置为1
      if (lastDate === yesterdayStr) {
        consecutiveDays += 1;
      } else {
        consecutiveDays = 1;
      }
      
      // 更新记录
      wx.setStorageSync('consecutiveDaysRecord', {
        count: consecutiveDays,
        lastDate: today
      });
      
      this.setData({
        consecutiveDays: consecutiveDays,
        showConsecutiveBadge: consecutiveDays > 0
      });
      
      this.checkAchievements(consecutiveDays);
      
    } catch (error) {
      console.error('检查连续天数失败:', error);
    }
  },

  // 检查并解锁成就
  checkAchievements(days) {
    const achievements = {
      3: '记账新手',
      7: '记账达人',
      30: '记账大师',
      100: '记账王者'
    };
    
    if (achievements[days]) {
      this.unlockAchievement(achievements[days]);
    }
  },

  // 解锁成就并奖励虚拟币
  unlockAchievement(title) {
    const myAchievements = wx.getStorageSync('myAchievements') || [];
    if (!myAchievements.includes(title)) {
      myAchievements.push(title);
      wx.setStorageSync('myAchievements', myAchievements);
      
      wx.showToast({
        title: `成就解锁：${title}`,
        icon: 'success',
        duration: 2000
      });
      
      this.rewardCoins(5);
    }
  },

  // 奖励虚拟币
  rewardCoins(amount) {
    let coins = wx.getStorageSync('virtualCoins') || 0;
    coins += amount;
    wx.setStorageSync('virtualCoins', coins);
  },

  // ========== 语音录音核心功能 ==========
  
  // 按住开始录音
  onRecordTouchStart(e) {
    console.log('触摸开始，准备录音');
    
    // 立即震动反馈，提升灵敏度感知
    wx.vibrateShort();

    // 如果正在录音，直接返回
    if (this.data.isRecording) {
      return;
    }

    this.shouldStopImmediately = false; // 重置立即停止标志
    
    // 清除之前的定时器
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    
    // 先检查录音权限
    this.checkRecordAuth().then(auth => {
      if (auth) {
        // 如果在检查权限期间用户已经松开了手，就不启动录音
        if (this.shouldStopImmediately) {
          console.log('检查权限完成，但用户已松手，放弃启动录音');
          return;
        }
        // 立即开始录音
        this.startRecording();
      } else {
        wx.showToast({
          title: '需要麦克风权限',
          icon: 'error'
        });
      }
    });
  },

  // 松开停止录音
  onRecordTouchEnd(e) {
    console.log('触摸结束，停止录音');
    this.shouldStopImmediately = true; // 标记应该立即停止
    
    // 清除延迟定时器
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    
    // 强制停止录音（无论状态如何）
    this.stopRecording();
  },

  // 手指移出按钮，取消录音
  onRecordTouchCancel(e) {
    console.log('触摸取消，取消录音');
    
    // 清除延迟定时器
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    
    this.cancelRecording();
  },

  // 开始录音（核心逻辑）
  startRecording() {
    // 容错：避免重复录音
    if (this.data.isRecording) return;
    
    console.log('正式开始录音');
    
    // 停止呼吸动画
    this.stopBreathingAnimation();
    
    // 更新录音状态
    this.setData({ 
      isRecording: true,
      breathingClass: ''
    });
    
    // 启动录音计时器
    this.recordingTimer = setInterval(() => {
      this.setData({
        recordingTime: this.data.recordingTime + 1
      });
    }, 1000);
    
    // 初始化录音管理器（单例模式）
    if (!this.recorderManager) {
      this.recorderManager = wx.getRecorderManager();
      
      // 录音开始回调
      this.recorderManager.onStart(() => {
        console.log('录音管理器启动成功');
        wx.vibrateShort(); // 震动反馈
      });
      
      // 录音停止回调
      this.recorderManager.onStop(async (res) => {
        console.log('录音管理器停止，处理结果');
        await this.handleRealRecordResult(res);
      });
      
      // 录音错误回调
      this.recorderManager.onError((error) => {
        console.error('录音失败:', error);
        clearInterval(this.recordingTimer);
        this.setData({ 
          isRecording: false,
          recordingTime: 0,
          breathingClass: 'breathing'
        });
        
        this.startBreathingAnimation();
        
        wx.showToast({
          title: '录音失败，请重试',
          icon: 'error'
        });
      });
    }
    
    // 开始录音（参数匹配腾讯云ASR 16k_zh模型）
    // 降低比特率以减小文件体积，加快上传速度
    this.recorderManager.start({
      duration: 120000,   // 最长120秒 (2分钟)
      sampleRate: 16000,  // 16k采样率
      numberOfChannels: 1,// 单声道
      encodeBitRate: 24000,// 降为24k，文件减小一半，识别依然准确
      format: 'mp3',
      frameSize: 50
    });
  },

  // 停止录音
  stopRecording() {
    console.log('执行停止录音，当前状态:', this.data.isRecording);
    
    // 强制停止录音管理器（无论状态如何）
    if (this.recorderManager) {
      try {
        this.recorderManager.stop();
        console.log('录音管理器已停止');
      } catch (e) {
        console.error('停止录音管理器失败:', e);
      }
    }
    
    // 清除计时器
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    
    // 重置录音状态
    this.setData({ 
      isRecording: false,
      recordingTime: 0,
      breathingClass: 'breathing'
    });
    
    // 重启呼吸动画
    this.startBreathingAnimation();
  },

  // 取消录音
  cancelRecording() {
    console.log('执行取消录音');
    if (this.recorderManager && this.data.isRecording) {
      this.recorderManager.stop();
      clearInterval(this.recordingTimer);
      
      this.setData({ 
        isRecording: false,
        recordingTime: 0,
        breathingClass: 'breathing'
      });
      
      this.startBreathingAnimation();
      
      wx.showToast({
        title: '已取消录音',
        icon: 'none'
      });
    }
  },

  // 处理录音结果（转文字+AI解析）
  async handleRealRecordResult(recordResult) {
    const { tempFilePath } = recordResult;
    
    if (!tempFilePath) {
      wx.showToast({
        title: '录音文件为空',
        icon: 'error'
      });
      this.setData({ loading: false });
      return;
    }

    // 检查录音时长，避免空识别
    if (this.data.recordingTime < 1 && !this.data.isRecording) {
        // 如果录音时间不到1秒，通常是误触
        console.log('录音时间太短');
    }
    
    this.setData({ loading: true });
    
    try {
      console.log('读取音频文件为Base64，文件路径:', tempFilePath);
      // 改为读取 Base64，避免 ArrayBuffer 在云函数传输中的序列化问题
      const base64Data = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res) => {
            console.log('文件读取成功，长度:', res.data.length);
            resolve(res.data);
          },
          fail: (err) => {
            console.error('读取文件失败:', err);
            reject(err);
          }
        })
      });
      
      // 调用语音转文字云函数
      console.log('调用voiceToText云函数，格式: mp3');
      const textRes = await wx.cloud.callFunction({
        name: 'voiceToText',
        data: {
          buffer: base64Data, // 发送 Base64 字符串
          voiceFormat: 'mp3'
        }
      });
      
      console.log('语音识别结果:', textRes.result);
      
      if (textRes.result && textRes.result.success) {
        const recognizedText = textRes.result.text?.trim() || '';
        if (!recognizedText) {
          this.setData({ loading: false });
          wx.showToast({ title: '识别结果为空', icon: 'error' });
          this.showManualInput('');
          return;
        }
        
        // 处理语音识别结果
        this.processVoiceResult(recognizedText);
        
      } else {
        this.setData({ loading: false });
        const errorMsg = textRes.result?.error || '语音识别失败';
        wx.showToast({ title: errorMsg, icon: 'error' });
        this.showManualInput('');
      }
      
    } catch (error) {
      console.error('处理录音失败:', error);
      this.setData({ loading: false });
      
      let errorMsg = '系统繁忙，请重试';
      if (error.errCode === -404011) errorMsg = '云函数未部署';
      if (error.errCode === -501002) errorMsg = '网络连接失败';
      if (error.errCode === -1) errorMsg = '读取音频文件失败';
      
      wx.showToast({ title: errorMsg, icon: 'error' });
      this.showManualInput('');
    }
  },

  // 处理语音识别结果
  processVoiceResult(text) {
    console.log('处理语音识别结果:', text);
    
    if (!text || text.trim() === '') {
      wx.showToast({
        title: '没有识别到语音',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      loading: true
    });
    
    // 调用云函数进行AI解析
    wx.cloud.callFunction({
      name: 'aiParseText',
      data: {
        text: text
      },
      config: {
        timeout: 20000 // 前端也明确指定 20 秒超时
      }
    }).then(res => {
      console.log('=== 云函数返回 ===');
      console.log('完整返回:', JSON.stringify(res, null, 2));
      console.log('res.result:', res.result);
      
      if (!res.result) {
        throw new Error('云函数返回为空');
      }
      
      if (res.result.success === false) {
        console.error('云函数返回失败:', res.result.error);
        throw new Error(res.result.error || 'AI解析失败');
      }
      
      if (res.result && res.result.success) {
        const aiData = res.result.data;
        console.log('AI解析数据:', JSON.stringify(aiData, null, 2));
        
        // 判断是多笔账单还是单笔账单
        if (aiData.bills && Array.isArray(aiData.bills)) {
          if (aiData.bills.length > 1) {
            // 多笔账单：批量保存
            console.log('检测到多笔账单，数量:', aiData.bills.length);
            this.handleMultipleBills(aiData.bills, text);
          } else if (aiData.bills.length === 1) {
            // 单笔账单（从多笔解析结果中提取）
            console.log('检测到单笔账单（从bills数组）');
            const bill = aiData.bills[0];
            const amount = parseFloat(bill.amount) || 0;
            
            if (amount <= 0) {
              throw new Error('金额无效: ' + bill.amount);
            }
            
            this.setData({
              aiResult: {
                category: bill.category || '其他',
                merchant: bill.merchant || '无',
                amount: amount,
                emotion_summary: bill.emotion_summary || '📝 记账成功',
                originalText: bill.originalText || text,
                date: this.data.todayDate,
                timestamp: bill.timestamp || Date.now()
              },
              showResult: true,
              loading: false
            });
          } else {
            throw new Error('bills数组为空');
          }
        } else if (aiData.category && aiData.amount !== undefined) {
          // 单笔账单（旧格式兼容）
          console.log('检测到单笔账单（旧格式）');
          const amount = parseFloat(aiData.amount) || 0;
          
          if (amount <= 0) {
            throw new Error('金额无效: ' + aiData.amount);
          }
          
          this.setData({
            aiResult: {
              category: aiData.category || '其他',
              merchant: aiData.merchant || '无',
              amount: amount,
              emotion_summary: aiData.emotion_summary || '📝 记账成功',
              originalText: aiData.originalText || text,
              date: aiData.date || this.data.todayDate,
              timestamp: aiData.timestamp || Date.now()
            },
            showResult: true,
            loading: false
          });
        } else {
          console.error('无法识别的数据格式:', aiData);
          throw new Error('AI返回的数据格式不正确，缺少必要字段');
        }
        
        console.log('设置后的aiResult:', this.data.aiResult);
      } else {
        throw new Error(res.result?.error || 'AI解析失败，success字段为false');
      }
    }).catch(err => {
      console.error('=== 调用AI解析失败 ===');
      console.error('错误对象:', err);
      console.error('错误消息:', err.message);
      console.error('错误堆栈:', err.stack);
      
      // 显示详细的错误信息
      let errorMsg = '解析失败';
      if (err.message) {
        errorMsg = err.message;
        // 限制错误信息长度
        if (errorMsg.length > 20) {
          errorMsg = errorMsg.substring(0, 20) + '...';
        }
      }
      
      wx.showModal({
        title: '解析失败',
        content: `错误信息: ${err.message || '未知错误'}\n\n请检查控制台日志获取详细信息`,
        showCancel: false,
        confirmText: '知道了'
      });
      
      this.setData({
        loading: false,
        showManualInput: true,
        manualInputText: text
      });
    });
  },

  // 检查录音权限
  checkRecordAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          console.log('权限状态:', res.authSetting);
          if (res.authSetting['scope.record'] === undefined) {
            // 第一次使用，发起系统授权
            wx.authorize({
              scope: 'scope.record',
              success: () => {
                console.log('用户点击同意授权');
                resolve(true);
              },
              fail: () => {
                console.log('用户点击拒绝授权');
                this.setData({ showPermissionModal: true });
                resolve(false);
              }
            });
          } else if (res.authSetting['scope.record'] === false) {
            // 之前拒绝过，显示自定义弹窗引导去设置
            this.setData({ showPermissionModal: true });
            resolve(false);
          } else {
            // 已授权
            resolve(true);
          }
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  },

  // 触摸移动处理
  onTouchMove(e) {
    console.log('触摸移动');
    // 防止页面滚动
    // 不需要 e.preventDefault() 或 e.stopPropagation()
  },

  // 点击语音按钮（已禁用弹窗，避免干扰触摸事件）
  onTapVoiceButton(e) {
    console.log('点击语音按钮（已禁用提示）');
    // 不再显示提示弹窗，避免干扰触摸事件
  },

  // 打开设置后的回调
  onOpenSetting(e) {
    console.log('打开设置回调:', e.detail);
    if (e.detail.authSetting && e.detail.authSetting['scope.record']) {
      this.setData({ showPermissionModal: false });
      wx.showToast({
        title: '已授权录音权限',
        icon: 'success'
      });
    }
  },

  // 点击备用开始录音按钮
  onClickStartRecord() {
    console.log('点击备用开始录音按钮');
    this.checkRecordAuth().then(auth => {
      if (auth) {
        this.startRecording();
      }
    });
  },

  // 点击备用手动输入按钮
  onClickManualInput() {
    console.log('点击备用手动输入按钮');
    this.showManualInput('');
  },

  // 隐藏帮助提示
  hideHelpTip() {
    this.setData({ showHelpTip: false });
    wx.setStorageSync('hideHelpTip', true);
  },

  // 关闭权限弹窗
  closePermissionModal() {
    this.setData({ showPermissionModal: false });
  },

  // ========== 测试录音函数 ==========
  // 测试录音功能
  testRecord() {
    console.log('=== 开始录音测试 ===');
    
    // 测试权限
    wx.getSetting({
      success: (res) => {
        console.log('当前录音权限状态:', res.authSetting['scope.record']);
        
        if (!res.authSetting['scope.record']) {
          console.log('未授权录音权限');
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              console.log('授权成功');
              this.testRecordActual();
            },
            fail: (err) => {
              console.error('授权失败:', err);
              wx.showModal({
                title: '需要授权',
                content: '请在设置中开启录音权限',
                success: (res) => {
                  if (res.confirm) wx.openSetting();
                }
              });
            }
          });
        } else {
          console.log('已有录音权限');
          this.testRecordActual();
        }
      },
      fail: (err) => {
        console.error('获取设置失败:', err);
      }
    });
  },

  // 实际测试录音
  testRecordActual() {
    console.log('测试实际录音');
    
    const recorderManager = wx.getRecorderManager();
    
    recorderManager.onStart(() => {
      console.log('✅ 录音开始成功');
      wx.showToast({ title: '录音开始', icon: 'success' });
    });
    
    recorderManager.onStop((res) => {
      console.log('录音停止:', res);
      if (res.tempFilePath) {
        console.log('录音文件:', res.tempFilePath);
        wx.showToast({ title: '录音成功', icon: 'success' });
      } else {
        console.error('录音文件为空');
        wx.showToast({ title: '录音失败', icon: 'error' });
      }
    });
    
    recorderManager.onError((error) => {
      console.error('录音错误:', error);
      wx.showToast({ title: '录音错误', icon: 'error' });
    });
    
    // 开始录音
    recorderManager.start({
      duration: 3000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'mp3',
      frameSize: 50
    });
    
    // 3秒后自动停止
    setTimeout(() => {
      recorderManager.stop();
    }, 3000);
  },

  // ========== 调试功能 ==========
  
  // 测试录音权限
  testVoicePermission() {
    this.checkRecordAuth().then(auth => {
      wx.showToast({
        title: auth ? '已有录音权限' : '无录音权限',
        icon: auth ? 'success' : 'none'
      });
    });
  },

  // 测试录音功能
  testVoiceRecord() {
    console.log('测试录音功能');
    // 模拟录音过程
    this.setData({ loading: true });
    
    setTimeout(() => {
      const mockResult = {
        category: '餐饮-奶茶',
        merchant: '霸王茶姬',
        amount: 18.5,
        emotion_summary: '🧋 霸王茶姬奶茶get！消费18.5元',
        originalText: '喝了霸王茶姬18块5'
      };
      
      this.setData({
        aiResult: mockResult,
        showResult: true,
        loading: false
      });
    }, 1500);
  },

  // 切换调试模式
  toggleDebugMode() {
    const newDebugMode = !this.data.debugMode;
    this.setData({ 
      debugMode: newDebugMode,
      showBackupButtons: newDebugMode // 调试模式下显示备用按钮
    });
    
    wx.showToast({
      title: newDebugMode ? '调试模式开启' : '调试模式关闭',
      icon: 'none'
    });
  },

  // ========== 账单操作功能 ==========
  
  // 显示手动输入框
  showManualInput(defaultText) {
    this.setData({
      showManualInput: true,
      manualInputText: defaultText || ''
    });
  },

  // 处理多笔账单
  async handleMultipleBills(bills, originalText) {
    console.log('检测到多笔账单，进入确认弹窗');
    const multipleBills = bills.map((bill, index) => ({
      id: index,
      category: bill.category || '其他',
      merchant: bill.merchant || '无',
      amount: bill.amount,
      emotion_summary: bill.emotion_summary || '📝 记账成功',
      originalText: bill.originalText || originalText,
      selected: true
    }));
    
    this.setData({
      multipleBills: multipleBills,
      showMultipleResult: true,
      loading: false
    });
  },

  // 确认多笔账单保存
  async confirmMultipleBills() {
    const selectedBills = this.data.multipleBills.filter(b => b.selected);
    if (selectedBills.length === 0) {
      wx.showToast({ title: '请至少选择一笔', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      for (const bill of selectedBills) {
        const billData = {
          category: bill.category,
          merchant: bill.merchant,
          amount: parseFloat(bill.amount) || 0,
          emotion_summary: bill.emotion_summary,
          originalText: bill.originalText,
          date: this.data.todayDate,
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          _id: 'bill_' + Date.now() + Math.random().toString(36).substr(2, 5)
        };
        await this.saveBillToCloud(billData);
      }
      
      this.setData({ showMultipleResult: false, loading: false });
      wx.showToast({ title: `成功记入 ${selectedBills.length} 笔`, icon: 'success' });
    } catch (e) {
      console.error('多笔保存失败:', e);
      this.setData({ loading: false });
    }
  },

  // 更新单笔 AI 结果字段
  updateAiField(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`aiResult.${field}`]: field === 'amount' ? value : value
    });
  },

  // 更新多笔账单中的字段
  updateMultipleBillField(e) {
    const { index, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const multipleBills = this.data.multipleBills;
    multipleBills[index][field] = value;
    this.setData({ multipleBills });
  },

  // 切换多笔账单的选择状态
  toggleMultipleBillSelection(e) {
    const { index } = e.currentTarget.dataset;
    const multipleBills = this.data.multipleBills;
    multipleBills[index].selected = !multipleBills[index].selected;
    this.setData({ multipleBills });
  },

  // 关闭多笔结果弹窗
  closeMultipleResult() {
    this.setData({
      showMultipleResult: false,
      multipleBills: []
    });
  },

  // 确认AI解析结果并保存账单
  async confirmAIResult() {
    const aiResult = this.data.aiResult;
    const manualAmount = this.data.manualAmount;
    
    console.log('确认记账，原始数据:', aiResult);
    console.log('手动金额:', manualAmount);
    
    // 如果手动输入了金额，使用手动金额
    let finalAmount = aiResult.amount;
    if (manualAmount && parseFloat(manualAmount) > 0) {
      finalAmount = parseFloat(manualAmount);
    }
    
    console.log('最终金额:', finalAmount);
    
    // 检查金额是否有效
    if (finalAmount <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }
    
    // 创建账单数据
    const billData = {
      category: aiResult.category,
      merchant: aiResult.merchant,
      amount: finalAmount,
      emotion_summary: aiResult.emotion_summary,
      originalText: aiResult.originalText,
      date: aiResult.date || this.data.todayDate,
      time: new Date().toLocaleTimeString('zh-CN', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      timestamp: Date.now(),
      _id: 'bill_' + Date.now()
    };
    
    console.log('准备保存的账单数据:', billData);
    
    // 保存账单
    this.saveBillToCloud(billData).then(() => {
      console.log('账单保存成功');
      
      // 关闭弹窗
      this.closeResult();
      
      wx.showToast({
        title: '记账成功！',
        icon: 'success',
        duration: 2000
      });
      
    }).catch(err => {
      console.error('保存失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    });
  },

  // 编辑AI解析结果（转手动输入）
  editAIResult() {
    this.setData({
      showManualInput: true,
      manualInputText: this.data.aiResult.originalText || '',
      showResult: false
    });
  },

  // 确认手动输入并保存
  async confirmManualInput() {
    const text = this.data.manualInputText;
    if (!text.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'error' });
      return;
    }
    
    this.closeManualInput();
    this.processVoiceResult(text);
  },

  // 手动输入金额
  onAmountInput: function(e) {
    const value = e.detail.value;
    console.log('手动输入金额:', value);
    
    // 只允许输入数字和小数点
    const cleanedValue = value.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleanedValue) || 0;
    
    this.setData({
      manualAmount: cleanedValue,
      'aiResult.amount': amount
    });
    
    console.log('更新后的AI结果金额:', this.data.aiResult.amount);
  },

  // 保存账单到云数据库（同步本地）
  async saveBillToCloud(billData) {
    try {
      const db = wx.cloud.database();
      
      // 补充完整账单数据
      const completeBill = {
        ...billData,
        amount: parseFloat(billData.amount) || 0, // 确保金额是数字
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString('zh-CN', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        date: this.data.todayDate
      };
      
      // 保存到云数据库
      const res = await db.collection('bills').add({
        data: {
          ...completeBill,
          createdAt: db.serverDate()
        }
      });
      
      console.log('云数据库保存成功:', res);
      
      // 使用云数据库生成的ID
      completeBill._id = res._id;
      
      // 同步到本地缓存
      this.saveToLocal(completeBill);
      
      // 更新连续记账记录
      this.updateConsecutiveRecord();
      
      // 关键修复：立即更新页面数据
      await this.updatePageData(completeBill);
      
      return { success: true };
      
    } catch (error) {
      console.error('云数据库保存失败:', error);
      
      // 云数据库失败，尝试仅保存到本地
      try {
        console.log('尝试仅保存到本地');
        const localBill = {
          ...billData,
          _id: 'local_' + Date.now(),
          amount: parseFloat(billData.amount) || 0, // 确保金额是数字
          timestamp: Date.now(),
          time: new Date().toLocaleTimeString('zh-CN', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          date: this.data.todayDate
        };
        
        this.saveToLocal(localBill);
        await this.updatePageData(localBill);
        
        console.log('本地保存成功');
        return { success: true, isLocalOnly: true };
        
      } catch (localError) {
        console.error('本地保存也失败:', localError);
        return { success: false, error: localError.message };
      }
    }
  },

  // 新增：更新页面数据
  async updatePageData(newBill) {
    return new Promise((resolve) => {
      console.log('更新页面数据，新账单:', newBill);
      console.log('新账单金额:', newBill.amount);
      console.log('新账单金额类型:', typeof newBill.amount);
      
      // 确保金额是数字
      const amount = parseFloat(newBill.amount) || 0;
      
      // 获取当前账单并添加新账单（放在最前面）
      const updatedBills = [{...newBill, amount: amount}, ...this.data.bills];
      
      // 重新分组
      const updatedGroupedBills = this.groupBillsByCategory(updatedBills);
      
      // 重新计算总额
      const newTotal = parseFloat(updatedBills.reduce((sum, bill) => {
        return sum + (parseFloat(bill.amount) || 0);
      }, 0).toFixed(2));
      
      // 计算预算进度
      const dailyBudget = this.data.dailyBudget || 200;
      const progress = Math.min(Math.round((newTotal / dailyBudget) * 100), 100);
      const overAmount = (newTotal - dailyBudget).toFixed(2);
      const isOverBudget = newTotal > dailyBudget;
      
      // 更新今日总额颜色
      let color = '#ffcc33'; // 黄色
      if (isOverBudget) {
        color = '#ff7070'; // 粉红
      } else if (newTotal > dailyBudget * 0.8) {
        color = '#202124'; // 深灰
      }
      
      // 更新页面
      this.setData({
        bills: updatedBills,
        groupedBills: updatedGroupedBills,
        todayTotal: newTotal.toFixed(2),
        todayTotalColor: color,
        budgetProgress: progress,
        overAmount: overAmount,
        isOverBudget: isOverBudget,
        isZeroWasteDay: updatedBills.length === 0,
        isBillExpanded: true
      }, () => {
        resolve();
      });
    });
  },

  // 保存账单到本地缓存
  saveToLocal(bill) {
    try {
      // 验证账单数据
      if (!bill || typeof bill !== 'object') {
        console.error('无效的账单数据');
        return;
      }
      
      // 确保必要字段存在
      const validBill = {
        _id: bill._id || 'local_' + Date.now(),
        category: bill.category || '其他',
        merchant: bill.merchant || '无',
        amount: parseFloat(bill.amount) || 0, // 确保金额是数字
        date: bill.date || this.data.todayDate,
        emotion_summary: bill.emotion_summary || '',
        timestamp: bill.timestamp || Date.now(),
        originalText: bill.originalText || '',
        time: bill.time || new Date().toLocaleTimeString('zh-CN', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
      
      const allBills = wx.getStorageSync('bills') || [];
      
      // 修复：检查是否已存在相同ID的账单
      const existingIndex = allBills.findIndex(b => b._id === validBill._id);
      if (existingIndex >= 0) {
        // 更新已有账单
        allBills[existingIndex] = validBill;
      } else {
        // 添加新账单到开头（最新的在前面）
        allBills.unshift(validBill);
      }
      
      // 限制本地存储数量（例如最近100条）
      if (allBills.length > 100) {
        allBills.splice(100); // 只保留前100条
      }
      
      wx.setStorageSync('bills', allBills);
      console.log('本地保存成功，当前数量:', allBills.length);
      
    } catch (error) {
      console.error('保存到本地失败:', error);
    }
  },

  // 更新连续记账记录
  updateConsecutiveRecord() {
    const today = new Date().toDateString();
    const record = wx.getStorageSync('consecutiveDaysRecord') || {
      count: 0,
      lastDate: ''
    };
    
    if (record.lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      record.count = record.lastDate === yesterday.toDateString() ? record.count + 1 : 1;
      record.lastDate = today;
      
      wx.setStorageSync('consecutiveDaysRecord', record);
    }
    
    this.checkConsecutiveDays();
  },

  // 删除账单
  async deleteBill(e) {
    const { id, gidx, bidx } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 尝试从云数据库删除（如果有云ID）
            if (id && !id.startsWith('local_')) {
              try {
                await wx.cloud.database().collection('bills').doc(id).remove();
              } catch (cloudError) {
                console.warn('云数据库删除失败:', cloudError);
              }
            }
            
            // 从本地存储删除
            const allBills = wx.getStorageSync('bills') || [];
            const updatedBills = allBills.filter(bill => bill._id !== id);
            wx.setStorageSync('bills', updatedBills);
            
            // 重新加载本地数据并刷新页面
            this.loadLocalBills();
            
            wx.showToast({ title: '已删除', icon: 'success' });
          } catch (error) {
            console.error('删除账单失败:', error);
          }
        } else {
          // 如果取消，恢复原位
          const groupedBills = this.data.groupedBills;
          groupedBills[gidx].bills[bidx].x = 0;
          this.setData({ groupedBills });
        }
      }
    });
  },

  // ========== 动画与辅助功能 ==========
  
  // 启动呼吸动画
  startBreathingAnimation() {
    this.stopBreathingAnimation();
    
    this.breathingAnimation = wx.createAnimation({
      duration: 2000,
      timingFunction: 'ease-in-out'
    });
    
    const animate = () => {
      this.breathingAnimation.scale(1.03).step();
      this.breathingAnimation.scale(1).step({ duration: 2000 });
      
      this.setData({
        breathingAnim: this.breathingAnimation.export()
      });
      
      this.breathingTimer = setTimeout(animate, 4000);
    };
    
    animate();
  },

  // 停止呼吸动画
  stopBreathingAnimation() {
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer);
      this.breathingTimer = null;
    }
  },

  // 检查并应用主题
  checkTheme() {
    const theme = wx.getStorageSync('currentTheme') || 'default';
    this.applyTheme(theme);
  },

  // 应用主题（可扩展）
  applyTheme(theme) {
    console.log('应用主题:', theme);
    let themeClass = '';
    switch(theme) {
      case 'dark':
        themeClass = 'dark-theme';
        break;
      case 'light':
        themeClass = 'light-theme';
        break;
      default:
        themeClass = '';
    }
    this.setData({ themeClass });
  },

  // 展开/折叠账单
  toggleBillExpand() {
    this.setData({
      isBillExpanded: !this.data.isBillExpanded
    });
  },

  // 预算设置相关
  openBudgetModal() {
    this.setData({
      showBudgetModal: true,
      tempBudget: this.data.dailyBudget
    });
  },

  closeBudgetModal() {
    this.setData({
      showBudgetModal: false
    });
  },

  onBudgetInput(e) {
    this.setData({
      tempBudget: e.detail.value
    });
  },

  saveBudget() {
    const newBudget = parseFloat(this.data.tempBudget);
    if (isNaN(newBudget) || newBudget <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    wx.setStorageSync('dailyBudget', newBudget);
    this.setData({
      dailyBudget: newBudget,
      showBudgetModal: false
    }, () => {
      // 重新计算进度和颜色
      this.loadLocalBills();
      wx.showToast({ title: '设置成功', icon: 'success' });
    });
  },

  // 页面跳转
  navigateTo(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({ url });
    }
  },

  // 关闭结果弹窗
  closeResult() {
    this.setData({
      showResult: false,
      aiResult: {
        category: '',
        merchant: '无',
        amount: 0,
        emotion_summary: '',
        originalText: ''
      },
      manualAmount: ''
    });
  },

  // 关闭手动输入弹窗
  closeManualInput() {
    this.setData({
      showManualInput: false,
      manualInputText: ''
    });
  },

  // 手动输入内容变化
  onManualInput(e) {
    this.setData({
      manualInputText: e.detail.value
    });
  },

  // 显示连续记账徽章详情
  showBadgeDetail() {
    wx.showModal({
      title: '连续记账成就',
      content: `你已经连续记账 ${this.data.consecutiveDays} 天！\n\n奖励机制：\n• 每日记账：+2虚拟币\n• 连续7天：+5虚拟币\n• 成就解锁：+5虚拟币`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // ========== 页面生命周期 ==========
  
  onUnload() {
    this.stopBreathingAnimation();
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.recordTimer) clearTimeout(this.recordTimer);
    
    if (this.recorderManager && this.data.isRecording) {
      this.recorderManager.stop();
    }
  },

  onHide() {
    this.onUnload();
  }
});