type Listener = () => void;

let agentTabStatus: string | null = null;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

export function setAgentTabStatus(status: string | null, autoClearMs?: number): void {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }

  agentTabStatus = status;
  listeners.forEach((listener) => listener());

  if (status && autoClearMs) {
    autoClearTimer = setTimeout(() => {
      agentTabStatus = null;
      autoClearTimer = null;
      listeners.forEach((listener) => listener());
    }, autoClearMs);
  }
}

export function getAgentTabStatus(): string | null {
  return agentTabStatus;
}

export function subscribeAgentTabStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
