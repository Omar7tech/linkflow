/** Reading-time and text statistics — pure functions, deterministic. */

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
}

export function analyzeText(text: string): TextStats {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0 };
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return {
    words: words.length,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
  };
}

/**
 * Seconds spent on images, using Medium's formula: 12s for the first image,
 * one second less for each that follows, with a 3s floor.
 */
export function imageSeconds(imageCount: number): number {
  let total = 0;
  for (let i = 0; i < imageCount; i++) total += Math.max(12 - i, 3);
  return total;
}

export function readingSeconds(words: number, wpm: number, imageCount = 0): number {
  return (words / wpm) * 60 + imageSeconds(imageCount);
}

export function speakingSeconds(words: number, wpm: number): number {
  return (words / wpm) * 60;
}

/** "45 sec", "1 min", "4 min 30 sec", "1 hr 12 min" */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 sec";
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest > 0 ? `${minutes} min ${rest} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin > 0 ? `${hours} hr ${restMin} min` : `${hours} hr`;
}

/** The badge bloggers want: "4 min read" (always rounded up, minimum 1). */
export function readLabel(totalSeconds: number): string {
  return `${Math.max(1, Math.ceil(totalSeconds / 60))} min read`;
}

/* ------------------------------ Readability ------------------------------- */

/** Heuristic English syllable count — good enough for Flesch scoring. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]e|ed)$/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export interface Readability {
  /** Flesch reading ease, clamped to 0–100. */
  ease: number;
  easeLabel: string;
  /** Flesch–Kincaid grade level, clamped to ≥ 0. */
  grade: number;
}

export function readability(text: string): Readability | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, trimmed.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim()).length);
  if (words.length < 10) return null;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = words.length / sentences;
  const syllablesPerWord = syllables / words.length;

  const rawEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const ease = Math.min(100, Math.max(0, Math.round(rawEase)));
  const grade = Math.max(0, Math.round((0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10) / 10);

  const easeLabel =
    ease >= 90 ? "Very easy" :
    ease >= 70 ? "Easy" :
    ease >= 60 ? "Plain English" :
    ease >= 50 ? "Fairly difficult" :
    ease >= 30 ? "Difficult" : "Very difficult";

  return { ease, easeLabel, grade };
}
