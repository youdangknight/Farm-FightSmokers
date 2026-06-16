# Fight Smoker Integrated API

This folder provides the integrated backend for the current demo.

## What It Does

1. Serves the main game UI from `../smoke-quest-ui`
2. Accepts uploaded cigarette-report photos
3. Runs recognition logic
4. Returns game rewards
5. Stores local game balance and purchases
6. Supports optional Avalanche Fuji wallet / contract sync

## Run

```bash
npm install
cp .env.example .env
npm run start
```

Open:

```text
http://localhost:8787
```

## Development

```bash
npm run dev
```

## API

```text
GET  /api/health
GET  /api/analyze-report
POST /api/analyze-report
GET  /api/game/balance
GET  /api/game/chain-balance?address=0x...
POST /api/game/reward
POST /api/game/purchase
```

## Recognition Strategy

Current demo recognition is hybrid:

- optional Python YOLO / YOLO-World path
- heuristic fallback path for demo stability
- extra rules for smoking close-up photos
- extra rejection rules for phone UI / screenshot negatives

This means the demo can still run even when Python YOLO dependencies are missing.

## Optional Python Setup

If you want to enable the Python detection path used by `scripts/yolo_detect.py`, install:

```bash
pip install ultralytics
```

Then make sure the app uses the correct Python interpreter:

```bash
PYTHON_PATH=python3 npm run start
```

## Environment Variables

Start from:

```bash
cp .env.example .env
```

Main variables:

```text
PORT
RPC_URL
CONTRACT_ADDRESS
PRIVATE_KEY
PYTHON_PATH
PYTHONPATH
PYTHON_USER_SITE
SMOKE_SCAN_CACHE_HOME
VITE_CONTRACT_ADDRESS
```

## Chain Defaults

```text
Network: Avalanche Fuji Testnet
Contract: 0x21D490077D62D70c9fd5Db2F40298cc414F0Ac62
RPC: https://api.avax-test.network/ext/bc/C/rpc
```

## Important Files

- `server/index.ts`
- `scripts/yolo_detect.py`
- `contracts/GameEconomy.sol`
