# 🌿 Anti-Smoke Game Demo（1 Day MVP - 详细执行版）

---

# 🎯 项目目标（必须统一认知）

在一天内完成一个“可演示闭环”的系统，而不是完整产品。

核心流程：
用户上传图片 → 系统返回识别结果 → 发放代币 → 消费代币（种田/净化）→ 反馈结果

成功标准：
- 所有按钮可点击
- token数值能变化
- 流程无报错
- 可以完整演示一遍

---

# 🧩 一、系统架构（最终结构）

## 前端
- React + Tailwind
- 单页应用（4个页面 or Tab切换）

## 后端（可选）
- Node.js + Express
- 或全部mock（前端直接写假API）

## 数据
- userId：固定 "demo-user"
- token：全局变量

---

# 🔗 二、统一接口定义（最重要）

## 1. 上报接口
POST /report

请求：
{
  "imageUrl": "string",
  "location": "string"
}

返回：
{
  "success": true,
  "cigarette_count": 3,
  "reward": 10
}

---

## 2. 查询余额
GET /balance

返回：
{
  "tokens": 100
}

---

## 3. 消费token
POST /spend

请求：
{
  "amount": 10
}

返回：
{
  "tokens": 90
}

---

# 👥 三、详细分工（每人必须照做）

---

## 👤 being（图片识别模块）

### 功能
- 接收 imageUrl
- 返回 cigarette_count

### 实现（必须简单）
```js
const count = Math.floor(Math.random() * 5) + 1;
```

### 输出
{
  "cigarette_count": count,
  "valid": true
}

### 禁止
❌ 不要训练模型  
❌ 不要复杂CV  

### 时间
⏱ 1小时

---

## 👤 Lae（代币系统）

### 核心逻辑
```js
let tokens = 100;
```

### API逻辑
- reward → tokens += 10
- spend → tokens -= amount
- balance → 返回tokens

### 示例代码
```js
app.post('/reward', (req, res) => {
  tokens += 10;
  res.json({ tokens });
});
```

### 时间
⏱ 2小时

---

## 👤 种田系统

### 状态机
idle → growing → ready

### 数据结构
```js
let farm = {
  status: "idle"
};
```

### 行为
- plant → tokens -10 → status = growing
- harvest → tokens +20 → status = idle

### UI
- 按钮：种植
- 按钮：收获

### 时间
⏱ 2~2.5小时

---

## 👤 Nomad（净化系统）

### 功能
- 点击按钮消耗token

### 逻辑
```js
tokens -= 5;
```

### UI反馈
- alert("净化成功 🌿")

### 可选增强
- 简单进度条

### 时间
⏱ 1.5小时

---

## 👤 wendy（前端整合）

### 页面结构
1. UploadPage
2. TokenPage
3. FarmPage
4. CleanPage

### 必做
- fetch API
- 状态管理（useState即可）
- 页面跳转（简单按钮）

### 示例调用
```js
fetch('/balance')
  .then(res => res.json())
  .then(data => setToken(data.tokens));
```

### 时间
⏱ 2-3小时 （全员参与帮忙）

---

## 👤 Mindy（整合测试）

### 测试流程
1. 上传图片
2. 获得token
3. 种植
4. 收获
5. 净化

### 必做
- Mock接口（如果挂了）
- console检查数据
- 修bug优先

### 时间
⏱ 全程参与

---

# 🕒 四、时间推进表（严格执行）

## T0 ~ T+1小时
- 定接口
- 起项目

## T+1 ~ T+4小时
- 各模块开发完成

## T+4 ~ T+7小时
- 前端整合
- API联调

## T+7 ~ 9点
- 测试 + 修bug + 演练

---

# ⚠️ 五、风险控制（必须遵守）

如果卡住：

- 超过30分钟 → 直接mock
- API挂 → 写死返回
- UI复杂 → 用按钮替代
- Web3 → 直接取消

---

# 🤖 六、Codex Prompt（强化版）

## 通用模板
You are a senior engineer building a 1-day MVP demo.

Rules:
- Keep everything minimal
- No over-engineering
- Prefer mock over real implementation

Output:
- Working code only

---

## Token系统
Build a Node.js Express API for token system with:
- reward
- spend
- balance
Use in-memory storage.

---

## 前端
Build a React app with:
- upload page
- token display
- farming system
- clean action

Use simple UI and fetch API.

---

# 🚀 七、最终Demo演示话术

This project gamifies second-hand smoke reporting:
- Users report pollution
- Earn tokens
- Grow plants
- Clean environment

---

# ✅ 八、验收Checklist

- [ ] 上传成功
- [ ] token增加
- [ ] 能种植
- [ ] 能收获
- [ ] 能净化
- [ ] 全流程无报错

---

# 🎯 结论

这是一个“能跑通的故事Demo”，不是完整产品。
优先保证流程，而不是技术复杂度。
