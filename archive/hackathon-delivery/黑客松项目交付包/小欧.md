# 净化之境 · 第三区商场

这是小欧负责的第三区互动网页，一个可独立运行的单页商场。

## 直接运行

直接用浏览器打开 [index.html](E:/Joe/Documents/New%20project%205/index.html) 即可试玩。

默认演示逻辑：

- 玩家初始有 `30` 金币。
- 可购买两个道具：
  - `普通柚子叶`：`10` 金币
  - `超级柚子喷雾`：`30` 金币
- 购买时会先进入“正在找 Lae 结账”状态。
- 若余额足够，会自动模拟 Lae 返回“付款成功”，随后显示“购买成功”并交接给 Norman。
- 若余额不足，会显示购买失败提示。

## 页面包含的内容

- 玩家钱包余额显示
- 道具货架与购买按钮
- 当前付款状态
- 交接给 Norman 的状态
- 交接暗号展示与复制
- 商场流水记录

## 对接方式

这个页面已经预留了给 Wendy / Lae / Norman 串联时用的接口。

### 1. 第二区传钱给第三区

如果第二区结算完毕后，需要把玩家余额传给商场，可以调用：

```js
window.mallGame.setCoins(金额)
```

例如：

```js
window.mallGame.setCoins(40)
```

### 2. 第三区向外广播购买请求

玩家点击购买时，页面会发出浏览器事件：

```js
window.addEventListener("mall:purchase-request", (event) => {
  console.log(event.detail);
});
```

`event.detail` 里会带上：

- `product`
- `playerCoins`
- `developerVault`

### 3. 如果你们想让 Lae 真正控制“付款成功/失败”

当前页面默认会自动模拟结账成功或失败。

如果后续你们把第二区真实接进来，可以在监听到 `mall:purchase-request` 后，改由外部主动调用：

```js
window.mallGame.completePurchase("super-spray", {
  paymentMessage: "付款成功，开发者已收款 30 币！"
});
```

或者：

```js
window.mallGame.failPurchase("super-spray", {
  reason: "余额不足，付款失败。"
});
```

### 4. 第三区通知第四区

购买成功后，页面会发出：

```js
window.addEventListener("mall:purchase-success", (event) => {
  console.log(event.detail);
});
```

`event.detail` 里会带上：

- `product`
- `playerCoins`
- `developerVault`
- `handoffMessage`

其中 `handoffMessage` 就是交接暗号，例如：

```text
玩家买了一个超级柚子喷雾，Norman 接住！
```

第四区也可以直接读当前状态：

```js
window.mallGame.getState()
```

## 演示按钮

页面右上角有两个便于彩排的按钮：

- `+10 演示加钱`
- `重置演示`

## 兜底简化方案

如果最终联调时间特别紧，可以保留当前页面结构，但只使用：

- `普通柚子叶`
- 固定价格 `10` 金币
- 点击购买后直接成功

这样就能快速切回 Mindy 说的“商场直购、当场使用”版本。
