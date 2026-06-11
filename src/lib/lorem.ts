/** Lorem ipsum generation — classic Latin vocabulary, realistic sentence rhythm. */

export type LoremUnit = "paragraphs" | "sentences" | "words";
export type LoremFormat = "plain" | "html" | "markdown";

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  /** Begin with the canonical "Lorem ipsum dolor sit amet…" opening. */
  startWithClassic: boolean;
}

export const CLASSIC_OPENING =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const WORDS = `
a ac accumsan ad adipiscing aenean aliquam aliquet amet ante aptent arcu at auctor augue
bibendum blandit class commodo condimentum congue consectetur consequat conubia convallis cras
cubilia curabitur curae cursus dapibus diam dictum dictumst dignissim dis dolor donec dui duis
efficitur egestas eget eleifend elementum elit enim erat eros est et etiam eu euismod ex
facilisi facilisis fames faucibus felis fermentum feugiat finibus fringilla fusce gravida
habitant habitasse hac hendrerit himenaeos iaculis id imperdiet in inceptos integer interdum
ipsum justo lacinia lacus laoreet lectus leo libero ligula litora lobortis lorem luctus
maecenas magna magnis malesuada massa mattis mauris maximus metus mi molestie mollis montes
morbi mus nam nascetur natoque nec neque netus nibh nisi nisl non nostra nulla nullam nunc
odio orci ornare parturient pellentesque penatibus per pharetra phasellus placerat platea
porta porttitor posuere potenti praesent pretium primis proin pulvinar purus quam quis
quisque ridiculus risus rhoncus rutrum sagittis sapien scelerisque sed sem semper senectus
sit sociosqu sodales sollicitudin suscipit suspendisse taciti tellus tempor tempus tincidunt
torquent tortor tristique turpis ullamcorper ultrices ultricies urna ut varius vehicula vel
velit venenatis vestibulum vitae vivamus viverra volutpat vulputate
`
  .trim()
  .split(/\s+/);

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function makeSentence(): string {
  const length = randInt(6, 14);
  const words = Array.from({ length }, pickWord);
  // Longer sentences usually breathe with a comma somewhere in the middle.
  if (length > 8 && Math.random() < 0.6) {
    words[randInt(3, length - 3)] += ",";
  }
  const sentence = words.join(" ");
  return sentence[0].toUpperCase() + sentence.slice(1) + ".";
}

function makeParagraph(sentences: number): string[] {
  return Array.from({ length: sentences }, makeSentence);
}

/**
 * Returns blocks of text: one entry per paragraph, or a single block
 * for the sentence/word units.
 */
export function generateLorem(opts: LoremOptions): string[] {
  if (opts.unit === "words") {
    const opening = opts.startWithClassic ? ["lorem", "ipsum", "dolor", "sit", "amet"] : [];
    const rest = Array.from({ length: Math.max(0, opts.count - opening.length) }, pickWord);
    const words = [...opening, ...rest].slice(0, opts.count);
    const text = words.join(" ");
    return [text[0].toUpperCase() + text.slice(1) + "."];
  }

  if (opts.unit === "sentences") {
    const sentences = makeParagraph(opts.count);
    if (opts.startWithClassic && sentences.length > 0) sentences[0] = CLASSIC_OPENING;
    return [sentences.join(" ")];
  }

  return Array.from({ length: opts.count }, (_, i) => {
    const sentences = makeParagraph(randInt(3, 6));
    if (opts.startWithClassic && i === 0) sentences[0] = CLASSIC_OPENING;
    return sentences.join(" ");
  });
}

/** Wrap a short random phrase of a block in emphasis/link markup. */
function decorateBlock(block: string, format: LoremFormat): string {
  const words = block.split(" ");
  if (words.length < 8) return block;
  const start = randInt(1, words.length - 5);
  const length = randInt(2, 3);
  const phrase = words
    .slice(start, start + length)
    .join(" ")
    .replace(/[.,]/g, "");
  const styles =
    format === "html"
      ? [`<strong>${phrase}</strong>`, `<em>${phrase}</em>`, `<a href="#">${phrase}</a>`]
      : [`**${phrase}**`, `*${phrase}*`, `[${phrase}](#)`];
  const wrapped = styles[randInt(0, styles.length - 1)];
  return [...words.slice(0, start), wrapped, ...words.slice(start + length)].join(" ");
}

export function formatLorem(
  blocks: string[],
  format: LoremFormat,
  decorate: boolean
): string {
  const decorated =
    decorate && format !== "plain" ? blocks.map((b) => decorateBlock(b, format)) : blocks;
  if (format === "html") return decorated.map((b) => `<p>${b}</p>`).join("\n");
  return decorated.join("\n\n");
}

export function loremStats(blocks: string[]): { words: number; characters: number } {
  const text = blocks.join("\n\n");
  return { words: text.split(/\s+/).filter(Boolean).length, characters: text.length };
}
