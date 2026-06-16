import {
  BadgeCheck,
  Camera,
  Coins,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { analyzeReport, getGameBalance, recordGamePurchase, rewardGameReport } from './lib/api';
import type { AnalysisResponse, DetectionMode, GameBalance } from './lib/types';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
const CONTRACT_ADDRESS_LABEL = CONTRACT_ADDRESS || '请在环境变量中填写 VITE_CONTRACT_ADDRESS';
const FUJI_CHAIN_ID = '0xa869';
const FUJI_NETWORK = {
  chainId: FUJI_CHAIN_ID,
  chainName: 'Avalanche Fuji C-Chain',
  nativeCurrency: {
    name: 'AVAX',
    symbol: 'AVAX',
    decimals: 18
  },
  rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://subnets-test.avax.network/c-chain']
};
const CONTRACT_ABI = [
  'function buySeeds(uint256 amount) external',
  'function getBalance(address user) view returns (uint256 playerBalance, uint256 treasuryBalance)'
] as const;

const products = [
  {
    id: 'pomelo-leaf',
    name: '普通柚子叶',
    price: 3,
    chainAmount: 3,
    power: 3,
    emoji: 'leaf',
    note: '基础净化道具。',
    tone: 'leaf'
  },
  {
    id: 'super-spray',
    name: '超级柚子喷雾',
    price: 5,
    chainAmount: 5,
    power: 5,
    emoji: 'spray',
    note: '更强的净化喷雾。',
    tone: 'spray'
  }
] as const;

const detectionModes: Array<{ value: DetectionMode; label: string; note: string }> = [
  { value: 'auto', label: 'Auto', note: '真实识别' },
  { value: 'hand', label: 'Hand', note: '手持烟头' },
  { value: 'floor', label: 'Floor', note: '地板烟头' },
  { value: 'none', label: 'None', note: '未识别' }
];

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: string[]) => void) => void;
    };
  }
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getResultTitle(result: AnalysisResponse | null) {
  if (!result) return '等待识别';
  if (result.detectedResult === 'none') return '没有识别到烟头';
  if (result.detectedResult === 'hand') return '识别到手上的烟头';
  return '识别到地板上的烟头';
}

function getResultHint(result: AnalysisResponse | null) {
  if (!result) return '上传公共场景照片后，系统会检查是否存在烟头证据。';
  if (result.detectedResult === 'none') return '本次举报未通过，请换一张更清晰的照片再试。';
  return `奖励 ${result.cigaretteCount} 金币。`;
}

function reportIdFrom(result: AnalysisResponse) {
  return `${result.fileName || 'report'}-${result.analyzedAt}`;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [balance, setBalance] = useState<GameBalance>({
    playerBalance: 10,
    treasury: 0,
    reportCount: 0,
    purchases: []
  });
  const [walletAddress, setWalletAddress] = useState('');
  const [chainStatus, setChainStatus] = useState('未连接钱包');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewarding, setIsRewarding] = useState(false);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('auto');
  const [rewardedReportId, setRewardedReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(['等待上传照片。']);

  useEffect(() => {
    void refreshBalance();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const hasPassed = Boolean(result && result.detectedResult !== 'none');
  const currentReportId = result ? reportIdFrom(result) : null;
  const canReward = Boolean(hasPassed && currentReportId && rewardedReportId !== currentReportId);
  const rewardButtonLabel = canReward
    ? '领取奖励'
    : !result || !hasPassed
      ? '先通过识别'
      : rewardedReportId === currentReportId
        ? '本次报告已奖励'
        : '先通过识别';
  const totalPower = balance.purchases.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.id);
    return sum + (product?.power ?? 0);
  }, 0);

  const actionLabel = useMemo(() => {
    if (isAnalyzing) return '正在识别';
    if (!selectedFile) return '先上传照片';
    if (result) return '重新上传';
    return '开始识别';
  }, [isAnalyzing, result, selectedFile]);

  function addLog(text: string) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs((current) => [`[${timestamp}] ${text}`, ...current].slice(0, 8));
  }

  async function refreshBalance() {
    try {
      setBalance(await getGameBalance());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '余额同步失败。');
    }
  }

  async function handleAnalyze() {
    if (result) {
      resetPhotoFlow();
      return;
    }

    if (!selectedFile) {
      setError('请先上传一张公共场景照片。');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const nextResult = await analyzeReport(selectedFile, detectionMode);
      setResult(nextResult);
      addLog(nextResult.rewardSignal);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '识别失败，请稍后再试。');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleReward() {
    if (!result || !hasPassed || !currentReportId) {
      setError('需要先识别到烟头，才能发奖励。');
      return;
    }

    setIsRewarding(true);
    setError(null);

    try {
      const data = await rewardGameReport(result.cigaretteCount, currentReportId);
      setBalance({
        playerBalance: data.playerBalance,
        treasury: data.treasury,
        reportCount: data.reportCount,
        purchases: data.purchases
      });
      setRewardedReportId(currentReportId);
      addLog(`识别到 ${data.cigaretteCount} 个烟头，发放 ${data.reward} 个金币。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '奖励失败。');
    } finally {
      setIsRewarding(false);
    }
  }

  async function ensureFujiNetwork() {
    if (!window.ethereum) {
      throw new Error('没有找到 EVM 钱包，请安装 MetaMask 或打开钱包浏览器。');
    }

    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

    if (currentChainId === FUJI_CHAIN_ID) {
      setChainStatus('Avalanche Fuji Testnet');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: FUJI_CHAIN_ID }]
      });
    } catch (switchError) {
      const code = typeof switchError === 'object' && switchError && 'code' in switchError ? switchError.code : null;

      if (code !== 4902) {
        throw switchError;
      }

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [FUJI_NETWORK]
      });
    }

    setChainStatus('Avalanche Fuji Testnet');
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('没有找到 EVM 钱包，请安装 MetaMask 或打开钱包浏览器。');
      }

      await ensureFujiNetwork();
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setChainStatus('Avalanche Fuji Testnet');
      addLog(`钱包已连接：${formatAddress(address)}。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '连接钱包失败。');
    }
  }

  async function buyProduct(productId: (typeof products)[number]['id']) {
    const product = products.find((item) => item.id === productId);

    if (!product) return;

    setIsBuying(productId);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error('没有找到 EVM 钱包，请安装 MetaMask 或打开钱包浏览器。');
      }

      await ensureFujiNetwork();
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      addLog(`发起 Fuji 购买：buySeeds(${product.chainAmount})。`);
      const tx = await contract.buySeeds(BigInt(product.chainAmount));
      addLog(`Fuji 交易已发出：${tx.hash}`);
      await tx.wait();

      const data = await recordGamePurchase(product.id, product.name, product.price);
      setBalance((current) => ({
        playerBalance: data.playerBalance,
        treasury: data.treasury,
        reportCount: current.reportCount,
        purchases: data.purchases
      }));
      addLog(`购买成功：${product.name} 已加入背包。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '购买失败。');
      addLog(`购买失败：${nextError instanceof Error ? nextError.message : '未知错误'}`);
    } finally {
      setIsBuying(null);
    }
  }

  function resetPhotoFlow() {
    setSelectedFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <main className="quest-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Legacy Demo</p>
          <h1>旧版识别与购买演示入口</h1>
          <p className="hero-text">
            这是早期 React 演示页，保留作功能参考。正式展示请启动 integrated demo，由 smoke-report 服务 smoke-quest-ui。
          </p>
        </div>
        <aside className="wallet-card">
          <div className="wallet-row">
            <span>钱包</span>
            <strong>{walletAddress ? formatAddress(walletAddress) : '未连接'}</strong>
          </div>
          <button type="button" className="primary-button" onClick={connectWallet}>
            <Wallet size={18} />
            连接 Fuji 钱包
          </button>
          <p>{chainStatus}</p>
        </aside>
      </section>

      <section className="stats-grid">
        <StatCard label="玩家金币" value={balance.playerBalance} icon={<Coins size={18} />} />
        <StatCard label="系统金库" value={balance.treasury} icon={<ShieldCheck size={18} />} />
        <StatCard label="举报次数" value={balance.reportCount} icon={<Camera size={18} />} />
        <StatCard label="当前攻击力" value={totalPower} icon={<Sparkles size={18} />} />
      </section>

      <section className="demo-grid">
        <div className="main-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">举报</p>
                <h2>上传公共场景烟头照片</h2>
              </div>
              <button type="button" className="ghost-button" onClick={resetPhotoFlow} disabled={!selectedFile && !result}>
                <RotateCcw size={16} />
                重置照片
              </button>
            </div>

            <label className={previewUrl ? 'photo-card has-photo' : 'photo-card'}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setResult(null);
                  setError(null);
                }}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="举报照片预览" />
              ) : (
                <span className="photo-empty">
                  <ImagePlus size={28} />
                  <strong>点击上传举报照片</strong>
                  <small>照片中可以是手持烟头，也可以是地板烟头。</small>
                </span>
              )}
            </label>

            <div className="mode-selector" aria-label="识别模式">
              {detectionModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={detectionMode === mode.value ? 'mode-button active' : 'mode-button'}
                  onClick={() => setDetectionMode(mode.value)}
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.note}</span>
                </button>
              ))}
            </div>

            <button type="button" className="wide-button" onClick={handleAnalyze} disabled={isAnalyzing || (!selectedFile && !result)}>
              {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              {actionLabel}
            </button>
          </section>

          <section className={hasPassed ? 'panel result-panel success' : result ? 'panel result-panel failed' : 'panel result-panel'}>
            <div className="result-head">
              <span className="result-icon">
                {hasPassed ? <BadgeCheck size={24} /> : result ? <XCircle size={24} /> : <Camera size={24} />}
              </span>
              <div>
                <p className="eyebrow">结果</p>
                <h2>{getResultTitle(result)}</h2>
                <span>{getResultHint(result)}</span>
              </div>
            </div>

            <div className="reward-grid">
              <MiniMetric label="识别到烟头" value={hasPassed ? '是' : '否'} icon={<Sparkles size={16} />} />
              <MiniMetric label="奖励" value={`${result?.cigaretteCount ?? 0} 金币`} icon={<Coins size={16} />} />
              <MiniMetric label="证据标签" value={result?.evidenceLabel ?? '等待上传'} icon={<ShieldCheck size={16} />} />
            </div>

            {result && <p className="handoff-line">{result.rewardSignal}</p>}

            <button type="button" className="wide-button reward-button" onClick={handleReward} disabled={!canReward || isRewarding}>
              {isRewarding ? <Loader2 className="spin" size={18} /> : <Coins size={18} />}
              {rewardButtonLabel}
            </button>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel shop-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">商店</p>
                <h2>钱包购买净化道具</h2>
              </div>
              <ShoppingBag size={24} />
            </div>

            <p className="contract-note">合约配置：{CONTRACT_ADDRESS_LABEL}</p>

            <div className="product-list">
              {products.map((product) => (
                <article key={product.id} className={`product-card ${product.tone}`}>
                  <div className="product-emoji">{product.emoji}</div>
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.note}</p>
                    <div className="product-meta">
                      <span>{product.price} 金币</span>
                      <span>攻击力 {product.power}</span>
                    </div>
                    <button
                      type="button"
                      className="buy-button"
                      disabled={Boolean(isBuying) || balance.playerBalance < product.price}
                      onClick={() => buyProduct(product.id)}
                    >
                      {isBuying === product.id ? '交易中...' : balance.playerBalance < product.price ? '余额不足' : `buySeeds(${product.chainAmount})`}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">记录</p>
                <h2>游戏流水</h2>
              </div>
            </div>
            <div className="log-list">
              {logs.map((log) => (
                <p key={log}>{log}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {error && <div className="toast">{error}</div>}
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <article className="stat-card">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function MiniMetric({ label, value, icon }: { label: string | number; value: string | number; icon: React.ReactNode }) {
  return (
    <article className="mini-metric">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}
