import { useState } from "react";

const ITEM_META = {
  spray: {
    icon: "🧴",
    actionLabel: "💨 当场施展魔法消灭烟鬼",
    effectTitle: "魔法生效",
    result: "把二手烟鬼轰回了老家！",
    accentClass: "is-spray",
    stageText: "超级柚子喷雾全场净化",
  },
  leaf: {
    icon: "🍃",
    actionLabel: "💨 当场施展魔法消灭烟鬼",
    effectTitle: "魔法生效",
    result: "把二手烟鬼驱散得干干净净！",
    accentClass: "is-leaf",
    stageText: "普通柚子叶驱散烟鬼",
  },
  default: {
    icon: "✨",
    actionLabel: "💨 当场施展魔法消灭烟鬼",
    effectTitle: "魔法生效",
    result: "把二手烟鬼当场赶跑了！",
    accentClass: "is-default",
    stageText: "现场魔法已经触发",
  },
};

function getItemMeta(type) {
  return ITEM_META[type] ?? ITEM_META.default;
}

export default function ItemUsageModule({
  inventory,
  lastHandoff,
  onConsume,
  onUseItem,
}) {
  const [lastCast, setLastCast] = useState(null);
  const [burstKey, setBurstKey] = useState(0);

  const currentMeta = inventory ? getItemMeta(inventory.type) : ITEM_META.default;
  const canUseItem = Boolean(inventory);

  function handleUseItem() {
    if (!inventory) {
      return;
    }

    const usedMeta = getItemMeta(inventory.type);
    const castMessage = `魔法生效 🌿！你使用了[${inventory.name}]，${usedMeta.result}`;
    const castResult = {
      title: usedMeta.effectTitle,
      item: inventory,
      itemName: inventory.name,
      message: castMessage,
      accentClass: usedMeta.accentClass,
      stageText: usedMeta.stageText,
      icon: usedMeta.icon,
      usedAt: new Date().toISOString(),
    };

    setLastCast(castResult);
    setBurstKey((value) => value + 1);
    onUseItem?.(castResult);
    onConsume?.(inventory);
  }

  return (
    <section className="item-usage-card">
      <div className="inventory-strip">
        <span className="strip-label">🎒 当前手持</span>
        <div className={`inventory-pill ${canUseItem ? currentMeta.accentClass : "is-empty"}`}>
          <span className="inventory-icon">{canUseItem ? currentMeta.icon : "🫧"}</span>
          <span>{canUseItem ? inventory.name : "暂无道具，等待商场发货"}</span>
        </div>
      </div>

      <div className="signal-panel">
        <span className="strip-label">📨 小欧交接</span>
        <p className="signal-copy">
          {lastHandoff?.message ?? "等待 mall:purchase-success 或 window.normanGame.receiveItem(item)"}
        </p>
        {lastHandoff?.paymentMessage ? (
          <p className="signal-subcopy">Lae 结账结果：{lastHandoff.paymentMessage}</p>
        ) : null}
      </div>

      <button
        type="button"
        className={`cast-button ${currentMeta.accentClass}`}
        disabled={!canUseItem}
        onClick={handleUseItem}
      >
        {canUseItem ? currentMeta.actionLabel : "⌛ 暂时无法施法"}
      </button>

      <div className={`result-panel ${lastCast ? lastCast.accentClass : ""}`}>
        <div className="result-header">
          <span className="result-tag">交接暗号</span>
          {lastCast ? <Fireworks key={burstKey} /> : null}
        </div>

        {lastCast ? (
          <>
            <h2>{lastCast.title} 🌿</h2>
            <p className="result-copy">{lastCast.message}</p>
          </>
        ) : (
          <>
            <h2>等待施法</h2>
            <p className="result-copy">
              点下按钮后，这里会显示“魔法生效”的反馈，清空当前道具，并向外广播
              `norman:magic-cast`。
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Fireworks() {
  return (
    <div className="fireworks" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
