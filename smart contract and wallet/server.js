const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

let playerBalance = 10;
let treasury = 0;

app.post('/reward', (req, res) => {
  const { cigaretteCount } = req.body;

  if (
    typeof cigaretteCount !== 'number' ||
    !Number.isFinite(cigaretteCount) ||
    cigaretteCount < 0
  ) {
    return res.status(400).json({ error: 'cigaretteCount must be a non-negative number' });
  }

  const reward = cigaretteCount;
  playerBalance += reward;

  return res.json({ playerBalance, treasury, cigaretteCount, reward });
});

app.post('/purchase', (req, res) => {
  const { price } = req.body;

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number' });
  }

  if (playerBalance < price) {
    return res.status(400).json({ error: 'insufficient balance', playerBalance, treasury });
  }

  playerBalance -= price;
  treasury += price;

  return res.json({ playerBalance, treasury });
});

app.get('/balance', (_req, res) => {
  res.json({ playerBalance, treasury });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
