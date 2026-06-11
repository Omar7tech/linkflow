/**
 * Password generation — all randomness from crypto.getRandomValues (browser only).
 * Nothing here touches the network or storage.
 */

export type PasswordMode = "random" | "passphrase" | "pin";

export interface RandomOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop characters that are easy to misread: 0/O/o, 1/l/I, |. */
  excludeAmbiguous: boolean;
  /** Guarantee at least one character from every enabled set. */
  requireEachSet: boolean;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  /** Append a random two-digit number to one of the words. */
  includeNumber: boolean;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/~";
const AMBIGUOUS = new Set("0Oo1lI|".split(""));

/** Common 3–7 letter English words — concrete nouns that are easy to remember and spell. */
export const WORDLIST = `
acorn actor adobe agent aisle alarm album alert alien alley alpha amber anchor angle ankle apple apron arena arrow aspen atlas atom attic audio autumn axis
bacon badge bagel baker bamboo banjo barn basil basket baton beach beacon beam bean beard beaver bell belt bench berry birch bison blade blaze bloom bolt bonus booth bounce bowl brave bread breeze brick bridge brisk broom brush bubble bucket budget bugle bulb bundle bunny burst butter button
cabin cable cactus camel camera canal candle candy canoe canyon cape carbon cargo carrot castle cedar cello chair chalk charm chart cheese cherry chess chest chime choir chord cider cinema circle citrus cliff climb clock cloud clover coast cobalt cocoa comet coral cork cosmos cotton couch cougar crab crane crater crayon creek crisp crown cruise crystal cube curve cycle
daisy dance dart dawn deck deer delta denim depot desert desk dial diary diesel dime dimple diner dingo dock dome donut dove dozen draft dragon drum dune dusk
eagle earth easel echo edge elbow elder ember empire engine envoy epic essay etch exit
fable falcon fancy fern ferry fiddle field finch flag flame flash fleet flint float flora flute foam forest fort fossil frame fresh frost fruit fudge funnel
gadget galaxy gale garden garlic gate gecko giant ginger glade glide globe glow goat gold goose grain grape gravel green grill grove guitar gull gust
habit hammer harbor harp hatch haven hawk hazel heart hedge helmet herb heron hill hinge hippo hive holly honey hoof horn horse hotel house hover humble
icon igloo image index inlet iris iron island ivory
jacket jade jaguar jazz jelly jewel jigsaw jolly judge juice jumbo jungle
kayak kazoo kelp kettle khaki kiln king kiosk kite kiwi knack knight koala
ladder lagoon lake lamp lance lapel larch laser latch lava lawn leaf ledge lemon lens level lever lilac lily linen lion lizard llama lobby lodge loft logic lotus lunar lyric
macaw magma magnet mango mantle maple marble marina marsh mascot meadow medal melon mentor mesa metal meteor metro mint mirror mocha modem moss motel motif motor mound mouse mural music myth
nacho napkin nectar neon nest nickel noble nomad noodle north notch nougat nova nugget nutmeg
oasis ocean olive omega onion onyx opal opera orbit orchid organ otter outlet oval oven owl oxide oyster ozone
paddle pagoda palace palm panda pantry parade parka parrot pasta patio peach pearl pebble pecan pedal pencil penny pepper perch petal piano pickle picnic pigeon pillow pilot pine pivot pixel pizza planet plank plaza plum pocket poem polar pond pony poppy porch prism pulley puzzle
quail quartz quest quill quilt quiver
rabbit radar radio raft rail ranch raven reef relay relic resin rhino ribbon ridge river roast robin rocket rodeo rope rover royal ruby rudder rumble runway
saddle safari sage salad salmon salsa sand satin sauna scarf scenic scoop scout scroll sedan sensor shade shadow shark shelf shell shore shrub sierra signal silk silver sketch slate slope snack socket sofa solar sonar sonnet sorbet south spark sphere spice spiral spoon spring sprout spruce squid stable stamp star statue steam steel stereo stone storm stove straw stream stride studio stump summit surf swan swift swirl syrup
table taco talon tango tarp tassel teal tempo tent terra thyme tiara tide tiger tile timber toast toffee token tomato tonic topaz torch totem trail train tree trek trio trout truck tuba tulip tundra tunnel turbo turtle tutor tweed twig twin
umpire union unity urban
vault vector velvet vendor verse vessel video vigor villa vine vinyl violet violin vista vivid vocal vortex voyage
waffle wagon walnut walrus wand wave weave wedge whale wheat wheel whisk widget willow window winter wisdom wolf wonder wool wren wrist
yacht yarn yeast yield yogurt yolk
zebra zenith zephyr zigzag zinc zipper zodiac
`
  .trim()
  .split(/\s+/);

/** Unbiased integer in [0, maxExclusive) via rejection sampling. */
function randomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)];
}

function stripAmbiguous(set: string): string {
  return set
    .split("")
    .filter((c) => !AMBIGUOUS.has(c))
    .join("");
}

/** The character sets enabled by the options, after ambiguity filtering. */
export function activeSets(opts: RandomOptions): string[] {
  const sets: string[] = [];
  if (opts.upper) sets.push(opts.excludeAmbiguous ? stripAmbiguous(UPPER) : UPPER);
  if (opts.lower) sets.push(opts.excludeAmbiguous ? stripAmbiguous(LOWER) : LOWER);
  if (opts.digits) sets.push(opts.excludeAmbiguous ? stripAmbiguous(DIGITS) : DIGITS);
  if (opts.symbols) sets.push(opts.excludeAmbiguous ? stripAmbiguous(SYMBOLS) : SYMBOLS);
  return sets;
}

export function generateRandom(opts: RandomOptions): string {
  const sets = activeSets(opts);
  if (sets.length === 0) return "";
  const pool = sets.join("");
  const mustCoverSets = opts.requireEachSet && opts.length >= sets.length;

  // Rejection keeps the distribution uniform over all passwords that satisfy
  // the constraint — no biased "one from each set" placement.
  for (let attempt = 0; attempt < 200; attempt++) {
    const chars = Array.from({ length: opts.length }, () => pick(pool));
    const result = chars.join("");
    if (!mustCoverSets || sets.every((s) => chars.some((c) => s.includes(c)))) {
      return result;
    }
  }
  return Array.from({ length: opts.length }, () => pick(pool)).join("");
}

export function generatePassphrase(opts: PassphraseOptions): string {
  const words = Array.from({ length: opts.words }, () => WORDLIST[randomInt(WORDLIST.length)]);
  const cased = opts.capitalize ? words.map((w) => w[0].toUpperCase() + w.slice(1)) : words;
  if (opts.includeNumber) {
    const i = randomInt(cased.length);
    cased[i] = `${cased[i]}${randomInt(100).toString().padStart(2, "0")}`;
  }
  return cased.join(opts.separator);
}

export function generatePin(length: number): string {
  return Array.from({ length }, () => pick(DIGITS)).join("");
}

export function randomEntropy(opts: RandomOptions): number {
  const pool = activeSets(opts).join("");
  return pool.length === 0 ? 0 : opts.length * Math.log2(pool.length);
}

export function passphraseEntropy(opts: PassphraseOptions): number {
  let bits = opts.words * Math.log2(WORDLIST.length);
  if (opts.includeNumber) bits += Math.log2(100 * opts.words);
  return bits;
}

export function pinEntropy(length: number): number {
  return length * Math.log2(10);
}

export interface Strength {
  /** 0–4 */
  score: number;
  label: string;
  bits: number;
  /** Human-readable time to crack at 10 billion guesses/sec (offline attack). */
  crackTime: string;
}

const OFFLINE_GUESSES_PER_SECOND = 1e10;

export function assessStrength(bits: number): Strength {
  const score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const label = ["Very weak", "Weak", "Fair", "Strong", "Excellent"][score];
  // Average case: half the keyspace.
  const seconds = Math.pow(2, bits - 1) / OFFLINE_GUESSES_PER_SECOND;
  return { score, label, bits: Math.round(bits), crackTime: formatDuration(seconds) };
}

function plural(value: number, unit: string): string {
  const n = Math.round(value);
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return "instantly";
  const minute = 60;
  const hour = 3600;
  const day = 86400;
  const year = 31_557_600;
  if (seconds < minute) return plural(seconds, "second");
  if (seconds < hour) return plural(seconds / minute, "minute");
  if (seconds < day) return plural(seconds / hour, "hour");
  if (seconds < year) return plural(seconds / day, "day");
  const years = seconds / year;
  if (years < 1e3) return plural(years, "year");
  if (years < 1e6) return `${Math.round(years / 1e3)} thousand years`;
  if (years < 1e9) return `${Math.round(years / 1e6)} million years`;
  if (years < 1e12) return `${Math.round(years / 1e9)} billion years`;
  return "trillions of years";
}
