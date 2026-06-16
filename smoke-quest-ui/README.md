# Fight Smoker UI

This folder contains the main playable browser UI for the demo.

## Features

- MetaMask connect / disconnect flow
- Wallet gift coins on first connect
- Cigarette photo upload
- Recognition result panel
- Dice reward popup animation
- Shop purchase flow
- Inventory and equipment
- Smoke monster battle scene

## Recommended Run

This UI is intended to be served by the integrated backend in `../smoke-report`.

```bash
cd ../smoke-report
npm install
npm run start
```

Then open:

```text
http://localhost:8787
```

## Standalone Use

If you want contract text to appear in direct file preview mode, create a local config first:

```bash
cp config.example.js config.js
```

You can also open `index.html` directly for layout preview, but:

- API-based recognition will not work
- Wallet-related backend sync will not work
- Some flows will fall back to local-only behavior

## Files

- `index.html`
- `styles.css`
- `script.js`
- `config.example.js`

Do not commit your local `config.js`.
