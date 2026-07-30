import { parsePromptTemplateRegistry, type PromptTemplate, type PromptTemplateRegistry, type PromptTemplateScope } from "../shared/product-api.js";
import { emptyPromptTemplateRegistry, selectedPromptTemplate, selectPromptTemplate } from "@bubu/product-core";

const storageKey = "bubu:prompt-template-registry:v1";
const changeEvent = "bubu:prompt-template-registry-changed";

export function readPromptTemplateRegistry(): PromptTemplateRegistry {
  const encoded = window.localStorage.getItem(storageKey);
  if (!encoded) return emptyPromptTemplateRegistry;
  try {
    return parsePromptTemplateRegistry(JSON.parse(encoded) as unknown);
  } catch {
    return emptyPromptTemplateRegistry;
  }
}

export function writePromptTemplateRegistry(registry: PromptTemplateRegistry): void {
  const parsed = parsePromptTemplateRegistry(registry);
  window.localStorage.setItem(storageKey, JSON.stringify(parsed));
  window.dispatchEvent(new CustomEvent(changeEvent));
}

export function currentPromptTemplate(scope: PromptTemplateScope): PromptTemplate {
  return selectedPromptTemplate(scope, readPromptTemplateRegistry());
}

export function choosePromptTemplate(scope: PromptTemplateScope, id: string): void {
  writePromptTemplateRegistry(selectPromptTemplate(readPromptTemplateRegistry(), scope, id));
}

export function onPromptTemplateRegistryChange(listener: () => void): () => void {
  window.addEventListener(changeEvent, listener);
  return () => window.removeEventListener(changeEvent, listener);
}

export function newCustomPromptTemplateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
