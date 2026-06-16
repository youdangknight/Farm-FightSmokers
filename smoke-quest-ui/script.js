const API_BASE = window.location.port === "8787" ? "" : "http://localhost:8787";
const CONTRACT_ADDRESS = window.FIGHT_SMOKER_CONFIG?.contractAddress || "";
const FUJI_CHAIN_ID = "0xa869";
const FUJI_NETWORK = {
  chainId: FUJI_CHAIN_ID,
  chainName: "Avalanche Fuji C-Chain",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://subnets-test.avax.network/c-chain"],
};
const CONTRACT_ABI = [
  "function buySeeds(uint256 amount) external",
  "function getBalance(address user) view returns (uint256 playerBalance, uint256 treasuryBalance)",
];
const LEVELS = [
  { at: 0, name: "新手驱邪师" },
  { at: 5, name: "见习法师" },
  { at: 15, name: "熟练祛秽者" },
  { at: 30, name: "柚叶武士" },
  { at: 60, name: "清香大师" },
  { at: 100, name: "净化宗师" },
];
const HIT_LABELS = ["净化！", "退退退！", "走你！", "驱散！", "消散！"];
const WALLET_PROGRESS_KEY = "fight-smoker-wallet-progress";
const GHOST_SPAWN_POINTS = [
  { x: 51, y: 176 },
  { x: 60, y: 185 },
  { x: 65, y: 146 },
  { x: 70, y: 212 },
  { x: 75, y: 168 },
];

const products = {
  "pomelo-leaf": {
    id: "pomelo-leaf",
    name: "普通柚子叶",
    price: 3,
    chainAmount: 3,
    power: 3,
    handoffMessage: "道具已加入背包。",
  },
  "super-spray": {
    id: "super-spray",
    name: "超级柚子喷雾",
    price: 5,
    chainAmount: 5,
    power: 5,
    handoffMessage: "道具已加入背包。",
  },
};

const state = {
  connected: false,
  walletAddress: "",
  coins: 0,
  reports: 0,
  totalHits: 0,
  sessionHits: 0,
  ghosts: [],
  nextGhostId: 0,
  attacking: false,
  treasury: 0,
  lastCigaretteCount: 0,
  equipped: null,
  pendingPurchaseId: null,
  photoFileName: "",
  lastReportId: "",
  lastAnalysis: null,
  inventory: {
    "pomelo-leaf": 0,
    "super-spray": 0,
  },
  walletGiftClaimed: false,
};

const elements = {
  walletStatus: document.getElementById("wallet-status"),
  walletNote: document.getElementById("wallet-note"),
  contractAddressText: document.getElementById("contract-address-text"),
  coinCount: document.getElementById("coin-count"),
  reportCount: document.getElementById("report-count"),
  cigaretteCount: document.getElementById("cigarette-count"),
  hitPower: document.getElementById("hit-power"),
  statusPill: document.getElementById("scan-status"),
  statusCopy: document.getElementById("status-copy"),
  photoInput: document.getElementById("photo-input"),
  photoPreview: document.getElementById("photo-preview"),
  uploadZone: document.getElementById("upload-zone"),
  resultText: document.getElementById("result-text"),
  evidenceLabel: document.getElementById("evidence-label"),
  rewardCoins: document.getElementById("reward-coins"),
  rewardSignal: document.getElementById("reward-signal"),
  arenaScene: document.querySelector(".arena-scene"),
  sceneHero: document.getElementById("scene-hero"),
  equippedItem: document.getElementById("equipped-item"),
  totalHits: document.getElementById("total-hits"),
  sessionHits: document.getElementById("session-hits"),
  levelLabel: document.getElementById("level-label"),
  levelProgress: document.getElementById("level-progress"),
  levelFill: document.getElementById("level-fill"),
  badgesRow: document.getElementById("badges-row"),
  attackButton: document.getElementById("hit-monster"),
  attackCopy: document.getElementById("attack-copy"),
  leafCount: document.getElementById("leaf-count"),
  sprayCount: document.getElementById("spray-count"),
  arenaLeafCount: document.getElementById("arena-leaf-count"),
  arenaSprayCount: document.getElementById("arena-spray-count"),
  treasuryCount: document.getElementById("treasury-count"),
  paymentStatus: document.getElementById("payment-status"),
  itemStatus: document.getElementById("item-status"),
  handoffMessage: document.getElementById("handoff-message"),
  toast: document.getElementById("toast"),
  toastTitle: document.getElementById("toast-title"),
  toastText: document.getElementById("toast-text"),
  diceModal: document.getElementById("dice-modal"),
  diceBox: document.getElementById("dice-box"),
  diceValue: document.getElementById("dice-value"),
  diceText: document.getElementById("dice-text"),
};

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEthereumProvider() {
  if (!window.ethereum) {
    return null;
  }

  if (Array.isArray(window.ethereum.providers)) {
    return (
      window.ethereum.providers.find((provider) => provider?.isMetaMask) ||
      window.ethereum.providers[0] ||
      null
    );
  }

  return window.ethereum;
}

function normalizeWalletAddress(address) {
  return String(address || "").toLowerCase();
}

function readWalletProgressMap() {
  try {
    const raw = window.localStorage.getItem(WALLET_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeWalletProgressMap(progressMap) {
  try {
    window.localStorage.setItem(WALLET_PROGRESS_KEY, JSON.stringify(progressMap));
  } catch (_error) {
    // Ignore storage failures and keep the demo usable.
  }
}

function removeWalletProgress(address) {
  const key = normalizeWalletAddress(address);

  if (!key) {
    return;
  }

  const progressMap = readWalletProgressMap();
  delete progressMap[key];
  writeWalletProgressMap(progressMap);
}

function loadWalletProgress(address) {
  const key = normalizeWalletAddress(address);

  if (!key) {
    return;
  }

  const progressMap = readWalletProgressMap();
  const saved = progressMap[key];

  if (!saved || typeof saved !== "object") {
    return;
  }

  if (Number.isFinite(saved.coins)) {
    state.coins = Math.max(0, Number(saved.coins));
  }

  state.walletGiftClaimed = Boolean(saved.walletGiftClaimed);
}

function persistWalletProgress() {
  const key = normalizeWalletAddress(state.walletAddress);

  if (!state.connected || !key) {
    return;
  }

  const progressMap = readWalletProgressMap();
  progressMap[key] = {
    coins: Math.max(0, Number(state.coins) || 0),
    walletGiftClaimed: Boolean(state.walletGiftClaimed),
  };
  writeWalletProgressMap(progressMap);
}

function hasMetaMask() {
  const provider = getEthereumProvider();
  return Boolean(provider?.isMetaMask || provider);
}

function equippedPower() {
  if (!state.equipped) {
    return 0;
  }

  if (state.inventory[state.equipped] <= 0) {
    return 0;
  }

  return products[state.equipped].power;
}

function equippedCount() {
  if (!state.equipped) {
    return 0;
  }

  return state.inventory[state.equipped] || 0;
}

function setToast(title, text) {
  elements.toastTitle.textContent = title;
  elements.toastText.textContent = text;
  elements.toast.classList.add("show");
  window.clearTimeout(setToast.timerId);
  setToast.timerId = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2400);
}

async function playDiceReward(reward) {
  if (!elements.diceModal || reward <= 0) {
    return reward;
  }

  elements.diceModal.classList.add("show");
  elements.diceModal.setAttribute("aria-hidden", "false");
  elements.diceBox.classList.add("rolling");
  elements.diceText.textContent = "正在摇动骰子...";

  const faces = ["1", "2", "3", "4", "5", "6"];
  let faceIndex = 0;
  elements.diceValue.textContent = faces[0];

  await new Promise((resolve) => {
    const ticker = window.setInterval(() => {
      faceIndex = (faceIndex + 1) % faces.length;
      elements.diceValue.textContent = faces[faceIndex];
    }, 110);

    window.setTimeout(() => {
      window.clearInterval(ticker);
      elements.diceBox.classList.remove("rolling");
      elements.diceValue.textContent = String(reward);
      elements.diceText.textContent = `骰子点数 ${reward} · 获得 ${reward} 金币`;

      window.setTimeout(() => {
        elements.diceModal.classList.remove("show");
        elements.diceModal.setAttribute("aria-hidden", "true");
        resolve();
      }, 1100);
    }, 1400);
  });

  return reward;
}

function popStat(element) {
  element.classList.remove("pop");
  window.requestAnimationFrame(() => element.classList.add("pop"));
}

function randomHitLabel() {
  return HIT_LABELS[Math.floor(Math.random() * HIT_LABELS.length)];
}

function currentLevel() {
  let level = LEVELS[0];

  for (const candidate of LEVELS) {
    if (state.totalHits >= candidate.at) {
      level = candidate;
    }
  }

  return level;
}

function nextLevelAfter(level) {
  return LEVELS[LEVELS.indexOf(level) + 1] || null;
}

function randomGhost() {
  const point = GHOST_SPAWN_POINTS[state.nextGhostId % GHOST_SPAWN_POINTS.length];

  return {
    id: ++state.nextGhostId,
    x: point.x + (Math.random() - 0.5) * 4,
    y: point.y + (Math.random() - 0.5) * 14,
    delay: Math.random() * 1.5,
  };
}

function maxGhostCount() {
  return 5;
}

function parseApiError(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data;
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  return parseJsonResponse(response, "服务暂时不可用。");
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response, "请求失败。");
}

async function syncBackendBalance() {
  const balance = await getJson("/api/game/balance");
  state.treasury = Number(balance.treasury ?? state.treasury);
  state.reports = Number(balance.reportCount ?? state.reports);
}

async function syncChainBalance() {
  if (!state.walletAddress) {
    return;
  }

  const query = new URLSearchParams({ address: state.walletAddress });
  const balance = await getJson(`/api/game/chain-balance?${query.toString()}`);
  state.coins = Math.max(state.coins, Number(balance.playerBalance ?? 0));
  state.treasury = Number(balance.treasury ?? state.treasury);
}

function grantWalletGiftIfNeeded() {
  if (!state.connected || state.walletGiftClaimed) {
    return false;
  }

  state.walletGiftClaimed = true;
  state.coins = Math.max(state.coins, 10);
  return true;
}

function syncWallet() {
  elements.walletStatus.textContent = state.connected ? formatAddress(state.walletAddress) : "未连接";
  elements.contractAddressText.textContent = CONTRACT_ADDRESS || "请在配置中填写";

  if (!hasMetaMask()) {
    elements.walletNote.textContent = "未检测到 MetaMask，请先安装后再连接。";
    return;
  }

  elements.walletNote.textContent = state.connected
    ? "MetaMask 已连接 · Avalanche Fuji Testnet"
    : "请使用 MetaMask 并切换到 Avalanche Fuji Testnet";
}

function syncStats() {
  const product = state.equipped ? products[state.equipped] : null;

  elements.coinCount.textContent = String(state.coins);
  elements.reportCount.textContent = String(state.reports);
  elements.cigaretteCount.textContent = state.lastCigaretteCount > 0 ? "是" : "否";
  elements.hitPower.textContent = String(equippedPower());
  elements.equippedItem.textContent = product ? product.name : "未装备";
  elements.totalHits.textContent = String(state.totalHits);
  elements.sessionHits.textContent = String(state.sessionHits);
  elements.leafCount.textContent = String(state.inventory["pomelo-leaf"]);
  elements.sprayCount.textContent = String(state.inventory["super-spray"]);
  elements.arenaLeafCount.textContent = String(state.inventory["pomelo-leaf"]);
  elements.arenaSprayCount.textContent = String(state.inventory["super-spray"]);
  elements.treasuryCount.textContent = `金库 ${state.treasury}`;
  elements.attackButton.disabled = !product || state.attacking;
  elements.attackCopy.textContent = product
    ? `${product.name} · 使用 1 次（剩余 ${equippedCount()}）`
    : "先装备道具";
  elements.sceneHero.classList.toggle("no-weapon", !product);
  elements.sceneHero.classList.toggle("has-leaf", state.equipped === "pomelo-leaf");
  elements.sceneHero.classList.toggle("has-spray", state.equipped === "super-spray");
  syncLevel();
}

function syncLevel() {
  const level = currentLevel();
  const next = nextLevelAfter(level);
  const progress = next ? Math.min(100, ((state.totalHits - level.at) / (next.at - level.at)) * 100) : 100;

  elements.levelLabel.textContent = `等级：${level.name}`;
  elements.levelProgress.textContent = next ? `${state.totalHits - level.at} / ${next.at - level.at}` : "MAX";
  elements.levelFill.style.width = `${progress}%`;

  elements.badgesRow.querySelectorAll(".badge-chip").forEach((badge) => {
    const milestone = Number(badge.dataset.milestone);
    const unlocked = state.totalHits >= milestone;
    badge.classList.toggle("unlocked", unlocked);
    badge.textContent = unlocked ? `✦ ${milestone} 次` : `${milestone} 次`;
  });
}

function syncShopButtons() {
  document.querySelectorAll(".shop-card").forEach((card) => {
    const productId = card.dataset.item;
    const button = card.querySelector(".buy-button");
    const owned = state.inventory[productId] > 0;
    const equipped = state.equipped === productId;
    const pending = state.pendingPurchaseId === productId;

    if (pending) {
      button.textContent = "交易中";
      button.disabled = true;
      return;
    }

    button.disabled = Boolean(state.pendingPurchaseId);
    button.textContent = equipped ? "已装备" : owned ? "再买一个" : "购买";
  });

  document.querySelectorAll(".equip-button").forEach((button) => {
    const productId = button.dataset.equip;
    const owned = state.inventory[productId] > 0;
    const equipped = state.equipped === productId;
    button.disabled = !owned;
    button.textContent = equipped ? "已装备" : "装备";
  });
}

function syncUi() {
  syncWallet();
  syncStats();
  syncShopButtons();
  persistWalletProgress();
}

function resetWalletViewState(options = {}) {
  const shouldClearProgress = Boolean(options.clearProgress);
  const previousAddress = state.walletAddress;

  if (shouldClearProgress && previousAddress) {
    removeWalletProgress(previousAddress);
  }

  state.connected = false;
  state.walletAddress = "";
  state.coins = 0;
  state.walletGiftClaimed = false;
  state.treasury = 0;
  elements.walletNote.textContent = "MetaMask 已断开，请重新连接。";
  syncUi();
}

async function ensureFujiNetwork() {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("没有找到 MetaMask。");
  }

  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (currentChainId === FUJI_CHAIN_ID) {
    elements.walletNote.textContent = "MetaMask 已连接 · Avalanche Fuji Testnet";
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: FUJI_CHAIN_ID }],
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [FUJI_NETWORK],
    });
  }

  elements.walletNote.textContent = "MetaMask 已连接 · Avalanche Fuji Testnet";
}

async function getSigner() {
  if (!window.ethers) {
    throw new Error("钱包组件未加载。");
  }

  if (!hasMetaMask()) {
    throw new Error("请先安装 MetaMask。");
  }

  await ensureFujiNetwork();
  const injectedProvider = getEthereumProvider();
  const provider = new window.ethers.BrowserProvider(injectedProvider);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

async function connectWallet() {
  try {
    const signer = await getSigner();
    state.walletAddress = await signer.getAddress();
    state.connected = true;
    loadWalletProgress(state.walletAddress);
    elements.walletNote.textContent = "MetaMask 已连接 · Avalanche Fuji Testnet";

    const gifted = grantWalletGiftIfNeeded();
    await syncChainBalance().catch(() => undefined);
    syncUi();
    setToast("MetaMask 已连接", gifted ? "已赠送 10 金币。" : formatAddress(state.walletAddress));
  } catch (error) {
    state.connected = false;
    syncUi();
    setToast("连接失败", parseApiError(error, "请检查 MetaMask。"));
  }
}

async function disconnectWallet() {
  const provider = getEthereumProvider();

  try {
    if (provider?.request) {
      await provider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      }).catch(() => undefined);
    }
  } finally {
    resetWalletViewState({ clearProgress: false });
    setToast("钱包已退出", "当前页面已断开 MetaMask。");
  }
}

async function restoreWalletSession() {
  const provider = getEthereumProvider();

  if (!provider) {
    syncUi();
    return;
  }

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    const activeAccount = accounts?.[0] || "";
    const chainId = await provider.request({ method: "eth_chainId" });

    state.walletAddress = activeAccount;
    state.connected = Boolean(activeAccount);
    loadWalletProgress(activeAccount);
    elements.walletNote.textContent =
      chainId === FUJI_CHAIN_ID
        ? "MetaMask 已连接 · Avalanche Fuji Testnet"
        : "MetaMask 已连接，请切换到 Avalanche Fuji Testnet";

    if (state.connected) {
      grantWalletGiftIfNeeded();
      if (chainId === FUJI_CHAIN_ID) {
        await syncChainBalance().catch(() => undefined);
      } else {
        state.coins = Math.max(state.coins, 10);
      }
    }
  } catch (_error) {
    state.connected = false;
  } finally {
    syncUi();
  }
}

function openPhotoPicker() {
  elements.photoInput.click();
}

function updatePreview(file) {
  if (!file) {
    return;
  }

  state.photoFileName = file.name;
  state.lastAnalysis = null;
  state.lastReportId = "";
  elements.statusPill.textContent = "等待识别";
  elements.statusCopy.textContent = `${file.name} 已上传。`;
  elements.resultText.textContent = "还没有识别结果。";
  elements.evidenceLabel.textContent = "等待识别";
  elements.rewardCoins.textContent = "0 金币";
  elements.rewardSignal.textContent = "识别完成后显示奖励结果。";

  const reader = new FileReader();

  reader.onload = () => {
    elements.photoPreview.src = String(reader.result);
    elements.uploadZone.classList.add("has-image");
  };

  reader.readAsDataURL(file);
}

function fallbackAnalysis(file) {
  const roll = Math.random();
  const detectedResult = roll < 0.45 ? "hand" : roll < 0.82 ? "floor" : "none";
  const detectedCigaretteCount = detectedResult === "none" ? 0 : 1;
  const cigaretteCount = detectedCigaretteCount === 0 ? 0 : Math.floor(Math.random() * 6) + 1;
  const evidenceLabel =
    detectedResult === "hand" ? "人手上的烟头" : detectedResult === "floor" ? "地板上的烟头" : "未识别到烟头";

  return {
    detectedResult,
    detectedCigaretteCount,
    rewardCoins: cigaretteCount,
    cigaretteCount,
    evidenceLabel,
    fileName: file?.name || null,
    analyzedAt: new Date().toISOString(),
    resultText:
      detectedResult === "none" ? "未识别到烟头，本次举报未通过。" : `举报属实，系统识别到${evidenceLabel}。`,
    rewardSignal:
      detectedResult === "none"
        ? "未识别到烟头，奖励 0 金币。"
        : `识别到烟头，奖励 ${cigaretteCount} 金币。`,
  };
}

async function analyzeReport(photo) {
  const formData = new FormData();
  formData.append("photo", photo);
  formData.append("mode", "auto");

  const response = await fetch(`${API_BASE}/api/analyze-report`, {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse(response, "识别服务暂时不可用。");
}

function reportIdFrom(analysis) {
  const fileName = analysis.fileName || state.photoFileName || "report";
  return `${fileName}-${analysis.analyzedAt || Date.now()}`;
}

async function rewardReport(analysis) {
  const reportId = reportIdFrom(analysis);
  const data = await postJson("/api/game/reward", {
    cigaretteCount: analysis.cigaretteCount,
    reportId,
    userAddress: state.walletAddress || undefined,
  });

  state.lastReportId = reportId;
  state.coins = Number(data.playerBalance ?? state.coins);
  state.treasury = Number(data.treasury ?? state.treasury);
  state.reports = Number(data.reportCount ?? state.reports);

  if (data.chainRewarded && state.walletAddress) {
    await syncChainBalance().catch(() => undefined);
  }

  return data;
}

function showAnalysis(analysis, rewardData, usedFallback) {
  const reward = Number(rewardData?.reward ?? analysis.cigaretteCount ?? 0);

  state.lastAnalysis = analysis;
  state.lastCigaretteCount = Number(analysis.cigaretteCount ?? 0);

  elements.statusPill.textContent = analysis.detectedResult === "none" ? "未命中" : "识别成功";
  elements.statusCopy.textContent = `${state.photoFileName || "本次上传"} 已完成识别。`;
  elements.resultText.textContent = analysis.detectedResult === "none" ? "未识别到烟头" : "识别到烟头";
  elements.evidenceLabel.textContent = analysis.detectedResult === "none" ? "未识别到" : "识别到烟头";
  elements.rewardCoins.textContent = `${reward} 金币`;
  elements.rewardSignal.textContent =
    rewardData?.chainRewardTxHash
      ? `链上奖励已发放：${rewardData.chainRewardTxHash.slice(0, 10)}...`
      : reward > 0
        ? `奖励 ${reward} 金币。`
        : "本次奖励 0 金币。";

  syncUi();
  popStat(elements.coinCount);
  popStat(elements.reportCount);

  if (usedFallback) {
    setToast("本地识别完成", reward > 0 ? `获得 ${reward} 金币。` : "这次没有识别到烟头。");
    return;
  }

  setToast("识别完成", reward > 0 ? `获得 ${reward} 金币。` : "这次没有识别到烟头。");
}

async function analyzePhoto() {
  const photo = elements.photoInput.files[0];

  if (!photo) {
    setToast("还没上传照片", "先放一张举报照片。");
    return;
  }

  elements.statusPill.textContent = "识别中";
  elements.statusCopy.textContent = "正在检查照片。";
  document.getElementById("analyze-photo").disabled = true;

  try {
    const analysis = await analyzeReport(photo);
    const rewardData = await rewardReport(analysis);
    if (Number(rewardData?.reward ?? analysis.cigaretteCount ?? 0) > 0) {
      await playDiceReward(Number(rewardData?.reward ?? analysis.cigaretteCount ?? 0));
    }
    showAnalysis(analysis, rewardData, false);
  } catch (error) {
    const analysis = fallbackAnalysis(photo);
    state.reports += 1;
    state.coins += analysis.cigaretteCount;
    if (Number(analysis.cigaretteCount ?? 0) > 0) {
      await playDiceReward(Number(analysis.cigaretteCount ?? 0));
    }
    showAnalysis(analysis, { reward: analysis.cigaretteCount }, true);
    elements.statusCopy.textContent = `服务未连接，已使用本地模式。`;
  } finally {
    document.getElementById("analyze-photo").disabled = false;
  }
}

function setPaymentStatus(text) {
  elements.paymentStatus.textContent = text;
}

function setItemStatus(text) {
  elements.itemStatus.textContent = text;
}

function chooseHandoffMessage(product) {
  elements.handoffMessage.textContent = product.handoffMessage;
}

async function recordPurchase(product, options = {}) {
  const data = await postJson("/api/game/purchase", {
    productId: product.id,
    name: product.name,
    price: product.price,
    alreadyPaid: Boolean(options.alreadyPaid),
    playerBalance: options.alreadyPaid ? state.coins : undefined,
    treasury: options.alreadyPaid ? state.treasury : undefined,
  });

  state.coins = Number(data.playerBalance ?? state.coins);
  state.treasury = Number(data.treasury ?? state.treasury);
}

async function buyOnChain(product) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("未配置合约地址。");
  }

  const signer = await getSigner();
  state.walletAddress = await signer.getAddress();
  state.connected = true;
  elements.walletNote.textContent = "MetaMask 已连接 · Avalanche Fuji Testnet";

  const contract = new window.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const tx = await contract.buySeeds(BigInt(product.chainAmount));
  setPaymentStatus("等待链上确认");
  await tx.wait();

  let synced = true;
  let syncError = "";

  try {
    await syncChainBalance();
  } catch (error) {
    synced = false;
    syncError = parseApiError(error, "链上成功，但本地余额同步失败。");
  }

  return {
    hash: tx.hash,
    synced,
    syncError,
  };
}

async function attemptPurchase(productId) {
  const product = products[productId];

  if (state.coins < product.price) {
    failPurchase(productId, {
      reason: "金币不足",
      toast: "多举报几次再回来。",
    });
    return;
  }

  state.pendingPurchaseId = productId;
  setPaymentStatus("准备交易");
  setItemStatus("等待付款结果");
  elements.handoffMessage.textContent = "正在处理购买。";
  syncUi();

  try {
    let txResult = null;

    if (window.ethereum && window.ethers) {
      txResult = await buyOnChain(product);
    } else {
      await recordPurchase(product).catch(() => {
        state.coins -= product.price;
        state.treasury += product.price;
      });
    }

    if (txResult?.hash) {
      await recordPurchase(product, {
        alreadyPaid: true,
        playerBalance: txResult.synced ? state.coins : undefined,
        treasury: txResult.synced ? state.treasury : undefined,
      }).catch(() => undefined);

      if (!txResult.synced) {
        state.coins = Math.max(0, state.coins - product.price);
        state.treasury += product.price;
      }
    }

    completePurchase(productId, {
      paymentMessage:
        txResult?.hash
          ? txResult.synced
            ? `链上购买成功 ${txResult.hash.slice(0, 10)}...`
            : `链上购买成功 ${txResult.hash.slice(0, 10)}...`
          : "购买成功",
      toastTitle: txResult?.hash ? "交易成功" : "购买成功",
      toastText: txResult?.hash ? `${product.name} 链上购买成功。` : `${product.name} 已装备。`,
    });

    if (txResult?.hash && !txResult.synced) {
      setToast("交易成功", `${product.name} 链上购买成功。`);
    }
  } catch (error) {
    failPurchase(productId, {
      reason: parseApiError(error, "购买失败"),
      toast: parseApiError(error, "请检查钱包或余额。"),
    });
  }
}

function buyProduct(productId) {
  if (state.pendingPurchaseId) {
    return;
  }

  void attemptPurchase(productId);
}

function completePurchase(productId, options = {}) {
  const product = products[productId];

  if (state.pendingPurchaseId !== productId) {
    return;
  }

  state.pendingPurchaseId = null;
  state.inventory[productId] += 1;
  state.equipped = productId;

  setPaymentStatus(options.paymentMessage || "付款成功");
  setItemStatus("已装备道具");
  chooseHandoffMessage(product);
  syncUi();
  popStat(elements.coinCount);
  setToast(options.toastTitle || "购买成功", options.toastText || `${product.name} 已装备。`);
}

function failPurchase(productId, options = {}) {
  if (state.pendingPurchaseId && state.pendingPurchaseId !== productId) {
    return;
  }

  state.pendingPurchaseId = null;
  setPaymentStatus(options.reason || "付款失败");
  setItemStatus("本次没有购买成功");
  elements.handoffMessage.textContent = options.reason || "购买失败。";
  syncShopButtons();
  setToast("购买失败", options.toast || "请稍后再试。");
}

function equipProduct(productId) {
  if (state.inventory[productId] === 0) {
    setToast("还没有这个道具", "先在商店购买。");
    return;
  }

  state.equipped = productId;
  syncUi();
  setToast("装备完成", `${products[productId].name} 已准备好。`);
}

function consumeEquippedItem() {
  const productId = state.equipped;

  if (!productId) {
    return null;
  }

  if (state.inventory[productId] <= 0) {
    state.equipped = null;
    syncUi();
    return null;
  }

  state.inventory[productId] -= 1;
  const remaining = state.inventory[productId];

  if (remaining <= 0) {
    state.inventory[productId] = 0;
    state.equipped = null;
    setItemStatus("当前装备已耗尽");
    elements.handoffMessage.textContent = `${products[productId].name} 已用完，请重新购买。`;
  } else {
    setItemStatus(`已消耗 1 个，还剩 ${remaining} 个`);
    elements.handoffMessage.textContent = `${products[productId].name} 剩余 ${remaining} 个。`;
  }

  syncUi();

  return {
    productId,
    remaining: Math.max(0, remaining),
    exhausted: remaining <= 0,
  };
}

function renderGhosts() {
  elements.arenaScene.querySelectorAll(".ghost").forEach((ghost) => ghost.remove());

  state.ghosts.forEach((ghost) => {
    const button = document.createElement("button");
    button.className = "ghost";
    button.type = "button";
    button.dataset.ghostId = String(ghost.id);
    button.style.left = `calc(${ghost.x}% - 32px)`;
    button.style.top = `${ghost.y}px`;
    button.style.animationDelay = `${ghost.delay}s`;
    button.setAttribute("aria-label", "点击净化烟雾怪");
    button.innerHTML = '<span class="geye l"></span><span class="geye r"></span><span class="gmouth"></span>';
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      smiteGhost(ghost.id);
    });
    elements.arenaScene.appendChild(button);
  });
}

function ensureGhosts() {
  while (state.ghosts.length < maxGhostCount()) {
    state.ghosts.push(randomGhost());
  }

  renderGhosts();
}

function spawnGhostLater(delay = 900) {
  window.setTimeout(() => {
    if (state.ghosts.length < maxGhostCount()) {
      state.ghosts.push(randomGhost());
      renderGhosts();
    }
  }, delay + Math.random() * 500);
}

function createHitPop(left, top, label = randomHitLabel()) {
  const pop = document.createElement("span");
  pop.className = "hit-pop";
  pop.textContent = label;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  elements.arenaScene.appendChild(pop);
  window.setTimeout(() => pop.remove(), 900);
}

function createScentRing() {
  const ring = document.createElement("div");
  ring.className = "scent-ring";
  const rect = elements.arenaScene.getBoundingClientRect();
  const heroLeft = rect.width * 0.22;
  const heroTop = rect.height - 90;
  ring.style.left = `${heroLeft - 15}px`;
  ring.style.top = `${heroTop - 15}px`;
  elements.arenaScene.appendChild(ring);
  window.setTimeout(() => ring.remove(), 720);
}

function createLeafAttack(targets, rect) {
  const heroLeft = rect.width * 0.24;
  const heroTop = rect.height - 120;

  targets.forEach((ghost, index) => {
    const leaf = document.createElement("span");
    const targetLeft = (ghost.x / 100) * rect.width;
    const targetTop = ghost.y + 24;

    leaf.className = "attack-leaf";
    leaf.style.left = `${heroLeft}px`;
    leaf.style.top = `${heroTop}px`;
    leaf.style.setProperty("--dx", `${targetLeft - heroLeft}px`);
    leaf.style.setProperty("--dy", `${targetTop - heroTop}px`);
    leaf.style.animationDelay = `${index * 55}ms`;
    elements.arenaScene.appendChild(leaf);
    window.setTimeout(() => leaf.remove(), 860);
  });
}

function createSprayAttack(targets, rect) {
  const heroLeft = rect.width * 0.25;
  const heroTop = rect.height - 120;
  const blast = document.createElement("div");

  blast.className = "spray-blast";
  blast.style.left = `${heroLeft + 18}px`;
  blast.style.top = `${heroTop - 10}px`;
  blast.innerHTML = "<span></span><span></span><span></span><span></span><span></span><span></span>";
  elements.arenaScene.appendChild(blast);
  window.setTimeout(() => blast.remove(), 920);

  targets.forEach((ghost, index) => {
    const puff = document.createElement("span");
    puff.className = "spray-pop";
    puff.style.left = `${(ghost.x / 100) * rect.width + 8}px`;
    puff.style.top = `${ghost.y + 8}px`;
    puff.style.animationDelay = `${index * 45}ms`;
    elements.arenaScene.appendChild(puff);
    window.setTimeout(() => puff.remove(), 900);
  });
}

function animateTargetGhosts(targets, productId) {
  targets.forEach((ghost, index) => {
    const button = elements.arenaScene.querySelector(`[data-ghost-id="${ghost.id}"]`);

    if (!button) {
      return;
    }

    button.classList.add(productId === "super-spray" ? "spray-blown" : "leaf-smacked");
    button.style.animationDelay = `${index * 45}ms`;
    button.style.setProperty("--flee-x", `${46 + index * 12}px`);
    button.style.setProperty("--flee-y", `${-28 - index * 8}px`);
  });
}

function bumpHits(amount) {
  state.totalHits += amount;
  state.sessionHits += amount;
  syncUi();
  popStat(elements.totalHits);
  popStat(elements.sessionHits);
}

function smiteGhost(ghostId) {
  if (equippedPower() === 0) {
    setToast("还没装备道具", "先在商店购买并装备。");
    return;
  }

  const ghost = state.ghosts.find((candidate) => candidate.id === ghostId);

  if (!ghost) {
    return;
  }

  state.ghosts = state.ghosts.filter((candidate) => candidate.id !== ghostId);
  renderGhosts();
  bumpHits(1);

  const rect = elements.arenaScene.getBoundingClientRect();
  createHitPop((ghost.x / 100) * rect.width, ghost.y - 4);
  spawnGhostLater();
}

function hitMonster() {
  const power = equippedPower();
  const productId = state.equipped;
  const product = productId ? products[productId] : null;

  if (power === 0) {
    setToast("当前无法攻击", "当前装备数量为 0，请重新购买并装备。");
    return;
  }

  if (state.attacking) {
    return;
  }

  const consumeResult = consumeEquippedItem();

  if (!consumeResult) {
    setToast("当前无法攻击", "当前装备数量为 0，请重新购买并装备。");
    return;
  }

  state.attacking = true;
  elements.sceneHero.classList.add("attacking", productId === "super-spray" ? "spraying" : "leaf-striking");
  syncUi();

  const targets = state.ghosts.slice(0, Math.max(1, power));
  const rect = elements.arenaScene.getBoundingClientRect();

  if (targets.length === 0) {
    createHitPop(rect.width * 0.5, rect.height * 0.35, "没有烟雾怪");
  } else {
    animateTargetGhosts(targets, productId);
    createScentRing();

    if (productId === "super-spray") {
      createSprayAttack(targets, rect);
    } else {
      createLeafAttack(targets, rect);
    }

    targets.forEach((ghost, index) => {
      window.setTimeout(() => createHitPop((ghost.x / 100) * rect.width, ghost.y - 4), index * 90);
    });

    window.setTimeout(() => {
      const targetIds = new Set(targets.map((ghost) => ghost.id));
      state.ghosts = state.ghosts.filter((ghost) => !targetIds.has(ghost.id));
      bumpHits(targets.length);
      ensureGhosts();
    }, 680);
  }

  window.setTimeout(() => {
    elements.sceneHero.classList.remove("attacking", "leaf-striking", "spraying");
    state.attacking = false;
    syncUi();
  }, 760);

  popStat(elements.hitPower);
  setToast(
    consumeResult.exhausted ? "攻击成功，装备已用完" : "攻击成功",
    `${product.name} 已净化 ${targets.length} 个烟雾怪。${consumeResult.exhausted ? " 当前装备已耗尽。" : ` 剩余 ${consumeResult.remaining} 个。`}`,
  );
}

document.getElementById("connect-wallet").addEventListener("click", () => void connectWallet());
document.getElementById("disconnect-wallet").addEventListener("click", () => void disconnectWallet());
document.getElementById("upload-zone").addEventListener("click", openPhotoPicker);
document.getElementById("analyze-photo").addEventListener("click", analyzePhoto);
document.getElementById("hit-monster").addEventListener("click", hitMonster);

elements.photoInput.addEventListener("change", (event) => {
  updatePreview(event.target.files[0]);
});

document.querySelectorAll(".shop-card").forEach((card) => {
  const productId = card.dataset.item;
  card.querySelector(".buy-button").addEventListener("click", () => buyProduct(productId));
});

document.querySelectorAll(".equip-button").forEach((button) => {
  button.addEventListener("click", () => equipProduct(button.dataset.equip));
});

const injectedProvider = getEthereumProvider();

if (injectedProvider?.on) {
  injectedProvider.on("accountsChanged", (accounts) => {
    state.walletAddress = accounts[0] || "";
    state.connected = Boolean(state.walletAddress);

    if (!state.connected) {
      resetWalletViewState({ clearProgress: false });
      return;
    }

    loadWalletProgress(state.walletAddress);
    grantWalletGiftIfNeeded();
    void syncChainBalance().catch(() => undefined).finally(syncUi);
  });

  injectedProvider.on("chainChanged", (chainId) => {
    elements.walletNote.textContent =
      chainId === FUJI_CHAIN_ID
        ? "MetaMask 已连接 · Avalanche Fuji Testnet"
        : "MetaMask 已连接，请切换到 Avalanche Fuji Testnet";

    if (chainId === FUJI_CHAIN_ID && state.walletAddress) {
      grantWalletGiftIfNeeded();
      void syncChainBalance().catch(() => undefined).finally(syncUi);
      return;
    }

    syncUi();
  });
}

restoreWalletSession()
  .catch(() => undefined)
  .finally(() => {
    ensureGhosts();
    window.setInterval(() => {
      if (state.ghosts.length < maxGhostCount()) {
        state.ghosts.push(randomGhost());
        renderGhosts();
      }
    }, 1800);
  });
