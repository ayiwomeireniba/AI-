# AI 语音记账助手 (AI Voice Ledger)

一款基于微信小程序云开发、采用 iOS 极简风格设计的智能语音记账应用。通过 AI 技术，实现“说完即记”的极致体验。

---

## 界面预览

| 首页 (明细) | 统计报表 | 功能演示 |
| :---: | :---: | :---: |
| <img width="603" height="1311" alt="IMG_5239" src="https://github.com/user-attachments/assets/e7347d7c-a8b9-410b-8c98-5df376bde63e" />| <img width="603" height="1311" alt="IMG_5240" src="https://github.com/user-attachments/assets/1a50dd6a-b3ee-4f5c-9e1a-ed4675187ad4" />| ![语音输入](https://github.com/user-attachments/assets/c775f550-6982-4a9b-b6ad-8a93a98da409)|

---

## 核心特性

- **智能语音识别**: 仿微信长按录音交互，支持长达 2 分钟的连续语音输入。
- **AI 自动解析**: 接入大模型能力，自动识别语音中的分类、金额、商户信息，支持一句话记录多笔账单。
- **iOS 极简美学**:
  - 奶油色配色方案 (`#f2efe9`) 配以明黄色强调色。
  - 毛玻璃效果 (Glassmorphism) 与大圆角卡片设计。
- **动态数据可视化**: 集成 ECharts，提供月度支出占比饼图及每日消费趋势折线图。
- **预算管理**: 实时显示日预算进度，超支自动变色提醒（柔粉红警示）。
- **便捷交互**: 账单列表支持点击折叠分类，单行账单支持**左滑删除**。

---

## 技术栈

- **前端**: 微信小程序原生框架 (WXML / WXSS / JS)
- **后端**: 微信小程序云开发 (Cloud Development)
  - 云函数 (Node.js)
  - 云数据库 (NoSQL)
- **图表库**: [ECharts for WeChat](https://github.com/ecomfe/echarts-for-weixin)
- **AI 能力**: 腾讯云 ASR (语音转文字) + AI 文本解析大模型

---

## 快速开始

### 1. 克隆项目
```bash
git clone - https://github.com/ayiwomeireniba/AI-.git
```

### 2. 配置云开发环境
1. 在微信开发者工具中开通“云开发”。
2. 创建名为 `bills` 的集合（Collection）。
3. 部署 `cloudfunctions/` 目录下的所有云函数。

### 3. 安装依赖
1. 在 `miniprogram` 目录下执行 `npm install`。
2. 确保 `miniprogram/components/` 目录下已下载并放置 `ec-canvas` 文件夹。

### 4. 运行
在微信开发者工具中导入项目，点击“编译”即可预览。

---

## 📝 待办事项 (TODO)

- [ ] 集成更多 AI 模型以提升解析准确度
- [ ] 增加多账本协作功能
- [ ] 支持导出 Excel 报表

---

## 贡献者

- **Linyuhan** - *核心开发与设计* 

---
