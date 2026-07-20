import { useEffect, useState } from "react";
import type {
  ProviderConfigurationInput,
  ProviderKind,
  ProviderRegistryState,
  ProviderSummary,
  OperationId,
} from "../shared/product-api.js";
import { PrivacyLedgerPanel } from "./PrivacyLedgerPanel.js";
import { createOperationId } from "./operation.js";

const providerLabels: Readonly<Record<ProviderKind, string>> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  "openai-compatible": "OpenAI 兼容服务",
  ollama: "Ollama（本机）",
};

const providerBaseUrls: Readonly<Record<ProviderKind, string>> = {
  openai: "https://api.openai.com/v1/",
  anthropic: "https://api.anthropic.com/v1/",
  gemini: "https://generativelanguage.googleapis.com/v1/",
  "openai-compatible": "http://127.0.0.1:8000/v1/",
  ollama: "http://127.0.0.1:11434/v1/",
};

interface ProviderDraft {
  readonly id?: string;
  readonly name: string;
  readonly kind: ProviderKind;
  readonly baseUrl: string;
  readonly model: string;
  readonly credential: string;
}

const newProviderDraft: ProviderDraft = {
  name: providerLabels.openai,
  kind: "openai",
  baseUrl: providerBaseUrls.openai,
  model: "",
  credential: "",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "模型配置操作失败";
}

function draftFrom(summary: ProviderSummary): ProviderDraft {
  return {
    id: summary.profile.id,
    name: summary.profile.name,
    kind: summary.profile.kind,
    baseUrl: summary.profile.baseUrl,
    model: summary.profile.model,
    credential: "",
  };
}

function configurationInput(draft: ProviderDraft): ProviderConfigurationInput {
  const credential = draft.credential.trim();
  return {
    ...(draft.id === undefined ? {} : { id: draft.id }),
    name: draft.name,
    kind: draft.kind,
    baseUrl: draft.baseUrl,
    model: draft.model,
    ...(credential.length === 0 ? {} : { credential }),
  };
}

export function ProviderSettings() {
  const [registry, setRegistry] = useState<ProviderRegistryState>();
  const [draft, setDraft] = useState<ProviderDraft>(newProviderDraft);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [ledgerRevision, setLedgerRevision] = useState(0);
  const [testOperationId, setTestOperationId] = useState<OperationId>();

  useEffect(() => {
    let active = true;
    void window.bubu.providers
      .list()
      .then((value) => {
        if (active) setRegistry(value);
      })
      .catch((error: unknown) => {
        if (active) setNotice(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDraft(value: Partial<ProviderDraft>): void {
    setDraft((current) => ({ ...current, ...value }));
  }

  function changeKind(kind: ProviderKind): void {
    setDraft((current) => ({
      ...current,
      kind,
      name: current.id === undefined ? providerLabels[kind] : current.name,
      baseUrl: providerBaseUrls[kind],
    }));
  }

  async function saveProvider(): Promise<void> {
    setBusy("save");
    setNotice(undefined);
    try {
      const next = await window.bubu.providers.save(configurationInput(draft));
      setRegistry(next);
      const saved = next.providers.find(({ profile }) =>
        draft.id === undefined
          ? profile.name === draft.name && profile.model === draft.model
          : profile.id === draft.id,
      );
      if (saved) setDraft(draftFrom(saved));
      setNotice("模型配置已保存；密钥只写入操作系统加密存储。 ");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function selectProvider(providerId: string): Promise<void> {
    setBusy(providerId);
    try {
      setRegistry(await window.bubu.providers.select(providerId));
      setNotice("已设为当前模型。 ");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function testProvider(providerId: string): Promise<void> {
    const operationId = createOperationId();
    setBusy(providerId);
    setTestOperationId(operationId);
    setNotice("正在进行一次最小化模型请求…");
    try {
      const result = await window.bubu.providers.test(providerId, operationId);
      setNotice(`连接成功 · ${result.model} · ${result.latencyMs} ms`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLedgerRevision((value) => value + 1);
      setBusy(undefined);
      setTestOperationId((current) => current === operationId ? undefined : current);
    }
  }

  async function cancelProviderTest(): Promise<void> {
    if (!testOperationId) return;
    await window.bubu.operations.cancel(testOperationId);
    setNotice("正在取消连接测试…");
  }

  async function removeProvider(providerId: string): Promise<void> {
    if (!window.confirm("删除这个模型配置和本地加密凭据？")) return;
    setBusy(providerId);
    try {
      setRegistry(await window.bubu.providers.remove(providerId));
      if (draft.id === providerId) setDraft(newProviderDraft);
      setNotice("模型配置已删除。 ");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="settings-layout">
      <section className="provider-list-panel">
        <header className="settings-section-header">
          <div>
            <p className="hero-kicker">模型配置</p>
            <h3>模型提供商</h3>
          </div>
          <button type="button" className="secondary-action" onClick={() => setDraft(newProviderDraft)}>
            新增
          </button>
        </header>
        {!registry && <p className="empty-copy">正在读取本地模型配置…</p>}
        {registry?.providers.length === 0 && (
          <p className="empty-copy">尚未配置模型。可添加云模型、公司兼容接口或本机 Ollama。</p>
        )}
        <div className="provider-list">
          {registry?.providers.map((summary) => (
            <article
              className={`provider-card ${summary.profile.id === registry.activeProviderId ? "provider-card-active" : ""}`}
              key={summary.profile.id}
            >
              <button type="button" className="provider-card-main" onClick={() => setDraft(draftFrom(summary))}>
                <span className="provider-icon">AI</span>
                <span>
                  <strong>{summary.profile.name}</strong>
                  <small>{providerLabels[summary.profile.kind]} · {summary.profile.model}</small>
                </span>
              </button>
              <span className="provider-badges">
                {summary.profile.id === registry.activeProviderId && <small>当前</small>}
                <small>{summary.hasCredential ? "密钥已加密" : "无密钥"}</small>
              </span>
              <div className="provider-actions">
                <button type="button" onClick={() => void selectProvider(summary.profile.id)} disabled={busy !== undefined}>设为当前</button>
                <button type="button" onClick={() => void testProvider(summary.profile.id)} disabled={busy !== undefined}>测试</button>
                {busy === summary.profile.id && testOperationId && <button type="button" onClick={() => void cancelProviderTest()}>取消测试</button>}
                <button type="button" onClick={() => void removeProvider(summary.profile.id)} disabled={busy !== undefined}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void saveProvider(); }}>
        <div>
          <p className="hero-kicker">凭据仅写</p>
          <h3>{draft.id === undefined ? "添加模型" : "编辑模型"}</h3>
          <p className="settings-copy">渲染界面只能提交新密钥，无法读回已经保存的密钥。模型调用由隔离的 AI 进程执行。</p>
        </div>
        {registry && !registry.encryptionAvailable && (
          <div className="security-warning" role="alert">
            当前系统加密存储不可用。BuBu 将拒绝保存任何密钥；无密钥本地服务仍可使用。
          </div>
        )}
        {notice && <div className="notice" role="status">{notice}</div>}
        <label>
          <span>显示名称</span>
          <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} required maxLength={100} />
        </label>
        <label>
          <span>提供商类型</span>
          <select value={draft.kind} onChange={(event) => changeKind(event.target.value as ProviderKind)}>
            {Object.entries(providerLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Base URL</span>
          <input type="url" value={draft.baseUrl} onChange={(event) => updateDraft({ baseUrl: event.target.value })} required />
        </label>
        <label>
          <span>模型名称</span>
          <input value={draft.model} onChange={(event) => updateDraft({ model: event.target.value })} placeholder="输入服务端实际模型 ID" required maxLength={200} />
        </label>
        <label>
          <span>API 密钥{draft.id === undefined ? "" : "（留空即保留现有密钥）"}</span>
          <input type="password" value={draft.credential} onChange={(event) => updateDraft({ credential: event.target.value })} autoComplete="new-password" placeholder={draft.kind === "ollama" ? "本机 Ollama 通常无需密钥" : "只写入，不会显示或回传"} />
        </label>
        <button type="submit" className="primary-action" disabled={busy !== undefined}>
          {busy === "save" ? "正在安全保存…" : "安全保存配置"}
        </button>
      </form>
      <PrivacyLedgerPanel refreshKey={ledgerRevision} />
    </div>
  );
}
