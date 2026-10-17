import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// テンプレート名からハンドラを引く。templateName の完全一致を優先し、
// 見つからなければ matchTemplate(name) を持つハンドラ (「基礎情報 *」など) を順に試す。
class TemplateRegistry {
  constructor(handlers) {
    this.exactHandlers = new Map();
    this.patternHandlers = [];

    for (const handler of handlers) {
      if (typeof handler.templateName === "string") {
        this.exactHandlers.set(handler.templateName, handler.build);
      }
      if (typeof handler.matchTemplate === "function") {
        this.patternHandlers.push(handler);
      }
    }
  }

  get size() {
    return this.exactHandlers.size + this.patternHandlers.length;
  }

  get(templateName) {
    return (
      this.exactHandlers.get(templateName) ??
      this.patternHandlers.find((handler) => handler.matchTemplate(templateName))?.build
    );
  }
}

export function createTemplateRegistry(handlers) {
  return new TemplateRegistry(handlers);
}

export async function loadTemplateHandlers(templatesDir) {
  const entries = await readdir(templatesDir, { withFileTypes: true });
  const handlers = [];

  for (const entry of entries) {
    if (!entry.isFile() || !/\.js$/i.test(entry.name)) {
      continue;
    }

    const modulePath = pathToFileURL(join(templatesDir, entry.name)).href;
    const mod = await import(modulePath);

    const hasName = typeof mod.templateName === "string" || typeof mod.matchTemplate === "function";
    if (hasName && typeof mod.build === "function") {
      handlers.push({ templateName: mod.templateName, matchTemplate: mod.matchTemplate, build: mod.build });
    }
  }

  return createTemplateRegistry(handlers);
}

export function applyTemplateHandlers(templates, registry) {
  if (!registry || registry.size === 0) {
    return [];
  }

  return templates
    .map((template) => {
      const handler = registry.get(template.name);
      if (!handler) {
        return null;
      }

      return handler(template);
    })
    .filter(Boolean);
}
