# 公共场景烟头识别模块（being）

这是“净化之境”游戏中 being 负责的第一区交互模块。它提供一个完整的前后端演示流程：

1. 玩家上传公共场景举报照片。
2. 后端模拟识别照片中是否存在烟头。
3. 烟头可以出现在人的手上，也可以出现在地板上。
4. 如果识别到烟头，系统自动摇 1 到 6 点骰子。
5. being 输出折算后的烟头数给 Lae。

## 和 open-design 的结合

界面参考了 `nexu-io/open-design` 中 `design-systems/application` 的应用仪表盘方向：

- 使用顶部栏承载模块身份和当前输出目标。
- 使用清晰的左右工作区：左侧上传与识别输入，右侧显示结果与交接数据。
- 主操作使用紫色强调色 `#9333EA`。
- 面板使用白色背景、8px 圆角、细边框和稳定网格。
- 状态区使用成功、失败、等待三类清晰反馈。

## 当前业务规则

being 的输出给 Lae 的仍然是“烟头数”，不是金币。

当前简单版本规则：

```text
如果没有识别到烟头：
传给 Lae：0 个烟头

如果识别到烟头：
识别到烟头数 = 1
骰子点数 = 1 到 6
传给 Lae 的烟头数 = 识别到烟头数 × 骰子点数
```

标准交接暗号：

```text
识别到1 个烟头，骰子 ×6，传给 Lae：6 个烟头！
```

实际运行时，`6` 会根据后端摇到的骰子点数自动变化。

## 前端生成内容

前端位于：

```text
src/App.tsx
src/styles.css
src/lib/api.ts
src/lib/types.ts
```

前端负责：

- 上传举报照片并显示预览。
- 使用移动端 App 原型界面承载玩家流程。
- 在桌面预览时展示 iPhone 15 Pro 风格设备外壳。
- 在真实手机宽度下自动切换为全屏 App 界面。
- 自动使用后端 `auto` 模式识别，不向玩家暴露演示/开发者选项。
- 调用后端接口。
- 展示识别结果、骰子倍数、交给 Lae 的烟头数。
- 展示玩家可理解的奖励提示。

给 Lae 的核心字段是：

```json
{
  "cigaretteCount": 6,
  "detectedCigaretteCount": 1,
  "dicePoint": 6,
  "detectedResult": "hand"
}
```

其中 `cigaretteCount` 是 Wendy 接线时真正要传给 Lae 的数字。

## 后端生成内容

后端位于：

```text
server/index.ts
```

后端提供两个接口：

```text
GET /api/health
POST /api/analyze-report
```

`POST /api/analyze-report` 接收：

- `photo`：上传的照片文件。
- `mode`：演示模式，取值为 `auto`、`hand`、`floor`、`none`。

返回示例：

```json
{
  "detectedResult": "floor",
  "detectedCigaretteCount": 1,
  "dicePoint": 4,
  "cigaretteCount": 4,
  "evidenceLabel": "地板上的烟头",
  "fileName": "report-photo.jpg",
  "laeSignal": "识别到1 个烟头，骰子 ×4，传给 Lae：4 个烟头！",
  "resultText": "举报属实，系统识别到地板上的烟头。",
  "analyzedAt": "2026-05-05T00:00:00.000Z"
}
```

## 如何运行

先安装依赖：

```bash
npm install
```

启动前后端：

```bash
npm run dev
```

默认地址：

```text
前端：http://localhost:5174
后端：http://localhost:8787
```

前端通过 Vite 代理访问 `/api/analyze-report`，本地开发时不需要单独配置接口地址。

## 如何替换成真实 AI 识别

目前后端的识别是模拟逻辑，位置在：

```text
server/index.ts
```

需要替换的函数是：

```ts
function pickDetection(mode: DetectionMode): DetectedResult
```

未来接入真实识别时，可以改成：

```ts
async function detectCigaretteFromImage(fileBuffer: Buffer): Promise<DetectedResult> {
  // 返回 hand / floor / none
}
```

只要最终仍然返回：

```text
hand：识别到人手上的烟头
floor：识别到地板上的烟头
none：没有识别到烟头
```

前端和 Lae 的接线都不用改变。

## Wendy 接线说明

Wendy 只需要在识别完成后取后端返回值：

```ts
result.cigaretteCount
```

然后调用 Lae 的记账入口：

```ts
sendToLae(result.cigaretteCount)
```

Lae 继续按原规则计算：

```text
玩家金币 += cigaretteCount × 10
```

## 边界

being 负责：

- 上传/预览照片
- 识别烟头证据
- 自动摇骰子
- 生成折算烟头数
- 输出交接暗号

being 不负责：

- 玩家钱包
- 开发者金库
- 商场购买
- 道具使用
- 魔法效果
