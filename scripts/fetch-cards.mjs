// Downloads the printed card images from the Villainous wiki into web/public/cards.
//
//   node scripts/fetch-cards.mjs           download anything missing
//   node scripts/fetch-cards.mjs --check   report what matches, download nothing
//
// The images are committed, so this only needs running after a card is added to the data.
// The game shows its parchment cards for any card without an image.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "server/src/data/characters");
const OUT = join(ROOT, "web/public/cards");
const API = "https://disney-villainous.fandom.com/api.php";
const HEADERS = {"User-Agent": "villain-card-fetch (personal fan project)"};
//the game shows the small set; the zoom view loads a large image only when a card is opened
const SIZES = [{dir: "", width: 480}, {dir: "large", width: 1000}];
const PAUSE_MS = 250;

//where the wiki's card page has the wrong picture: an animation cycling through a card's
//printed versions, or a photo of a card when a clean scan exists
const IMAGE_OVERRIDES = {
  "lady/bibbidi-bobbidi-boo": "Bibbidi-Bobbidi-Boo.png",
  "lady/glass-slipper-cinderellas-room": "Glass Slipper (Cinderella's Room).png",
  "lady/glass-slipper-the-castle": "Glass Slipper (The Castle).png",
  "lotso/spanish-mode-playground": "Spanish Mode Playground.png",
  "lotso/spanish-mode-landfill": "Spanish Mode Landfill.png",
};

//cards the server creates itself rather than dealing from a deck
const EXTRA_CARDS = [
  {villain: "lotso", label: "Buzz Lightyear", deck: "extra"},
  {villain: "lotso", label: "Demo Mode Buzz Lightyear", deck: "extra"},
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//must stay the same as artPath in server/src/game/cards.ts
const slug = (label) => label.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const artKey = (card) => `${card.villain}/${slug(card.art ?? card.label)}`;

const normalise = (text) => text.toLowerCase()
  .replace(/\.(png|jpe?g|webp)$/, "")
  .replace(/['’"]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function readCards() {
  const cards = [];
  const names = {};
  for (const file of readdirSync(DATA).filter(f => f !== "index.ts")) {
    const villain = file.replace(".ts", "");
    const source = readFileSync(join(DATA, file), "utf8");
    names[villain] = source.match(/name: "([^"]+)"/)[1];
    const fateStart = source.indexOf("fateDeck:");
    for (const m of source.matchAll(/\{ label: "([^"]+)".*?description: "((?:[^"\\]|\\.)*)", cost: (null|\d+), strength: (null|\d+), copies: (\d+)(?:, art: "([^"]+)")?/g)) {
      cards.push({
        villain,
        label: m[1],
        deck: m.index > fateStart ? "fate" : "villain",
        text: m[2],
        cost: m[3] === "null" ? null : Number(m[3]),
        strength: m[4] === "null" ? null : Number(m[4]),
        copies: Number(m[5]),
        art: m[6],
      });
    }
  }
  return {cards: [...cards, ...EXTRA_CARDS], names};
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({format: "json", ...params})}`;
  const res = await fetch(url, {headers: HEADERS});
  if (!res.ok) throw new Error(`wiki answered ${res.status}`);
  return res.json();
}

async function listAll(listName, prefix, extra) {
  const items = [];
  let from;
  do {
    const data = await api({action: "query", list: listName, [`${prefix}limit`]: "500", ...extra, ...(from ? {[`${prefix}continue`]: from} : {})});
    items.push(...data.query[listName]);
    from = data.continue?.[`${prefix}continue`];
    await sleep(PAUSE_MS);
  } while (from);
  return items;
}

//every page that could be this card, e.g. "Crown" and "Crown (Mother Gothel)"
function candidatePages(label, pagesByName) {
  const base = normalise(label);
  return [...pagesByName].filter(([name]) => name === base || name.startsWith(`${base} `)).map(([, title]) => title);
}

async function readCardPages(titles) {
  const pages = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const data = await api({
      action: "query",
      titles: titles.slice(i, i + 40).join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
    });
    for (const page of Object.values(data.query.pages)) {
      const text = page.revisions?.[0]?.slots?.main?.["*"];
      if (!text) continue;
      const field = (name) => text.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|]*)`, "i"))?.[1]?.trim() ?? null;
      pages.set(page.title, {
        title: page.title,
        villain: field("villain"),
        image: field("image1") ?? field("image"),
        cost: field("cost"),
        strength: field("strength"),
        copies: field("#_of_copies"),
      });
    }
    await sleep(PAUSE_MS);
  }
  return pages;
}

function fieldDiffers(card, page) {
  const diffs = [];
  const compare = (name, ours, theirs) => {
    //the wiki writes item bonuses as +2 and variable costs as ?
    if (theirs === null || theirs === "" || theirs === "?" || ours === undefined) return;
    if (String(ours ?? "") !== theirs.replace(/^\+/, "")) diffs.push(`${name} ${ours} vs wiki ${theirs}`);
  };
  compare("cost", card.cost, page.cost);
  compare("strength", card.strength, page.strength);
  //a card with printed versions is one wiki page but one entry per version here
  if (!card.art) compare("copies", card.copies, page.copies);
  return diffs;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const {cards, names} = readCards();

  const allPages = await listAll("allpages", "ap", {apnamespace: "0"});
  const pagesByName = new Map(allPages.map(p => [normalise(p.title), p.title]));
  const images = await listAll("allimages", "ai", {aiprop: "url"});
  const imagesByFile = new Map(images.map(i => [i.name, i]));
  const imagesByName = new Map(images.map(i => [normalise(i.name), i]));
  //the exact file first, because two files can differ only by extension
  const findImage = (name) => imagesByFile.get(name.replace(/ /g, "_")) ?? imagesByName.get(normalise(name));

  const titles = [...new Set(cards.flatMap(c => candidatePages(c.label, pagesByName)))];
  const pages = await readCardPages(titles);

  const matched = [];
  const unmatched = [];
  const differences = [];
  for (const card of cards) {
    const villainName = names[card.villain];
    const page = candidatePages(card.label, pagesByName)
      .map(title => pages.get(title))
      .find(p => p?.villain && normalise(p.villain) === normalise(villainName));
    const wanted = IMAGE_OVERRIDES[artKey(card)] ?? page?.image;
    const image = page && wanted && findImage(wanted);
    if (!image) {
      unmatched.push(`${villainName}: ${card.label}${page ? ` (page has no usable image: ${page.image})` : ""}`);
      continue;
    }
    matched.push({card, image});
    const diffs = fieldDiffers(card, page);
    if (diffs.length) differences.push(`${villainName}: ${card.label}: ${diffs.join(", ")}`);
  }

  console.log(`matched ${matched.length} of ${cards.length} cards to a wiki page for the right villain`);
  if (unmatched.length) console.log(`\nno match:\n  ${unmatched.join("\n  ")}`);
  if (differences.length) console.log(`\ndiffers from the wiki:\n  ${differences.join("\n  ")}`);
  if (checkOnly) return;

  let saved = 0;
  for (const {card, image} of matched) {
    for (const {dir, width} of SIZES) {
      const file = join(OUT, dir, `${artKey(card)}.webp`);
      if (existsSync(file)) continue;
      const url = image.url.replace("/revision/latest", `/revision/latest/scale-to-width-down/${width}`);
      const res = await fetch(url, {headers: HEADERS});
      if (!res.ok) {
        console.log(`failed: ${card.label} at ${width} (${res.status})`);
        continue;
      }
      mkdirSync(dirname(file), {recursive: true});
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      saved++;
      await sleep(PAUSE_MS);
    }
  }
  console.log(`\nsaved ${saved} new images to web/public/cards`);
}

main().catch((err) => {
  console.error(`stopped: ${err.message}`);
  process.exit(1);
});
