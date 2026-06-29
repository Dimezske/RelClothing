// Custom ESM resolve hook: resolves tsconfig path aliases (@/, @shared/)
// and extensionless relative imports to .ts/.tsx files, without esbuild
// or any native dependency. Used as a companion to ts-node/esm so the
// whole dev pipeline stays pure-JS (works under proot).
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = process.cwd();

const ALIASES = [
  { prefix: "@shared/", target: path.join(ROOT, "shared") },
  { prefix: "@/", target: path.join(ROOT, "client", "src") },
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

function resolveWithExtensions(basePath) {
  if (existsSync(basePath)) return basePath;
  for (const ext of EXTENSIONS) {
    const candidate = basePath + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  for (const { prefix, target } of ALIASES) {
    if (specifier.startsWith(prefix)) {
      const rest = specifier.slice(prefix.length);
      const basePath = path.join(target, rest);
      const resolved = resolveWithExtensions(basePath);
      if (resolved) {
        return {
          url: pathToFileURL(resolved).href,
          shortCircuit: true,
        };
      }
    }
  }

  // Extensionless relative imports (./foo, ../bar) -> try .ts/.tsx
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = fileURLToPath(context.parentURL);
    const basePath = path.join(path.dirname(parentPath), specifier);
    const resolved = resolveWithExtensions(basePath);
    if (resolved) {
      return {
        url: pathToFileURL(resolved).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
