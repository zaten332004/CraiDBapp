import fs from "node:fs";

const s = fs.readFileSync("lib/i18n/dictionaries.ts", "utf8");

function extractKeys(block) {
  const re = /"([a-z0-9_.]+)"\s*:/g;
  const set = new Set();
  let m;
  while ((m = re.exec(block))) set.add(m[1]);
  return set;
}

const iEn = s.indexOf("en: {");
const viBlock = s.slice(0, iEn);
const enBlock = s.slice(iEn);

const kvi = extractKeys(viBlock);
const ken = extractKeys(enBlock);

const onlyVi = [...kvi].filter((k) => !ken.has(k)).sort();
const onlyEn = [...ken].filter((k) => !kvi.has(k)).sort();

console.log("Keys in vi only:", onlyVi.length);
console.log(onlyVi.join("\n"));
console.log("\nKeys in en only:", onlyEn.length);
console.log(onlyEn.join("\n"));
