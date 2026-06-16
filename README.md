# Fight Smoker
#Created by Lae,Being,小欧，Nomad，Windy，柠檬

Fight Smoker is a hackathon demo that combines three parts:

1. A pixel-style browser game UI
2. A cigarette-photo recognition and game API
3. An Avalanche Fuji wallet + contract purchase flow

## Main Folders

- `smoke-report`
  Integrated backend. Serves the main demo page, recognition API, game balance API, and optional on-chain reward sync.
- `smoke-quest-ui`
  Main playable static UI used by the integrated demo.
- `smart contract and wallet`
  Contract source and helper scripts for wallet / ownership / reward operations.

## Archive Folders

- `archive/legacy-prototypes/shop`
  Earlier shop prototype, preserved for reference.
- `archive/hackathon-delivery/黑客松项目交付包`
  Earlier delivery package and hackathon handoff materials.
- `archive/docs/smoking scan.md`
- `smart contract and wallet/farm&fightsmoker.md`
  Older product notes / draft documentation.

The current active demo entry is:

```text
smoke-report  -> serves smoke-quest-ui
```

## Quick Start

### 1. Install backend dependencies

```bash
cd smoke-report
npm install
```

### 2. Prepare config

```bash
cp smoke-report/.env.example smoke-report/.env
```

Optional for static page previews:

```bash
cp smoke-quest-ui/config.example.js smoke-quest-ui/config.js
cp "smart contract and wallet/config.example.js" "smart contract and wallet/config.js"
```

### 3. Start the integrated demo

```bash
npm run start
```

Open:

```text
http://localhost:8787
```

The backend serves the playable UI automatically.

## Demo Flow

1. Connect MetaMask on Avalanche Fuji Testnet
2. Get the first wallet gift coins
3. Upload a cigarette-related photo
4. Run recognition
5. If recognition succeeds, play the dice reward animation
6. Receive coins equal to the dice result
7. Buy purification items
8. Equip items and attack smoke monsters

## Recognition Notes

- The demo supports heuristic fallback recognition even when Python YOLO dependencies are unavailable.
- If you want to enable Python detection, install `ultralytics` in the Python environment used by `smoke-report/scripts/yolo_detect.py`.
- Current demo logic includes extra rules for:
  - smoking close-up photos
  - phone UI / screenshot negative samples

## Contract / Wallet Notes

- Network: Avalanche Fuji Testnet
- Contract:
  `0x21D490077D62D70c9fd5Db2F40298cc414F0Ac62`

See:

- `smoke-report/README.md`
- `smoke-quest-ui/README.md`
- `smart contract and wallet/README.md`

## Suggested GitHub Upload Scope

If you want a clean public repository, keep:

- `README.md`
- `smoke-report/`
- `smoke-quest-ui/`
- `smart contract and wallet/`
- `archive/` if you still want to keep historical notes and delivery materials

Optional:

- Keep the `archive/` folder in the public repository
- Or move archive materials to a separate branch later

## Upload Checklist

Before pushing to GitHub:

1. Do not commit `node_modules`
2. Do not commit local `.env` files, `config.js` files, or private keys
3. Use the included `.env.example` and `config.example.js` files as templates
4. Confirm whether you want to keep large model files:
   - `smoke-report/yolov8n.pt`
   - `smoke-report/yolov8s-world.pt`
4. Large model files are still present if you want Python YOLO support
   - `smoke-report/yolov8n.pt`
   - `smoke-report/yolov8s-world.pt`
