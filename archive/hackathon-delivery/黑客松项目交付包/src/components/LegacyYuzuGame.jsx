import { useEffect, useState } from "react";

const GHOSTS = ["👻", "😤", "🤢", "😈", "💀"];
const SMOKES = ["💨", "☁️", "🌫️"];
const LEVELS = [
  { at: 0, name: "新手驱邪师" },
  { at: 10, name: "见习法师" },
  { at: 50, name: "熟练祛秽者" },
  { at: 100, name: "柚叶武士" },
  { at: 300, name: "香气大师" },
  { at: 500, name: "驱鬼宗师" },
];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createGhost() {
  const margin = 60;
  const maxX = 340 - 48 - margin;
  const maxY = 260 - 48 - margin;

  return {
    id: crypto.randomUUID(),
    left: margin + Math.random() * maxX,
    top: margin / 2 + Math.random() * maxY,
    emoji: randomFrom(GHOSTS),
    smoke: randomFrom(SMOKES),
    delay: Math.random() * 2,
    fleeing: false,
  };
}

function createStars() {
  return Array.from({ length: 30 }, () => ({
    id: crypto.randomUUID(),
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 2,
  }));
}

function getLevel(total) {
  let level = LEVELS[0];

  for (const current of LEVELS) {
    if (total >= current.at) {
      level = current;
    }
  }

  return level;
}

function getProgress(total, level) {
  const currentIndex = LEVELS.findIndex((entry) => entry.at === level.at);
  const nextLevel = LEVELS[currentIndex + 1];

  if (!nextLevel) {
    return 100;
  }

  return Math.min(100, ((total - level.at) / (nextLevel.at - level.at)) * 100);
}

export default function LegacyYuzuGame({ magicCastSignal }) {
  const [total, setTotal] = useState(() => {
    const saved = Number.parseInt(localStorage.getItem("yuzuTotal") ?? "0", 10);
    return Number.isNaN(saved) ? 0 : saved;
  });
  const [session, setSession] = useState(0);
  const [ghosts, setGhosts] = useState([]);
  const [stars] = useState(createStars);
  const [hitEffects, setHitEffects] = useState([]);
  const [ringKey, setRingKey] = useState(0);
  const [leafSmack, setLeafSmack] = useState(false);

  const level = getLevel(total);
  const progress = getProgress(total, level);

  useEffect(() => {
    localStorage.setItem("yuzuTotal", String(total));
  }, [total]);

  useEffect(() => {
    setGhosts([createGhost(), createGhost()]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGhosts((current) => {
        if (current.length >= 4) {
          return current;
        }

        return [...current, createGhost()];
      });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [ghosts.length]);

  useEffect(() => {
    if (!magicCastSignal) {
      return;
    }

    const activeGhosts = ghosts.filter((ghost) => !ghost.fleeing);

    setLeafSmack(true);
    setRingKey((value) => value + 1);
    window.setTimeout(() => setLeafSmack(false), 200);

    addHitEffect(
      `${magicCastSignal.icon ?? "✨"} ${magicCastSignal.stageText ?? "魔法生效"}`,
      78,
      88,
    );

    if (activeGhosts.length === 0) {
      incrementScore();
      return;
    }

    setGhosts((current) =>
      current.map((ghost) =>
        ghost.fleeing ? ghost : { ...ghost, fleeing: true },
      ),
    );
    incrementScore(activeGhosts.length);
    activeGhosts.forEach((ghost) => scheduleRemoval(ghost.id));
  }, [magicCastSignal]);

  function incrementScore(amount = 1) {
    setTotal((value) => value + amount);
    setSession((value) => value + amount);
  }

  function addHitEffect(text, left, top) {
    const effectId = crypto.randomUUID();

    setHitEffects((current) => [...current, { id: effectId, text, left, top }]);
    window.setTimeout(() => {
      setHitEffects((current) => current.filter((effect) => effect.id !== effectId));
    }, 700);
  }

  function scheduleRemoval(ghostId) {
    window.setTimeout(() => {
      setGhosts((current) => current.filter((ghost) => ghost.id !== ghostId));
    }, 500);
  }

  function smiteGhost(targetGhost) {
    if (targetGhost.fleeing) {
      return;
    }

    setGhosts((current) =>
      current.map((ghost) =>
        ghost.id === targetGhost.id ? { ...ghost, fleeing: true } : ghost,
      ),
    );
    addHitEffect(
      randomFrom(["驱散！", "退退退！", "🍃 走你！", "净化！", "🌿 消散！"]),
      targetGhost.left,
      targetGhost.top - 10,
    );
    incrementScore();
    scheduleRemoval(targetGhost.id);
  }

  function handleLeafSmack() {
    setLeafSmack(true);
    setRingKey((value) => value + 1);
    window.setTimeout(() => setLeafSmack(false), 200);

    const activeGhosts = ghosts.filter((ghost) => !ghost.fleeing);

    if (activeGhosts.length === 0) {
      addHitEffect("✨ 清香扩散", 120, 80);
      incrementScore();
      return;
    }

    activeGhosts.forEach((ghost) => smiteGhost(ghost));
  }

  async function handleShareScore() {
    const message = `我用柚子叶驱散了${total}次烟鬼！🍃 #柚子叶护法`;

    if (navigator.share) {
      await navigator.share({ text: message });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      window.alert(`已复制：${message}`);
      return;
    }

    window.alert(message);
  }

  return (
    <section className="legacy-game-card">
      <div className="legacy-root">
        <div className="legacy-stars">
          {stars.map((star) => (
            <span
              key={star.id}
              className="legacy-star"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="legacy-top-bar">
          <div className="legacy-stat-block">
            <span className="legacy-stat-label">总驱散</span>
            <span key={total} className="legacy-stat-value">
              {total}
            </span>
          </div>

          <div className="legacy-title-area">
            <h2>🍋 柚子叶护法</h2>
          </div>

          <div className="legacy-stat-block">
            <span className="legacy-stat-label">本轮</span>
            <span key={session} className="legacy-stat-value">
              {session}
            </span>
          </div>
        </div>

        <div className="legacy-arena">
          <button
            type="button"
            className={`legacy-leaf-btn ${leafSmack ? "is-smack" : ""}`}
            onClick={handleLeafSmack}
            aria-label="驱散烟鬼"
          >
            🍃
          </button>

          {ringKey > 0 ? <span key={ringKey} className="legacy-scent-ring" /> : null}

          {ghosts.map((ghost) => (
            <button
              key={ghost.id}
              type="button"
              className={`legacy-ghost ${ghost.fleeing ? "is-fleeing" : ""}`}
              style={{
                left: `${ghost.left}px`,
                top: `${ghost.top}px`,
                animationDelay: `${ghost.delay}s`,
              }}
              onClick={() => smiteGhost(ghost)}
            >
              <span className="legacy-ghost-body">{ghost.emoji}</span>
              <span className="legacy-ghost-smoke">{ghost.smoke}</span>
            </button>
          ))}

          {hitEffects.map((effect) => (
            <span
              key={effect.id}
              className="legacy-hit-effect"
              style={{
                left: `${effect.left}px`,
                top: `${effect.top}px`,
              }}
            >
              {effect.text}
            </span>
          ))}
        </div>

        <div className="legacy-bottom-bar">
          <div className="legacy-level-label">🌿 等级：{level.name}</div>

          <div className="legacy-progress-track">
            <div
              className="legacy-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="legacy-milestones">
            {LEVELS.slice(1).map((entry) => (
              <span
                key={entry.at}
                className={`legacy-badge ${total >= entry.at ? "is-unlocked" : ""}`}
              >
                {entry.at === 10 && "🌱 10次"}
                {entry.at === 50 && "🌿 50次"}
                {entry.at === 100 && "🍃 100次"}
                {entry.at === 300 && "🌳 300次"}
                {entry.at === 500 && "🏆 宗师"}
              </span>
            ))}
          </div>

          <div className="legacy-hint">
            {magicCastSignal
              ? `第四区已施法：${magicCastSignal.itemName}`
              : "点击柚子叶，驱散烟鬼！"}
          </div>

          {total >= 10 ? (
            <button type="button" className="legacy-share-btn" onClick={handleShareScore}>
              分享成绩 ↗
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
