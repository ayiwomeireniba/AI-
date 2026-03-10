// pages/stats/stats.js
import * as echarts from '../../components/ec-canvas/echarts';

Page({
  data: {
    selectedMonth: '',
    displayMonth: '',
    monthTotal: 0,
    dailyAvg: 0,
    isEchartsReady: false,
    
    // 图表配置对象
    ecPie: {
      lazyLoad: true
    },
    ecLine: {
      lazyLoad: true
    }
  },

  onLoad() {
    this.initMonth();
  },

  onShow() {
    this.loadStats();
  },

  // 初始化月份
  initMonth() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const selectedMonth = `${year}-${month}`;
    const displayMonth = `${year}年${month}月`;
    
    this.setData({
      selectedMonth,
      displayMonth
    });
  },

  // 月份切换
  onMonthChange(e) {
    const selectedMonth = e.detail.value;
    const [year, month] = selectedMonth.split('-');
    const displayMonth = `${year}年${month}月`;
    
    this.setData({
      selectedMonth,
      displayMonth
    }, () => {
      this.loadStats();
    });
  },

  // 加载统计数据
  loadStats() {
    const allBills = wx.getStorageSync('bills') || [];
    const selectedMonth = this.data.selectedMonth; // YYYY-MM
    
    // 过滤当月账单
    const monthBills = allBills.filter(bill => {
      return bill.date && bill.date.startsWith(selectedMonth);
    });
    
    // 计算总额
    const monthTotal = monthBills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
    
    // 计算日均
    const date = new Date();
    const [y, m] = selectedMonth.split('-').map(Number);
    let daysInMonth = new Date(y, m, 0).getDate();
    
    // 如果是当月，按已过去的天数算
    const now = new Date();
    const nowMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (selectedMonth === nowMonthStr) {
      daysInMonth = now.getDate();
    }
    const dailyAvg = (monthTotal / (daysInMonth || 1)).toFixed(2);
    
    this.setData({
      monthTotal: monthTotal.toFixed(2),
      dailyAvg: dailyAvg
    });
    
    // 获取组件实例并初始化
    this.initCharts(monthBills);
  },

  initCharts(bills) {
    // 饼图数据准备
    const categoryGroups = {};
    bills.forEach(bill => {
      const cat = bill.category || '其他';
      categoryGroups[cat] = (categoryGroups[cat] || 0) + (parseFloat(bill.amount) || 0);
    });
    const pieData = Object.keys(categoryGroups).map(name => ({
      name,
      value: categoryGroups[name].toFixed(2)
    }));

    // 折线图数据准备
    const dayGroups = {};
    bills.forEach(bill => {
      const day = bill.date.split('-')[2];
      dayGroups[day] = (dayGroups[day] || 0) + (parseFloat(bill.amount) || 0);
    });
    const [year, month] = this.data.selectedMonth.split('-');
    const lastDay = new Date(year, month, 0).getDate();
    const lineX = [];
    const lineY = [];
    for (let i = 1; i <= lastDay; i++) {
      const dayStr = String(i).padStart(2, '0');
      lineX.push(dayStr);
      lineY.push(dayGroups[dayStr] ? dayGroups[dayStr].toFixed(2) : 0);
    }

    // 获取饼图组件并初始化
    const pieComp = this.selectComponent('#pie-chart');
    if (pieComp) {
      pieComp.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        chart.setOption(this.getPieOption(pieData));
        return chart;
      });
    }

    // 获取折线图组件并初始化
    const lineComp = this.selectComponent('#line-chart');
    if (lineComp) {
      lineComp.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        chart.setOption(this.getLineOption(lineX, lineY));
        return chart;
      });
    }

    this.setData({ isEchartsReady: true });
  },

  // 饼图配置 (使用参考图配色)
  getPieOption(data) {
    return {
      backgroundColor: 'transparent',
      color: ['#ffcc33', '#202124', '#ff7070', '#8e8e93', '#e5e5e5'],
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data: data,
        label: {
          show: true,
          formatter: '{b}: {d}%',
          color: '#202124'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }]
    };
  },

  // 折线图配置 (使用参考图配色)
  getLineOption(xData, yData) {
    return {
      backgroundColor: 'transparent',
      grid: {
        top: '10%',
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#8e8e93' } },
        axisLabel: { color: '#8e8e93', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e5e5' } },
        axisLabel: { color: '#8e8e93' }
      },
      series: [{
        data: yData,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#ffcc33', width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
            offset: 0, color: 'rgba(255, 204, 51, 0.3)'
          }, {
            offset: 1, color: 'rgba(255, 204, 51, 0)'
          }])
        }
      }]
    };
  }
});
