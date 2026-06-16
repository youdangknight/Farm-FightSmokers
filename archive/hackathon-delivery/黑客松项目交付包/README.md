# 黑客松项目说明

这是“净化之境”黑客松项目的当前交付目录。项目保留了原始 `HTML` 玩法页面，并提供了一个基于 React + Vite 的整合页面，重点实现第四区 Norman 的“道具使用模块”。

## 当前目录

- `src/`
  - React 源码
- `柚子叶驱散烟鬼.html`
  - 原始 HTML 互动页面
- `项目prd.rtf`
  - 总 PRD 说明
- `BEING.md`
  - 第一区说明
- `Lae.md`
  - 第二区说明
- `小欧.md`
  - 第三区说明
- `package.json`
  - 前端依赖与脚本

## 本地运行

先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认地址：

```text
http://localhost:5173/
```

生产构建：

```bash
npm run build
```

## 当前页面内容

React 页面会同时显示两部分：

1. 左侧保留原始 `HTML` 风格的“柚子叶护法”互动场景
2. 右侧是第四区 Norman 的“道具使用模块”

第四区逻辑包括：

- 接收上游传来的道具
- 展示当前手持道具
- 点击按钮施放魔法
- 使用后消耗道具
- 广播施法结果

## 第四区对接方式

第四区当前已对齐 PRD 和组员说明，主要接口如下。

### 输入事件

第三区小欧购买成功后，可以直接发：

```js
window.dispatchEvent(new CustomEvent("mall:purchase-success", {
  detail: {
    product: {
      id: "super-spray",
      name: "超级柚子喷雾",
      type: "spray",
      price: 30
    },
    paymentMessage: "付款成功，开发者已收款 30 币！",
    handoffMessage: "玩家买了一个超级柚子喷雾，Norman 接住！"
  }
}));
```

也支持直接发：

```js
window.dispatchEvent(new CustomEvent("norman:receive-item", {
  detail: {
    item: {
      id: "normal-leaf",
      name: "普通柚子叶",
      type: "leaf",
      price: 10
    }
  }
}));
```

### 主动接口

页面会暴露：

```js
window.normanGame.receiveItem(item)
window.normanGame.clearInventory()
window.normanGame.getState()
```

### 输出事件

第四区会向外广播：

```js
norman:inventory-received
norman:magic-cast
```

其中 `norman:magic-cast` 会带上本次施法结果，可供 Wendy 串联最终成功画面。

## 文件重点

- `src/App.jsx`
  - 第四区总入口与事件桥接
- `src/components/ItemUsageModule.jsx`
  - 第四区道具使用模块
- `src/components/LegacyYuzuGame.jsx`
  - 原始 HTML 玩法迁移版
- `src/styles.css`
  - 页面整体样式

## 打包说明

当前交付压缩包为：

```text
黑客松项目交付包.zip
```

压缩包默认不包含：

- `node_modules/`
- `dist/`

这样便于传输，组员拿到后执行 `npm install` 即可。
