# Anti-Smoke Game Demo

这是当前整合后的 Demo 说明。项目把 Being 的烟头识别交接、Lae 的钱包逻辑、小欧的商城和 Avalanche Fuji Testnet 上的链上购买流程串在了一起。

## 当前规则

- `1` 个烟头 = `1` 个代币
- 玩家链上初始余额：`10`
- 管理员 / 部署者链上初始余额：`100000000`
- 商品价格：
  - `普通柚子叶` = `1`
  - `超级柚子喷雾` = `3`

## 已内置的链上配置

- 默认合约地址：
  - `0x21D490077D62D70c9fd5Db2F40298cc414F0Ac62`
- 默认网络：
  - `Avalanche Fuji Testnet`
- 默认 RPC：
  - `https://api.avax-test.network/ext/bc/C/rpc`

前端页面和管理员脚本都已经内置了合约地址和 ABI，不需要再手动填写 ABI。

## 合约接口

当前内置 ABI 对应这些核心方法：

```solidity
function rewardUser(address user, uint256 score, string reportId) external
function buySeeds(uint256 amount) external
function getBalance(address user) external view returns (uint256 playerBalance, uint256 treasuryBalance)
```

另外也内置了只读字段：

```solidity
owner()
treasury()
INITIAL_OWNER_BALANCE()
INITIAL_PLAYER_BALANCE()
SEED_UNIT_PRICE()
playerBalances(address)
initializedPlayers(address)
processedReports(bytes32)
```

## 页面流程

启动后端：

```bash
node server.js
```

打开：

```text
http://localhost:3000
```

玩家页面当前只保留两类动作：

- 上报烟头，走后端 `/reward`
- 连接钱包后购买商品，走链上 `buySeeds(amount)`，再同步后端 `/purchase`

注意：

- `rewardUser(address, score, reportId)` 已经从玩家页面移除
- 这个奖励动作应由 Lae 的后端或管理员钱包调用

## 管理员奖励脚本

脚本文件：

```text
scripts/reward-user.js
```

运行前先安装依赖：

```bash
npm install
```

执行示例：

```bash
PRIVATE_KEY=你的管理员私钥 \
USER_ADDRESS=玩家钱包地址 \
SCORE=1 \
REPORT_ID=report-123 \
npm run reward:user
```

可选环境变量：

- `CONTRACT_ADDRESS`
- `RPC_URL`

如果不传 `CONTRACT_ADDRESS`，会默认使用：

```text
0x21D490077D62D70c9fd5Db2F40298cc414F0Ac62
```

## 合约文件

可部署合约位于：

```text
contracts/GameEconomy.sol
```

当前实现特性：

- 部署者自动获得 `100000000`
- 普通玩家首次初始化为 `10`
- `rewardUser` 仅 owner 可调用
- `reportId` 去重，防止重复发奖
- `buySeeds(1)` 扣 `1`
- `buySeeds(3)` 扣 `3`
