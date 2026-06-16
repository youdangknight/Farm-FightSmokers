import type { AnalysisResponse, DetectionMode, GameBalance, PurchaseResponse, RewardResponse } from './types';

export async function analyzeReport(photo: File, mode: DetectionMode) {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('mode', mode);

  const response = await fetch('/api/analyze-report', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('识别服务暂时不可用，请稍后再试。');
  }

  return response.json() as Promise<AnalysisResponse>;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data as T;
}

export async function getGameBalance() {
  const response = await fetch('/api/game/balance');
  return parseJsonResponse<GameBalance>(response, '游戏余额暂时不可用。');
}

export async function rewardGameReport(cigaretteCount: number, reportId: string) {
  const response = await fetch('/api/game/reward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cigaretteCount, reportId })
  });

  return parseJsonResponse<RewardResponse>(response, '奖励发放失败。');
}

export async function recordGamePurchase(productId: string, name: string, price: number) {
  const response = await fetch('/api/game/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, name, price })
  });

  return parseJsonResponse<PurchaseResponse>(response, '购买同步失败。');
}
