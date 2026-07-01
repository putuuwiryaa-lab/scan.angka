import { readFileSync, writeFileSync } from "node:fs";

const enginePath = "lib/engine/acke-engine.ts";
let source = readFileSync(enginePath, "utf8");

source = source.replace(
  "return alive.length <= digitCount ? alive : [];",
  "return alive.length === digitCount ? alive : [];"
);

const strictCompressionProfile = `function compressionProfile(result: EngineResult, digitCount: number, scanMode: ScanMode): { displayColumns: Kolom[]; coreColumns: Kolom[]; supportColumns: Kolom[]; supportReasons: string[]; coreSize: number; hitScore: number; recentScore: number } | null {
  const core = coreColumns(result, digitCount, scanMode);
  if (core.length !== digitCount) return null;
  return { displayColumns: core, coreColumns: core, supportColumns: [], supportReasons: [], coreSize: core.length, hitScore: columnsHitScore(result, core), recentScore: recentScore(result, core, scanMode) };
}

`;

source = source.replace(
  /function compressionProfile[\s\S]*?\nfunction digitsFromColumns/,
  `${strictCompressionProfile}function digitsFromColumns`
);

writeFileSync(enginePath, source);
