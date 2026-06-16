export type DetectionMode = 'auto' | 'hand' | 'floor' | 'none';
export type DetectedResult = 'hand' | 'floor' | 'none';

export type AnalysisResponse = {
  detectedResult: DetectedResult;
  detectedCigaretteCount: number;
  rewardCoins: number;
  cigaretteCount: number;
  rewardSignal: string;
  resultText: string;
  evidenceLabel: string;
  fileName: string | null;
  analyzedAt: string;
  confidence: number;
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    kind: 'hand' | 'floor';
  }>;
  yolo: {
    ok: boolean;
    model?: string;
    detections: Array<{
      label: string;
      classId: number;
      confidence: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    error?: string;
  };
};

export type GameBalance = {
  playerBalance: number;
  treasury: number;
  reportCount: number;
  purchases: GamePurchase[];
};

export type GamePurchase = {
  id: string;
  name: string;
  price: number;
};

export type RewardResponse = GameBalance & {
  cigaretteCount: number;
  reward: number;
  reportId: string;
};

export type PurchaseResponse = Pick<GameBalance, 'playerBalance' | 'treasury' | 'purchases'>;
