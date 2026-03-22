import type { Command } from "./command";

export function sendToFigma(type: Command, payload?: Record<string, unknown>) {
  parent.postMessage({ pluginMessage: { type, ...payload } }, "*");
}