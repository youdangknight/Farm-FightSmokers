# Fight Smoker Contract And Wallet

This folder contains the contract source and helper scripts used by the demo.

## Current Chain Setup

- Network: Avalanche Fuji Testnet
- Contract:
  `0x21D490077D62D70c9fd5Db2F40298cc414F0Ac62`
- Default RPC:
  `https://api.avax-test.network/ext/bc/C/rpc`

## Main Contract

```text
contracts/GameEconomy.sol
```

Core methods used by the demo:

```solidity
function rewardUser(address user, uint256 score, string reportId) external
function buySeeds(uint256 amount) external
function getBalance(address user) external view returns (uint256 playerBalance, uint256 treasuryBalance)
```

## Scripts

- `npm run owner:check`
- `npm run owner:transfer`
- `npm run reward:user`

## Install

```bash
npm install
cp .env.example .env
```

## Config

Start from:

```bash
cp .env.example .env
cp config.example.js config.js
```

- `.env` is used by the helper scripts
- `config.js` is only for the legacy standalone HTML preview page

## Examples

Check owner:

```bash
npm run owner:check
```

Transfer owner:

```bash
PRIVATE_KEY=YOUR_CURRENT_OWNER_KEY \
NEW_OWNER_ADDRESS=0xYourNewOwner \
npm run owner:transfer
```

Reward a player:

```bash
PRIVATE_KEY=YOUR_OWNER_KEY \
USER_ADDRESS=0xPlayerAddress \
SCORE=1 \
REPORT_ID=report-123 \
npm run reward:user
```

## Notes

- The playable demo UI is now served from `../smoke-report`
- This folder is mainly for contract source, admin scripts, and chain-side reference logic
- Never commit real private keys, secret `.env` files, or local `config.js` files to GitHub
