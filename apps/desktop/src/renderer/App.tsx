import { useEffect, useState } from "react";
import type { ProductReadiness } from "../shared/product-api.js";

type ReadinessState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly value: ProductReadiness }
  | { readonly kind: "failed"; readonly message: string };

const initialState: ReadinessState = { kind: "loading" };

export function App() {
  const [readiness, setReadiness] = useState<ReadinessState>(initialState);

  useEffect(() => {
    let active = true;
    void window.bubu.system
      .getReadiness()
      .then((value) => {
        if (active) setReadiness({ kind: "loaded", value });
      })
      .catch((error: unknown) => {
        if (active) {
          setReadiness({
            kind: "failed",
            message: error instanceof Error ? error.message : "桌面服务无法启动",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="shell">
      <aside className="rail" aria-label="数据联系人">
        <div className="brand-mark" aria-hidden="true">B</div>
        <div className="rail-item rail-item-active" title="工作台">⌂</div>
        <div className="rail-item" title="数据联系人">▦</div>
        <div className="rail-spacer" />
        <div className="rail-item" title="设置">⚙</div>
      </aside>

      <section className="contacts">
        <header className="contacts-header">
          <div>
            <p className="eyebrow">LOCAL DATA AGENT</p>
            <h1>BuBu</h1>
          </div>
          <button type="button" className="add-button" disabled aria-label="导入数据">＋</button>
        </header>
        <div className="search-placeholder">搜索数据联系人</div>
        <article className="contact-card contact-card-active">
          <span className="contact-avatar">B</span>
          <span>
            <strong>产品准备中心</strong>
            <small>正在检查本地服务</small>
          </span>
        </article>
        <p className="local-note">默认本地模式 · 原始数据不会自动出站</p>
      </section>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">PRIVATE BY DEFAULT</p>
            <h2>本地 AI 数据工作台</h2>
          </div>
          <span className="mode-pill">本地模式</span>
        </header>

        <div className="conversation">
          <div className="hero-card">
            <p className="hero-kicker">Electron migration foundation</p>
            <h3>数据留在本机，AI 只看经过策略批准的上下文。</h3>
            <p>
              安全桌面壳层、AI 运行时和 Go 数据内核已经隔离成独立进程。导入与对话功能会按同一套边界逐步迁移。
            </p>
          </div>

          <section className="status-panel" aria-live="polite">
            <div className="status-heading">
              <h3>运行状态</h3>
              <span className={`status-dot status-${readiness.kind}`} />
            </div>
            {readiness.kind === "loading" && <p>正在启动本地服务…</p>}
            {readiness.kind === "failed" && <p className="error-text">{readiness.message}</p>}
            {readiness.kind === "loaded" && (
              <div className="service-grid">
                {readiness.value.services.map((service) => (
                  <article className="service-card" key={service.name}>
                    <div>
                      <strong>{service.name === "data-core" ? "Go 数据内核" : "Node AI 运行时"}</strong>
                      <span className={`service-state service-${service.status}`}>{service.status}</span>
                    </div>
                    <small>{service.capabilities.join(" · ") || service.message || "等待服务能力"}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="composer" aria-label="对话输入将在数据纵切完成后启用">
          <span>导入第一个 CSV 或 Excel 后，在这里和数据聊天</span>
          <button type="button" disabled>发送</button>
        </footer>
      </section>
    </main>
  );
}
