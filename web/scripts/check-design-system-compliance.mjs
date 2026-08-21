import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const sourceExtensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);
const ignoredDirectories = new Set(["dist", "node_modules", "_backups"]);
const documentOutputFiles = new Set([
  "services/documents/estimateDocumentService.ts",
  "features/tools/glass/GlassWeightCalculatorTool.tsx",
  "features/customerQuotation/CustomerQuotationPreview.tsx",
  "features/customerQuotation/customerQuotation.css",
  "features/customerQuotation/customerQuotationBrand.css",
]);
const themeAuthorityFiles = new Set(["styles/tokens.css", "theme/themes.ts"]);
const themeAuthoringFiles = new Set(["features/admin/AdminThemeColoursPanel.tsx"]);
const sharedThemeSelectorFiles = new Set(["styles/tokens.css", "styles/base.css", "layout/AppShell.css"]);
const technicalFiles = new Set([
  "features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx",
  "features/admin/windowTypes/WindowTypeEditor.tsx",
]);
const technicalPathFragments = [
  "/rendering/",
  "/windowTypes/b92",
  "/b92Configurator/b92FinishOptions.ts",
  "/b92Configurator/B92ConfiguratorFinishPanel.tsx",
  "/configurator/components/WindowRenderer.tsx",
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function lineFor(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function isTechnical(file) {
  const normalized = `/${file}`;
  return technicalFiles.has(file) || technicalPathFragments.some((fragment) => normalized.includes(fragment));
}

const violations = [];
for (const absolute of walk(root)) {
  const file = relative(absolute);
  const source = fs.readFileSync(absolute, "utf8");
  if (!documentOutputFiles.has(file)) {
    const inlinePatterns = [
      /\bstyle\s*=\s*\{/g,
      /React\.CSSProperties/g,
      /\b(?:document\.)?\w+\.style\.[A-Za-z_$][\w$]*/g,
      /setAttribute\(\s*["']style["']/g,
    ];
    for (const pattern of inlinePatterns) {
      for (const match of source.matchAll(pattern)) {
        if (file === "theme/themes.ts" && match[0].includes(".style.setProperty")) continue;
        violations.push(`${file}:${lineFor(source, match.index)} prohibited inline styling: ${match[0]}`);
      }
    }
  }

  if (!themeAuthorityFiles.has(file) && !themeAuthoringFiles.has(file) && !documentOutputFiles.has(file) && !isTechnical(file)) {
    const colourPattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/g;
    for (const match of source.matchAll(colourPattern)) {
      if (match[0].toLowerCase() === "#039" && source.slice(Math.max(0, match.index - 3), match.index + 6).includes("&#039;")) continue;
      violations.push(`${file}:${lineFor(source, match.index)} hard-coded application colour: ${match[0]}`);
    }
  }

  for (const match of source.matchAll(/var\(--color-primary(?:\s*[,)]|\))/g)) {
    violations.push(`${file}:${lineFor(source, match.index)} unresolved legacy token: --color-primary`);
  }

  if (!themeAuthorityFiles.has(file)) {
    for (const match of source.matchAll(/--(?:color|ui|app)-[a-z0-9-]+\s*:|var\(--(?:color|ui|app)-[a-z0-9-]+/gi)) {
      violations.push(`${file}:${lineFor(source, match.index)} prohibited compatibility theme alias: ${match[0]}`);
    }
  }

  if (path.extname(file) === ".css" && !sharedThemeSelectorFiles.has(file)) {
    for (const match of source.matchAll(/(?:\[data-(?:qs-)?theme\s*=|\.(?:dark|light)\b)/g)) {
      violations.push(`${file}:${lineFor(source, match.index)} feature-owned theme selector: ${match[0]}`);
    }
  }
}

if (violations.length) {
  console.error(`Design-system compliance failed (${violations.length} violation${violations.length === 1 ? "" : "s"}).`);
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Design-system compliance passed: zero application inline CSS, zero unauthorised application colours, and no unresolved --color-primary token.");
}
