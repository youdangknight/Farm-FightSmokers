import { useEffect, useRef, useState } from "react";
import ItemUsageModule from "./components/ItemUsageModule";
import LegacyYuzuGame from "./components/LegacyYuzuGame";

const ITEMS = {
  spray: {
    id: "super-spray",
    name: "超级柚子喷雾",
    type: "spray",
    price: 30,
  },
  leaf: {
    id: "normal-leaf",
    name: "普通柚子叶",
    type: "leaf",
    price: 10,
  },
};

const ITEM_ALIASES = {
  "super-spray": ITEMS.spray,
  spray: ITEMS.spray,
  "超级喷雾": ITEMS.spray,
  "超级柚子喷雾": ITEMS.spray,
  "normal-leaf": ITEMS.leaf,
  leaf: ITEMS.leaf,
  "普通柚子叶": ITEMS.leaf,
};

function normalizeInventory(input) {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return ITEM_ALIASES[input] ?? null;
  }

  const lookupKeys = [input.id, input.type, input.name];

  for (const key of lookupKeys) {
    if (key && ITEM_ALIASES[key]) {
      return {
        ...ITEM_ALIASES[key],
        ...input,
      };
    }
  }

  return input.name ? input : null;
}

function createHandoffState(item, detail = {}) {
  return {
    item,
    paymentMessage: detail.paymentMessage ?? null,
    playerCoins: detail.playerCoins ?? null,
    developerVault: detail.developerVault ?? null,
    message:
      detail.handoffMessage ?? `玩家买了一个${item.name}，Norman 接住！`,
    receivedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [inventory, setInventory] = useState(null);
  const [lastHandoff, setLastHandoff] = useState(null);
  const [lastMagicCast, setLastMagicCast] = useState(null);
  const latestStateRef = useRef({
    inventory: null,
    lastHandoff: null,
    lastMagicCast: null,
  });

  useEffect(() => {
    latestStateRef.current = {
      inventory,
      lastHandoff,
      lastMagicCast,
    };
  }, [inventory, lastHandoff, lastMagicCast]);

  useEffect(() => {
    function receiveItem(rawItem, detail = {}) {
      const nextItem = normalizeInventory(rawItem ?? detail.product ?? detail.item);

      if (!nextItem) {
        return null;
      }

      const handoffState = createHandoffState(nextItem, detail);

      setInventory(nextItem);
      setLastHandoff(handoffState);
      window.dispatchEvent(
        new CustomEvent("norman:inventory-received", {
          detail: handoffState,
        }),
      );

      return nextItem;
    }

    function handleMallPurchaseSuccess(event) {
      receiveItem(event.detail?.product, event.detail ?? {});
    }

    function handleNormanReceiveItem(event) {
      receiveItem(event.detail?.item ?? event.detail, event.detail ?? {});
    }

    window.addEventListener("mall:purchase-success", handleMallPurchaseSuccess);
    window.addEventListener("norman:receive-item", handleNormanReceiveItem);
    window.normanGame = {
      receiveItem,
      clearInventory() {
        setInventory(null);
      },
      getState() {
        return latestStateRef.current;
      },
    };

    return () => {
      window.removeEventListener("mall:purchase-success", handleMallPurchaseSuccess);
      window.removeEventListener("norman:receive-item", handleNormanReceiveItem);
      delete window.normanGame;
    };
  }, []);

  function handleUseItem(castResult) {
    setLastMagicCast(castResult);
    window.dispatchEvent(
      new CustomEvent("norman:magic-cast", {
        detail: {
          ...castResult,
          handoffMessage: lastHandoff?.message ?? null,
        },
      }),
    );
  }

  function emitMallSuccessDemo(item) {
    window.dispatchEvent(
      new CustomEvent("mall:purchase-success", {
        detail: {
          product: item,
          playerCoins: item.type === "spray" ? 0 : 20,
          developerVault: item.type === "spray" ? 30 : 10,
          paymentMessage: `付款成功，开发者已收款 ${item.price} 币！`,
          handoffMessage: `玩家买了一个${item.name}，Norman 接住！`,
        },
      }),
    );
  }

  return (
    <main className="app-shell">
      <section className="app-panel">
        <div className="panel-copy">
          <p className="eyebrow">第四区 / Norman 对接页</p>
          <h1>柚子叶护法</h1>
          <p className="panel-description">
            保留原来的 HTML 玩法场景，并把第四区代码对齐到小欧、Lae、being 的联调说明。
          </p>
        </div>

        <div className="app-grid">
          <LegacyYuzuGame magicCastSignal={lastMagicCast} />

          <div className="module-stack">
            <ItemUsageModule
              inventory={inventory}
              lastHandoff={lastHandoff}
              onUseItem={handleUseItem}
              onConsume={() => setInventory(null)}
            />

            <div className="integration-panel">
              <span className="debug-label">对接说明</span>
              <p className="integration-copy">
                输入监听：`mall:purchase-success`、`norman:receive-item`
              </p>
              <p className="integration-copy">
                主动接口：`window.normanGame.receiveItem(item)`
              </p>
              <p className="integration-copy">
                输出事件：`norman:inventory-received`、`norman:magic-cast`
              </p>
              {lastMagicCast ? (
                <p className="integration-copy">最近施法：{lastMagicCast.message}</p>
              ) : null}
            </div>

            <div className="debug-panel">
              <span className="debug-label">模拟小欧交接</span>
              <div className="debug-actions">
                <button type="button" onClick={() => emitMallSuccessDemo(ITEMS.spray)}>
                  模拟交接超级喷雾
                </button>
                <button type="button" onClick={() => emitMallSuccessDemo(ITEMS.leaf)}>
                  模拟交接普通柚子叶
                </button>
                <button type="button" onClick={() => setInventory(null)}>
                  清空道具
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
