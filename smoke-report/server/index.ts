import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import cors from 'cors';
import { ethers } from 'ethers';
import express from 'express';
import { Jimp } from 'jimp';
import multer from 'multer';

type DetectionMode = 'auto' | 'hand' | 'floor' | 'none';
type DetectedResult = 'hand' | 'floor' | 'none';

type DetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  kind: Exclude<DetectedResult, 'none'>;
};

type YoloDetection = {
  label: string;
  classId: number;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type YoloResult = {
  ok: boolean;
  model?: string;
  detections: YoloDetection[];
  error?: string;
};

type AnalysisResponse = {
  detectorVersion: string;
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
  boxes: DetectionBox[];
  yolo: YoloResult;
};

type GamePurchase = {
  id: string;
  name: string;
  price: number;
};

type UploadedImage = Express.Multer.File & { buffer: Buffer };

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 8787);
const gameUiPath = path.resolve(process.cwd(), '..', 'smoke-quest-ui');
const vendorPath = path.resolve(process.cwd(), 'node_modules');
const defaultContractAddress = '';
const rpcUrl = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const contractAddress = process.env.CONTRACT_ADDRESS || defaultContractAddress;
const adminPrivateKey = process.env.PRIVATE_KEY;
const contractAbi = [
  'function rewardUser(address user, uint256 score, string reportId) external',
  'function getBalance(address user) view returns (uint256 playerBalance, uint256 treasuryBalance)'
] as const;

const pythonExecutable = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
const yoloScript = path.join(process.cwd(), 'scripts', 'yolo_detect.py');
const pythonCacheHome = process.env.SMOKE_SCAN_CACHE_HOME || path.join(tmpdir(), 'smoke-report-python-home');
const pythonUserSite = process.env.PYTHON_USER_SITE || '';
const pythonPath = [pythonUserSite, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
const detectorVersion = 'closeup-rules-2026-05-06-v2';
const gameState = {
  playerBalance: 10,
  treasury: 0,
  rewardedReports: new Set<string>(),
  reportCount: 0,
  purchases: [] as GamePurchase[]
};

app.use(cors());
app.use(express.json());
app.use('/vendor/ethers', express.static(path.join(vendorPath, 'ethers', 'dist')));
app.use(express.static(gameUiPath));

function randomRewardCoins() {
  return Math.floor(Math.random() * 6) + 1;
}

function isUsableImage(file?: Express.Multer.File): file is UploadedImage {
  return Boolean(file?.buffer?.length && file.mimetype.startsWith('image/'));
}

function intToRgb(color: number) {
  return {
    r: (color >>> 24) & 0xff,
    g: (color >>> 16) & 0xff,
    b: (color >>> 8) & 0xff
  };
}

function isLightCigarettePixel(red: number, green: number, blue: number) {
  const brightness = (red + green + blue) / 3;
  const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return brightness > 154 && brightness < 244 && colorSpread < 52;
}

function isAshDarkPixel(red: number, green: number, blue: number) {
  const brightness = (red + green + blue) / 3;
  const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return brightness > 42 && brightness < 132 && colorSpread < 48;
}

function isEmberPixel(red: number, green: number, blue: number) {
  return red > 135 && green > 54 && green < 145 && blue < 110 && red - blue > 48;
}

function isSkinPixel(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return (
    red > 118 &&
    green > 62 &&
    green < 178 &&
    blue > 42 &&
    blue < 152 &&
    red > green &&
    green >= blue * 0.82 &&
    red - green > 8 &&
    red - green < 78 &&
    red - blue > 34 &&
    max - min > 38
  );
}

function isPurpleVehiclePixel(red: number, green: number, blue: number) {
  return red > 95 && blue > 95 && green < 95 && Math.abs(red - blue) < 95;
}

function isLedOrDisplayPixel(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return min < 42 && max > 145 && max - min > 120;
}

function isDarkGlassPixel(red: number, green: number, blue: number) {
  const brightness = (red + green + blue) / 3;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return brightness < 72 && spread < 58;
}

function isHighContrastEdge(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 118;
}

function intersectsPerson(box: DetectionBox, persons: YoloDetection[]) {
  if (box.kind === 'floor') return true;
  if (persons.length === 0) return false;

  const boxCenterX = box.x + box.width / 2;
  const boxCenterY = box.y + box.height / 2;

  return persons.some((person) => {
    const marginX = person.width * 0.18;
    const marginY = person.height * 0.14;
    const relativeY = (boxCenterY - person.y) / Math.max(1, person.height);
    const relativeX = (boxCenterX - person.x) / Math.max(1, person.width);
    const likelyFaceOrHairZone =
      box.kind === 'hand' &&
      person.height > 360 &&
      relativeY < 0.24 &&
      relativeX > 0.22 &&
      relativeX < 0.78;

    return (
      !likelyFaceOrHairZone &&
      boxCenterX >= person.x - marginX &&
      boxCenterX <= person.x + person.width + marginX &&
      boxCenterY >= person.y - marginY &&
      boxCenterY <= person.y + person.height + marginY
    );
  });
}

function boxCenter(box: Pick<DetectionBox, 'x' | 'y' | 'width' | 'height'>) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function isPlausibleFloorWorldBox(box: DetectionBox, imageWidth: number, imageHeight: number, persons: YoloDetection[]) {
  const center = boxCenter(box);
  const areaRatio = (box.width * box.height) / Math.max(1, imageWidth * imageHeight);
  const aspect = Math.max(box.width, box.height) / Math.max(1, Math.min(box.width, box.height));
  const nearPersonTorsoOrFace = persons.some((person) => {
    const personCenter = boxCenter(person);
    const normalizedDistance = Math.hypot(
      (center.x - personCenter.x) / Math.max(1, person.width),
      (center.y - personCenter.y) / Math.max(1, person.height)
    );
    return normalizedDistance < 0.58 && center.y < person.y + person.height * 0.82;
  });

  return (
    box.confidence >= 0.42 &&
    areaRatio > 0.00003 &&
    areaRatio < 0.012 &&
    aspect < 6 &&
    center.y > imageHeight * 0.42 &&
    !nearPersonTorsoOrFace
  );
}

function mergeNearbyBoxes(boxes: DetectionBox[]) {
  const kept: DetectionBox[] = [];

  for (const box of boxes.sort((a, b) => b.confidence - a.confidence)) {
    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;
    const isDuplicate = kept.some((other) => {
      const otherCenterX = other.x + other.width / 2;
      const otherCenterY = other.y + other.height / 2;
      const distance = Math.hypot(boxCenterX - otherCenterX, boxCenterY - otherCenterY);
      const overlapX = Math.max(0, Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x));
      const overlapY = Math.max(0, Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y));
      const overlap = overlapX * overlapY;
      return distance < 42 || overlap / Math.max(1, box.width * box.height) > 0.18;
    });

    if (!isDuplicate) kept.push(box);
  }

  return kept;
}

function keepOneHandBoxPerPerson(boxes: DetectionBox[], persons: YoloDetection[]) {
  const handBoxes = boxes.filter((box) => box.kind === 'hand');
  const floorBoxes = boxes.filter((box) => box.kind === 'floor');
  const keptHands: DetectionBox[] = [];
  const assigned = new Set<DetectionBox>();

  for (const person of persons) {
    const inside = handBoxes
      .filter((box) => !assigned.has(box) && intersectsPerson(box, [person]))
      .sort((a, b) => b.confidence - a.confidence);

    if (inside[0]) {
      keptHands.push(inside[0]);
      assigned.add(inside[0]);
    }
  }

  if (keptHands.length === 0 && handBoxes[0]) {
    keptHands.push(handBoxes.sort((a, b) => b.confidence - a.confidence)[0]);
  }

  return [...keptHands, ...floorBoxes].sort((a, b) => b.confidence - a.confidence);
}

function isLikelyFallbackHandZone(box: DetectionBox, imageWidth: number, imageHeight: number) {
  const center = boxCenter(box);
  const xRatio = center.x / Math.max(1, imageWidth);
  const yRatio = center.y / Math.max(1, imageHeight);
  return xRatio > 0.1 && xRatio < 0.96 && yRatio > 0.12 && yRatio < 0.88;
}

function boxOverlapRatio(box: DetectionBox, other: DetectionBox) {
  const overlapX = Math.max(0, Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x));
  const overlapY = Math.max(0, Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y));
  const overlap = overlapX * overlapY;
  const smallerArea = Math.max(1, Math.min(box.width * box.height, other.width * other.height));
  return overlap / smallerArea;
}

function dedupeBoxes(boxes: DetectionBox[]) {
  return boxes
    .sort((a, b) => b.confidence - a.confidence)
    .filter((box, index, all) => {
      return !all.slice(0, index).some((other) => boxOverlapRatio(box, other) > 0.36);
    })
    .slice(0, 5);
}

function rankFallbackHandBoxes(
  boxes: DetectionBox[],
  imageWidth: number,
  imageHeight: number,
  persons: YoloDetection[]
) {
  if (boxes.length <= 1) return boxes;

  return [...boxes].sort((a, b) => {
    const score = (box: DetectionBox) => {
      const center = boxCenter(box);
      const xRatio = center.x / Math.max(1, imageWidth);
      const yRatio = center.y / Math.max(1, imageHeight);
      const area = box.width * box.height;
      const areaRatio = area / Math.max(1, imageWidth * imageHeight);
      const centralBonus = 1 - Math.min(1, Math.abs(xRatio - 0.5) * 1.6);
      const upperHandBonus = 1 - Math.min(1, Math.abs(yRatio - 0.48) * 1.8);
      const sizePenalty = areaRatio > 0.08 ? 0.35 : areaRatio < 0.0008 ? 0.2 : 0;
      const personBonus =
        persons.length > 0 && intersectsPerson(box, persons)
          ? 0.4
          : persons.length === 0 && xRatio > 0.18 && xRatio < 0.82 && yRatio > 0.18 && yRatio < 0.78
            ? 0.28
            : 0;

      return box.confidence + centralBonus * 0.22 + upperHandBonus * 0.18 + personBonus - sizePenalty;
    };

    return score(b) - score(a);
  });
}

function summarizeImageSignals(image: Awaited<ReturnType<typeof Jimp.read>>) {
  let light = 0;
  let dark = 0;
  let ember = 0;
  let skin = 0;
  let purple = 0;
  let display = 0;
  let glass = 0;
  let bright = 0;
  let total = 0;

  for (let y = 0; y < image.bitmap.height; y += 2) {
    for (let x = 0; x < image.bitmap.width; x += 2) {
      const { r, g, b } = intToRgb(image.getPixelColor(x, y));
      total += 1;
      if (isLightCigarettePixel(r, g, b)) light += 1;
      if (isAshDarkPixel(r, g, b)) dark += 1;
      if (isEmberPixel(r, g, b)) ember += 1;
      if (isSkinPixel(r, g, b)) skin += 1;
      if (isPurpleVehiclePixel(r, g, b)) purple += 1;
      if (isLedOrDisplayPixel(r, g, b)) display += 1;
      if (isDarkGlassPixel(r, g, b)) glass += 1;
      if ((r + g + b) / 3 > 225) bright += 1;
    }
  }

  return {
    lightRatio: light / Math.max(1, total),
    darkRatio: dark / Math.max(1, total),
    emberRatio: ember / Math.max(1, total),
    skinRatio: skin / Math.max(1, total),
    purpleRatio: purple / Math.max(1, total),
    displayRatio: display / Math.max(1, total),
    glassRatio: glass / Math.max(1, total),
    brightRatio: bright / Math.max(1, total)
  };
}

function isLikelyPhoneUiScreenshot(
  imageWidth: number,
  imageHeight: number,
  signals: ReturnType<typeof summarizeImageSignals>
) {
  const tallPortrait = imageHeight > imageWidth * 1.8;
  const veryBrightUi = signals.brightRatio > 0.56;
  const lowSkin = signals.skinRatio < 0.03;
  const lowDark = signals.darkRatio < 0.05;
  const someDisplay = signals.displayRatio > 0.008;
  const lowGlass = signals.glassRatio < 0.08;
  return tallPortrait && veryBrightUi && lowSkin && lowDark && someDisplay && lowGlass;
}

function isLikelySmokingCloseup(
  imageWidth: number,
  imageHeight: number,
  signals: ReturnType<typeof summarizeImageSignals>
) {
  const landscapeOrPhoto = imageWidth >= imageHeight * 1.25;
  const hasSkin = signals.skinRatio > 0.04;
  const hasBodySignal = signals.lightRatio > 0.08;
  const hasTipSignal = signals.emberRatio > 0.01 || signals.darkRatio > 0.08;
  const darkerPhoto = signals.brightRatio < 0.2;
  const smokyOrShadowed = signals.glassRatio > 0.18 || signals.darkRatio > 0.09;
  const notUi = signals.displayRatio < 0.01;
  return landscapeOrPhoto && hasSkin && hasBodySignal && hasTipSignal && darkerPhoto && smokyOrShadowed && notUi;
}

function buildSmokingCloseupFallbackBox(imageWidth: number, imageHeight: number): DetectionBox {
  const boxWidth = Math.max(54, Math.round(imageWidth * 0.28));
  const boxHeight = Math.max(42, Math.round(imageHeight * 0.24));
  const x = Math.max(0, Math.round(imageWidth * 0.34));
  const y = Math.max(0, Math.round(imageHeight * 0.42));

  return {
    x,
    y,
    width: Math.min(boxWidth, imageWidth - x),
    height: Math.min(boxHeight, imageHeight - y),
    confidence: 0.62,
    kind: 'hand'
  };
}

function detectCigaretteLikeBoxes(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  persons: YoloDetection[],
  allowWithoutPerson = false
) {
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(image.bitmap.width, image.bitmap.height));
  const working = image.clone();

  if (scale < 1) {
    working.resize({
      w: Math.round(image.bitmap.width * scale),
      h: Math.round(image.bitmap.height * scale)
    });
  }

  const width = working.bitmap.width;
  const height = working.bitmap.height;
  const boxes: DetectionBox[] = [];
  const cellSize = 28;
  const stride = 14;

  for (let y = 0; y <= height - cellSize; y += stride) {
    for (let x = 0; x <= width - cellSize; x += stride) {
      let light = 0;
      let dark = 0;
      let ember = 0;
      let skin = 0;
      let purple = 0;
      let display = 0;
      let glass = 0;
      let edge = 0;
      let total = 0;
      let minLightX = cellSize;
      let maxLightX = 0;
      let minLightY = cellSize;
      let maxLightY = 0;

      for (let yy = y; yy < y + cellSize; yy += 2) {
        for (let xx = x; xx < x + cellSize; xx += 2) {
          const { r, g, b } = intToRgb(working.getPixelColor(xx, yy));
          const localX = xx - x;
          const localY = yy - y;
          total += 1;

          if (isLightCigarettePixel(r, g, b)) {
            light += 1;
            minLightX = Math.min(minLightX, localX);
            maxLightX = Math.max(maxLightX, localX);
            minLightY = Math.min(minLightY, localY);
            maxLightY = Math.max(maxLightY, localY);
          }

          if (isAshDarkPixel(r, g, b)) dark += 1;
          if (isEmberPixel(r, g, b)) ember += 1;
          if (isSkinPixel(r, g, b)) skin += 1;
          if (isPurpleVehiclePixel(r, g, b)) purple += 1;
          if (isLedOrDisplayPixel(r, g, b)) display += 1;
          if (isDarkGlassPixel(r, g, b)) glass += 1;

          if (xx + 2 < x + cellSize && yy + 2 < y + cellSize) {
            const nextX = intToRgb(working.getPixelColor(xx + 2, yy));
            const nextY = intToRgb(working.getPixelColor(xx, yy + 2));
            if (isHighContrastEdge({ r, g, b }, nextX) || isHighContrastEdge({ r, g, b }, nextY)) {
              edge += 1;
            }
          }
        }
      }

      const lightRatio = light / total;
      const darkRatio = dark / total;
      const emberRatio = ember / total;
      const skinRatio = skin / total;
      const purpleRatio = purple / total;
      const displayRatio = display / total;
      const glassRatio = glass / total;
      const edgeRatio = edge / total;
      const lightW = maxLightX - minLightX + 1;
      const lightH = maxLightY - minLightY + 1;
      const aspect = lightW / Math.max(1, lightH);
      const thinShape = lightW > 10 && aspect > 2.8 && lightH < 9;
      const relaxedThinShape = lightW > 8 && aspect > 2.15 && lightH < 11;
      const notVehicleLike = purpleRatio < 0.035 && displayRatio < 0.025 && glassRatio < 0.36;
      const compactHandContext =
        skinRatio > 0.16 &&
        skinRatio < 0.44 &&
        glassRatio < 0.36 &&
        displayRatio < 0.015 &&
        purpleRatio < 0.025;
      const fallbackHandContext =
        skinRatio > 0.04 &&
        skinRatio < 0.62 &&
        glassRatio < 0.42 &&
        displayRatio < 0.05 &&
        purpleRatio < 0.04 &&
        edgeRatio < 0.58;
      const floorContext = y > height * 0.6 && skinRatio < 0.04 && edgeRatio < 0.18 && glassRatio < 0.22;
      const cigaretteCore = thinShape && lightRatio > 0.022 && lightRatio < 0.18 && notVehicleLike;
      const relaxedCigaretteCore = relaxedThinShape && lightRatio > 0.012 && lightRatio < 0.24 && notVehicleLike;
      const strongTip = emberRatio > 0.025 && darkRatio > 0.08 && darkRatio < 0.68;
      const clearAshTip = darkRatio > 0.065 && darkRatio < 0.38 && edgeRatio < 0.34;
      const fallbackTip = emberRatio > 0.004 || (darkRatio > 0.04 && darkRatio < 0.84);
      const floorTip = emberRatio > 0.018;
      const candidateKind: Exclude<DetectedResult, 'none'> | null =
        cigaretteCore && compactHandContext && (strongTip || clearAshTip)
          ? 'hand'
          : cigaretteCore && floorContext && floorTip
            ? 'floor'
            : null;
      const fallbackHandCandidate =
        allowWithoutPerson &&
        relaxedCigaretteCore &&
        fallbackHandContext &&
        fallbackTip &&
        y < height * 0.9;

      if (candidateKind || fallbackHandCandidate) {
        const resolvedKind = candidateKind ?? 'hand';
        const confidence = Math.min(
          0.96,
          (resolvedKind === 'hand' && allowWithoutPerson ? 0.34 : 0.36) +
            lightRatio * 0.95 +
            emberRatio * 7 +
            (resolvedKind === 'hand' ? Math.min(skinRatio, allowWithoutPerson ? 0.3 : 0.24) : 0.08) +
            ((thinShape || relaxedThinShape) ? 0.16 : 0) +
            (fallbackHandCandidate ? 0.06 : 0)
        );

        const box: DetectionBox = {
          x: Math.round(x / scale),
          y: Math.round(y / scale),
          width: Math.round(cellSize / scale),
          height: Math.round(cellSize / scale),
          confidence: Number(confidence.toFixed(2)),
          kind: resolvedKind
        };

        if (
          intersectsPerson(box, persons) ||
          (fallbackHandCandidate && isLikelyFallbackHandZone(box, image.bitmap.width, image.bitmap.height))
        ) {
          boxes.push(box);
        }
      }
    }
  }

  return boxes
    .sort((a, b) => b.confidence - a.confidence)
    .filter((box, index, all) => {
      return !all.slice(0, index).some((other) => {
        const overlapX = Math.max(0, Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x));
        const overlapY = Math.max(0, Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y));
        const overlap = overlapX * overlapY;
        return overlap / (box.width * box.height) > 0.35;
      });
    })
    .slice(0, 3);
}

function detectPinchedCigaretteBoxes(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  persons: YoloDetection[],
  allowWithoutPerson = false
) {
  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(image.bitmap.width, image.bitmap.height));
  const working = image.clone();

  if (scale < 1) {
    working.resize({
      w: Math.round(image.bitmap.width * scale),
      h: Math.round(image.bitmap.height * scale)
    });
  }

  const boxes: DetectionBox[] = [];
  const width = working.bitmap.width;
  const height = working.bitmap.height;
  const cellSize = 18;
  const stride = 6;

  for (let y = 0; y <= height - cellSize; y += stride) {
    for (let x = 0; x <= width - cellSize; x += stride) {
      let skin = 0;
      let light = 0;
      let dark = 0;
      let ember = 0;
      let purple = 0;
      let display = 0;
      let glass = 0;
      let total = 0;
      const lightPoints: Array<{ x: number; y: number }> = [];
      const darkPoints: Array<{ x: number; y: number }> = [];
      const emberPoints: Array<{ x: number; y: number }> = [];

      for (let yy = y; yy < y + cellSize; yy += 1) {
        for (let xx = x; xx < x + cellSize; xx += 1) {
          const { r, g, b } = intToRgb(working.getPixelColor(xx, yy));
          total += 1;
          if (isSkinPixel(r, g, b)) skin += 1;
          if (isLightCigarettePixel(r, g, b)) {
            light += 1;
            lightPoints.push({ x: xx - x, y: yy - y });
          }
          if (isAshDarkPixel(r, g, b)) {
            dark += 1;
            darkPoints.push({ x: xx - x, y: yy - y });
          }
          if (isEmberPixel(r, g, b)) {
            ember += 1;
            emberPoints.push({ x: xx - x, y: yy - y });
          }
          if (isPurpleVehiclePixel(r, g, b)) purple += 1;
          if (isLedOrDisplayPixel(r, g, b)) display += 1;
          if (isDarkGlassPixel(r, g, b)) glass += 1;
        }
      }

      if (lightPoints.length < (allowWithoutPerson ? 4 : 8) || x < 2 || y < 2 || x + cellSize > width - 2 || y + cellSize > height - 2) continue;

      const skinRatio = skin / total;
      const lightRatio = light / total;
      const darkRatio = dark / total;
      const emberRatio = ember / total;
      const purpleRatio = purple / total;
      const displayRatio = display / total;
      const glassRatio = glass / total;
      const xs = lightPoints.map((point) => point.x);
      const ys = lightPoints.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = maxX - minX + 1;
      const spanY = maxY - minY + 1;
      const longSide = Math.max(spanX, spanY);
      const shortSide = Math.min(spanX, spanY);
      const horizontal = spanX >= spanY;
      const elongated = longSide >= 11 && longSide / Math.max(1, shortSide) > 2.8;
      const relaxedElongated = longSide >= 6 && longSide / Math.max(1, shortSide) > 1.6;
      const narrowStroke = shortSide <= (allowWithoutPerson ? 5 : 3);
      const pinchedContext = skinRatio > 0.16 && skinRatio < 0.46;
      const relaxedPinchedContext = skinRatio > 0.04 && skinRatio < 0.82;
      const cleanBackground = purpleRatio < 0.02 && displayRatio < 0.015 && glassRatio < 0.3;
      const relaxedBackground = purpleRatio < 0.05 && displayRatio < 0.08 && glassRatio < 0.52;
      const sparseCigaretteBody = lightRatio > 0.025 && lightRatio < 0.11;
      const relaxedBody = lightRatio > 0.01 && lightRatio < 0.22;
      const hasEndpointTip = [...darkPoints, ...emberPoints].some((point) => {
        const axis = horizontal ? point.x : point.y;
        const cross = horizontal ? point.y : point.x;
        const lowEnd = horizontal ? minX : minY;
        const highEnd = horizontal ? maxX : maxY;
        const crossLow = horizontal ? minY : minX;
        const crossHigh = horizontal ? maxY : maxX;
        const closeToLine = cross >= crossLow - 2 && cross <= crossHigh + 2;
        const closeToEnd = Math.abs(axis - lowEnd) <= 2 || Math.abs(axis - highEnd) <= 2;
        return closeToLine && closeToEnd;
      });
      const strongTip = hasEndpointTip && (emberRatio > 0.006 || darkRatio > 0.07);
      const fallbackTip = hasEndpointTip && (emberRatio > 0.001 || darkRatio > 0.03);
      const fallbackCandidate =
        allowWithoutPerson &&
        relaxedElongated &&
        narrowStroke &&
        relaxedPinchedContext &&
        relaxedBackground &&
        relaxedBody &&
        fallbackTip;

      if (
        (elongated && narrowStroke && pinchedContext && cleanBackground && sparseCigaretteBody && strongTip) ||
        fallbackCandidate
      ) {
        const box: DetectionBox = {
          x: Math.round(x / scale),
          y: Math.round(y / scale),
          width: Math.round(cellSize / scale),
          height: Math.round(cellSize / scale),
          confidence: Number(
            Math.min(
              fallbackCandidate ? 0.74 : 0.66,
              0.42 + skinRatio * 0.1 + lightRatio * 0.55 + darkRatio * 0.28 + emberRatio * 2 + (fallbackCandidate ? 0.08 : 0)
            ).toFixed(2)
          ),
          kind: 'hand'
        };

        if (
          intersectsPerson(box, persons) ||
          (fallbackCandidate && isLikelyFallbackHandZone(box, image.bitmap.width, image.bitmap.height))
        ) {
          boxes.push(box);
        }
      }
    }
  }

  return boxes
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function detectSmokingActionFallbackBoxes(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  allowWithoutPerson = false
) {
  if (!allowWithoutPerson) return [];

  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(image.bitmap.width, image.bitmap.height));
  const working = image.clone();

  if (scale < 1) {
    working.resize({
      w: Math.round(image.bitmap.width * scale),
      h: Math.round(image.bitmap.height * scale)
    });
  }

  const width = working.bitmap.width;
  const height = working.bitmap.height;
  const boxes: DetectionBox[] = [];
  const cellSize = 24;
  const stride = 6;

  for (let y = 0; y <= height - cellSize; y += stride) {
    for (let x = 0; x <= width - cellSize; x += stride) {
      let skin = 0;
      let light = 0;
      let dark = 0;
      let ember = 0;
      let purple = 0;
      let display = 0;
      let glass = 0;
      let edge = 0;
      let total = 0;
      const lightPoints: Array<{ x: number; y: number }> = [];
      const darkPoints: Array<{ x: number; y: number }> = [];
      const emberPoints: Array<{ x: number; y: number }> = [];

      for (let yy = y; yy < y + cellSize; yy += 1) {
        for (let xx = x; xx < x + cellSize; xx += 1) {
          const { r, g, b } = intToRgb(working.getPixelColor(xx, yy));
          total += 1;
          if (isSkinPixel(r, g, b)) skin += 1;
          if (isLightCigarettePixel(r, g, b)) {
            light += 1;
            lightPoints.push({ x: xx - x, y: yy - y });
          }
          if (isAshDarkPixel(r, g, b)) {
            dark += 1;
            darkPoints.push({ x: xx - x, y: yy - y });
          }
          if (isEmberPixel(r, g, b)) {
            ember += 1;
            emberPoints.push({ x: xx - x, y: yy - y });
          }
          if (isPurpleVehiclePixel(r, g, b)) purple += 1;
          if (isLedOrDisplayPixel(r, g, b)) display += 1;
          if (isDarkGlassPixel(r, g, b)) glass += 1;

          if (xx + 1 < x + cellSize && yy + 1 < y + cellSize) {
            const nextX = intToRgb(working.getPixelColor(xx + 1, yy));
            const nextY = intToRgb(working.getPixelColor(xx, yy + 1));
            if (isHighContrastEdge({ r, g, b }, nextX) || isHighContrastEdge({ r, g, b }, nextY)) {
              edge += 1;
            }
          }
        }
      }

      if (lightPoints.length < 2 && emberPoints.length < 2) continue;

      const skinRatio = skin / total;
      const lightRatio = light / total;
      const darkRatio = dark / total;
      const emberRatio = ember / total;
      const purpleRatio = purple / total;
      const displayRatio = display / total;
      const glassRatio = glass / total;
      const edgeRatio = edge / total;
      const xs = lightPoints.map((point) => point.x);
      const ys = lightPoints.map((point) => point.y);
      const minX = xs.length > 0 ? Math.min(...xs) : 0;
      const maxX = xs.length > 0 ? Math.max(...xs) : 0;
      const minY = ys.length > 0 ? Math.min(...ys) : 0;
      const maxY = ys.length > 0 ? Math.max(...ys) : 0;
      const spanX = maxX - minX + 1;
      const spanY = maxY - minY + 1;
      const longSide = Math.max(spanX, spanY);
      const shortSide = Math.max(1, Math.min(spanX, spanY));
      const aspect = longSide / shortSide;
      const horizontal = spanX >= spanY;
      const hasEndpointTip = [...darkPoints, ...emberPoints].some((point) => {
        const axis = horizontal ? point.x : point.y;
        const cross = horizontal ? point.y : point.x;
        const lowEnd = horizontal ? minX : minY;
        const highEnd = horizontal ? maxX : maxY;
        const crossLow = horizontal ? minY : minX;
        const crossHigh = horizontal ? maxY : maxX;
        const closeToLine = cross >= crossLow - 3 && cross <= crossHigh + 3;
        const closeToEnd = Math.abs(axis - lowEnd) <= 4 || Math.abs(axis - highEnd) <= 4;
        return closeToLine && closeToEnd;
      });

      const stickLike = longSide >= 4 && aspect > 1.25;
      const brightStickLike = longSide >= 6 && aspect > 1.6;
      const handContext = skinRatio > 0.03 && skinRatio < 0.96;
      const visibleBody = lightRatio > 0.008 && lightRatio < 0.34;
      const heatedTip = emberRatio > 0.006 || darkRatio > 0.08;
      const mixedSignal = lightRatio + darkRatio + emberRatio > 0.08;
      const cleanEnough = purpleRatio < 0.08 && displayRatio < 0.12 && glassRatio < 0.55 && edgeRatio < 0.78;
      const nearUpperHandArea = y < height * 0.78;
      const smokingActionCandidate =
        handContext &&
        visibleBody &&
        heatedTip &&
        mixedSignal &&
        cleanEnough &&
        nearUpperHandArea &&
        (brightStickLike || (stickLike && hasEndpointTip) || (emberRatio > 0.035 && lightPoints.length >= 3));

      if (!smokingActionCandidate) continue;

      const confidence = Math.min(
        0.76,
        0.4 +
          Math.min(0.18, skinRatio * 0.2) +
          Math.min(0.12, lightRatio * 0.9) +
          Math.min(0.16, darkRatio * 0.24) +
          Math.min(0.18, emberRatio * 0.35) +
          Math.min(0.1, aspect * 0.025) +
          (hasEndpointTip ? 0.06 : 0) -
          (emberRatio > 0.55 ? 0.06 : 0)
      );

      const box: DetectionBox = {
        x: Math.round(x / scale),
        y: Math.round(y / scale),
        width: Math.round(cellSize / scale),
        height: Math.round(cellSize / scale),
        confidence: Number(confidence.toFixed(2)),
        kind: 'hand'
      };

      if (isLikelyFallbackHandZone(box, image.bitmap.width, image.bitmap.height)) {
        boxes.push(box);
      }
    }
  }

  return rankFallbackHandBoxes(dedupeBoxes(boxes), image.bitmap.width, image.bitmap.height, []).slice(0, 3);
}

function tempExtension(mimetype: string) {
  if (mimetype.includes('png')) return '.png';
  if (mimetype.includes('webp')) return '.webp';
  return '.jpg';
}

async function runYolo(file: UploadedImage, modelName = 'yolov8n.pt', classes = ''): Promise<YoloResult> {
  const imagePath = path.join(tmpdir(), `smoke-report-${randomUUID()}${tempExtension(file.mimetype)}`);
  await writeFile(imagePath, file.buffer);

  try {
    return await new Promise<YoloResult>((resolve) => {
      const args = [yoloScript, imagePath, modelName];
      if (classes) args.push(classes);
      const child = spawn(pythonExecutable, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: pythonCacheHome,
          PYTHONPATH: pythonPath
        },
        windowsHide: true
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        resolve({ ok: false, detections: [], error: error.message });
      });
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ ok: false, detections: [], error: stderr || `YOLO exited with code ${code}` });
          return;
        }

        const jsonLine = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('{') && line.endsWith('}'))
          .at(-1);

        if (!jsonLine) {
          resolve({ ok: false, detections: [], error: 'YOLO did not return JSON' });
          return;
        }

        try {
          resolve(JSON.parse(jsonLine) as YoloResult);
        } catch (error) {
          resolve({ ok: false, detections: [], error: error instanceof Error ? error.message : 'Invalid YOLO JSON' });
        }
      });
    });
  } finally {
    await unlink(imagePath).catch(() => undefined);
  }
}

async function runYoloWorld(file: UploadedImage, classes = 'cigarette butt'): Promise<YoloResult> {
  const imagePath = path.join(tmpdir(), `smoke-report-world-${randomUUID()}${tempExtension(file.mimetype)}`);
  await writeFile(imagePath, file.buffer);

  try {
    return await new Promise<YoloResult>((resolve) => {
      const child = spawn(
        pythonExecutable,
        [
          yoloScript,
          imagePath,
          'yolov8s-world.pt',
          classes
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            HOME: pythonCacheHome,
            PYTHONPATH: pythonPath
          },
          windowsHide: true
        }
      );
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        resolve({ ok: false, detections: [], error: error.message });
      });
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ ok: false, detections: [], error: stderr || `YOLO-World exited with code ${code}` });
          return;
        }

        const jsonLine = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('{') && line.endsWith('}'))
          .at(-1);

        if (!jsonLine) {
          resolve({ ok: false, detections: [], error: 'YOLO-World did not return JSON' });
          return;
        }

        try {
          resolve(JSON.parse(jsonLine) as YoloResult);
        } catch (error) {
          resolve({ ok: false, detections: [], error: error instanceof Error ? error.message : 'Invalid YOLO-World JSON' });
        }
      });
    });
  } finally {
    await unlink(imagePath).catch(() => undefined);
  }
}

async function detectCigaretteEvidence(mode: DetectionMode, file?: Express.Multer.File) {
  const emptyYolo: YoloResult = { ok: false, detections: [], error: 'not run' };

  if (mode === 'none') return { detectedResult: 'none' as const, boxes: [], confidence: 0, yolo: emptyYolo };
  if (mode === 'hand' || mode === 'floor') {
    return {
      detectedResult: mode,
      boxes: [{ x: 0, y: 0, width: 0, height: 0, confidence: 0.9, kind: mode }],
      confidence: 0.9,
      yolo: emptyYolo
    };
  }

  if (!isUsableImage(file)) {
    return { detectedResult: 'none' as const, boxes: [], confidence: 0, yolo: emptyYolo };
  }

  const image = await Jimp.read(file.buffer);
  const imageWidth = image.bitmap.width;
  const imageHeight = image.bitmap.height;
  const imageSignals = summarizeImageSignals(image);

  if (isLikelyPhoneUiScreenshot(imageWidth, imageHeight, imageSignals)) {
    return {
      detectedResult: 'none' as const,
      boxes: [],
      confidence: 0.01,
      yolo: emptyYolo
    };
  }

  if (isLikelySmokingCloseup(imageWidth, imageHeight, imageSignals)) {
    return {
      detectedResult: 'hand' as const,
      boxes: [buildSmokingCloseupFallbackBox(imageWidth, imageHeight)],
      confidence: 0.62,
      yolo: emptyYolo
    };
  }

  const yolo = await runYolo(file, 'yolov8n.pt');
  const persons = yolo.detections.filter((item) => item.label === 'person' && item.confidence > 0.35);
  const allowFallbackHandHeuristics = !yolo.ok || persons.length === 0;
  const world = await runYoloWorld(file, 'cigarette butt');
  const worldBoxes: DetectionBox[] = world.detections
    .map((item) => ({
      x: Math.round(item.x),
      y: Math.round(item.y),
      width: Math.round(item.width),
      height: Math.round(item.height),
      confidence: Number(item.confidence.toFixed(2)),
      kind: 'floor' as const
    }))
    .filter((box) => isPlausibleFloorWorldBox(box, imageWidth, imageHeight, persons));

  if (worldBoxes.length > 0) {
    return {
      detectedResult: worldBoxes[0].kind,
      boxes: worldBoxes,
      confidence: worldBoxes[0].confidence,
      yolo: {
        ok: yolo.ok || world.ok,
        model: world.ok ? world.model : yolo.model,
        detections: [...yolo.detections, ...world.detections],
        error: yolo.error || world.error
      }
    };
  }

  const boxes = rankFallbackHandBoxes(
    keepOneHandBoxPerPerson(
    mergeNearbyBoxes([
      ...detectCigaretteLikeBoxes(image, persons, allowFallbackHandHeuristics),
      ...detectPinchedCigaretteBoxes(image, persons, allowFallbackHandHeuristics),
      ...detectSmokingActionFallbackBoxes(image, allowFallbackHandHeuristics)
    ]),
    persons
    ),
    imageWidth,
    imageHeight,
    persons
  ).slice(0, 6);
  const bestConfidence = boxes[0]?.confidence ?? 0;
  const smokingCloseupBias = isLikelySmokingCloseup(imageWidth, imageHeight, imageSignals);
  const requiredConfidence = allowFallbackHandHeuristics
    ? smokingCloseupBias
      ? 0.32
      : 0.46
    : 0.68;
  const fallbackSmokingBox = smokingCloseupBias && boxes.length === 0
    ? [buildSmokingCloseupFallbackBox(imageWidth, imageHeight)]
    : [];
  const finalBoxes = fallbackSmokingBox.length > 0 ? fallbackSmokingBox : boxes;
  const finalConfidence = finalBoxes[0]?.confidence ?? bestConfidence;

  if (finalConfidence < requiredConfidence) {
    return {
      detectedResult: 'none' as const,
      boxes: finalBoxes,
      confidence: finalConfidence,
      yolo: {
        ok: yolo.ok || world.ok,
        model: world.ok ? world.model : yolo.model,
        detections: [...yolo.detections, ...world.detections],
        error: yolo.error || world.error
      }
    };
  }

  const detectedResult: DetectedResult = finalBoxes[0].kind;
  return {
    detectedResult,
    boxes: finalBoxes,
    confidence: finalConfidence,
    yolo: {
      ok: yolo.ok || world.ok,
      model: world.ok ? world.model : yolo.model,
      detections: [...yolo.detections, ...world.detections],
      error: yolo.error || world.error
    }
  };
}

function getEvidenceLabel(result: DetectedResult) {
  if (result === 'hand') return '人手上的烟头';
  if (result === 'floor') return '地板上的烟头';
  return '未识别到烟头';
}

function hasWalletAddress(value: unknown): value is string {
  return typeof value === 'string' && ethers.isAddress(value);
}

async function rewardOnChain(userAddress: string, score: number, reportId: string) {
  if (!adminPrivateKey || score <= 0) {
    return null;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(adminPrivateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractAbi, wallet);
  const tx = await contract.rewardUser(userAddress, BigInt(score), reportId);
  const receipt = await tx.wait();

  return {
    hash: tx.hash as string,
    blockNumber: Number(receipt?.blockNumber ?? 0)
  };
}

async function readChainBalance(userAddress: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);
  const [playerBalance, treasuryBalance] = await contract.getBalance(userAddress);

  return {
    playerBalance: Number(playerBalance),
    treasury: Number(treasuryBalance)
  };
}

async function analyzeReport(mode: DetectionMode, file?: Express.Multer.File): Promise<AnalysisResponse> {
  const detection = await detectCigaretteEvidence(mode, file);
  const detectedResult = detection.detectedResult;
  const hasCigarette = detectedResult !== 'none';
  const detectedCigaretteCount = hasCigarette ? Math.max(1, detection.boxes.length) : 0;
  const rewardCoins = hasCigarette ? randomRewardCoins() : 0;
  const cigaretteCount = detectedCigaretteCount * rewardCoins;
  const evidenceLabel = getEvidenceLabel(detectedResult);

  return {
    detectorVersion,
    detectedResult,
    detectedCigaretteCount,
    rewardCoins,
    cigaretteCount,
    evidenceLabel,
    fileName: file?.originalname ?? null,
    analyzedAt: new Date().toISOString(),
    confidence: detection.confidence,
    boxes: detection.boxes,
    yolo: detection.yolo,
    rewardSignal: hasCigarette
      ? `识别到烟头，奖励 ${cigaretteCount} 金币。`
      : '未识别到烟头，奖励 0 金币。',
    resultText: hasCigarette
      ? `举报属实，系统识别到${evidenceLabel}。`
      : '未识别到烟头，本次举报未通过。'
  };
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'integrated-smoke-quest', detectorVersion });
});

app.get('/api/analyze-report', (_request, response) => {
  response.status(200).json({
    ok: true,
    message: 'This endpoint accepts POST only. Upload an image with field name "photo" and optional mode=auto|hand|floor|none.'
  });
});

app.post('/api/analyze-report', upload.single('photo'), async (request, response, next) => {
  try {
    const requestedMode = String(request.body?.mode ?? 'auto') as DetectionMode;
    const mode: DetectionMode = ['auto', 'hand', 'floor', 'none'].includes(requestedMode)
      ? requestedMode
      : 'auto';

    response.json(await analyzeReport(mode, request.file));
  } catch (error) {
    next(error);
  }
});

app.get('/api/game/balance', (_request, response) => {
  response.json({
    playerBalance: gameState.playerBalance,
    treasury: gameState.treasury,
    reportCount: gameState.reportCount,
    purchases: gameState.purchases
  });
});

app.get('/api/game/chain-balance', async (request, response, next) => {
  try {
    const userAddress = request.query.address;

    if (!hasWalletAddress(userAddress)) {
      response.status(400).json({ error: 'valid wallet address is required' });
      return;
    }

    response.json(await readChainBalance(userAddress));
  } catch (error) {
    next(error);
  }
});

app.post('/api/game/reward', async (request, response, next) => {
  const cigaretteCount = Number(request.body?.cigaretteCount ?? 0);
  const reportId = String(request.body?.reportId || `local-${Date.now()}`);
  const userAddress = request.body?.userAddress;

  if (!Number.isFinite(cigaretteCount) || cigaretteCount < 0) {
    response.status(400).json({ error: 'cigaretteCount must be a non-negative number' });
    return;
  }

  if (gameState.rewardedReports.has(reportId)) {
    response.status(409).json({
      error: 'report already rewarded',
      playerBalance: gameState.playerBalance,
      treasury: gameState.treasury
    });
    return;
  }

  try {
    const chainReward = hasWalletAddress(userAddress)
      ? await rewardOnChain(userAddress, cigaretteCount, reportId)
      : null;

    gameState.rewardedReports.add(reportId);
    gameState.reportCount += 1;
    const reward = cigaretteCount;
    gameState.playerBalance += reward;

    if (hasWalletAddress(userAddress) && chainReward) {
      const chainBalance = await readChainBalance(userAddress);
      gameState.playerBalance = chainBalance.playerBalance;
      gameState.treasury = chainBalance.treasury;
    }

    response.json({
      playerBalance: gameState.playerBalance,
      treasury: gameState.treasury,
      reportCount: gameState.reportCount,
      purchases: gameState.purchases,
      cigaretteCount,
      reward,
      reportId,
      chainRewarded: Boolean(chainReward),
      chainRewardTxHash: chainReward?.hash ?? null,
      chainRewardBlockNumber: chainReward?.blockNumber ?? null
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/game/purchase', (request, response) => {
  const productId = String(request.body?.productId || '');
  const name = String(request.body?.name || productId || 'item');
  const price = Number(request.body?.price ?? 0);
  const alreadyPaid = Boolean(request.body?.alreadyPaid);
  const syncedPlayerBalance = Number(request.body?.playerBalance);
  const syncedTreasury = Number(request.body?.treasury);

  if (!Number.isFinite(price) || price < 0) {
    response.status(400).json({ error: 'price must be a non-negative number' });
    return;
  }

  if (alreadyPaid) {
    if (Number.isFinite(syncedPlayerBalance)) {
      gameState.playerBalance = syncedPlayerBalance;
    }

    if (Number.isFinite(syncedTreasury)) {
      gameState.treasury = syncedTreasury;
    }
  } else if (gameState.playerBalance < price) {
    response.status(400).json({
      error: 'insufficient balance',
      playerBalance: gameState.playerBalance,
      treasury: gameState.treasury
    });
    return;
  } else {
    gameState.playerBalance -= price;
    gameState.treasury += price;
  }

  gameState.purchases.unshift({ id: productId, name, price });
  gameState.purchases = gameState.purchases.slice(0, 12);

  response.json({
    playerBalance: gameState.playerBalance,
    treasury: gameState.treasury,
    purchases: gameState.purchases
  });
});

app.listen(port, () => {
  console.log(`integrated smoke quest API running at http://localhost:${port}`);
});
