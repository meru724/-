export const WORDS = {
  japanese: [
    ["木漏れ日", "komorebi"],
    ["ひだまり", "hidamari"],
    ["そよかぜ", "soyokaze"],
    ["あおぞら", "aozora"],
    ["こみち", "komichi"],
    ["たんぽぽ", "tanpopo"],
    ["ほしぞら", "hoshizora"],
    ["やまびこ", "yamabiko"],
    ["さくら", "sakura"],
    ["あさごはん", "asagohan"],
    ["しんこきゅう", "shinkokyuu"],
    ["はなびら", "hanabira"],
    ["みずたまり", "mizutamari"],
    ["にじいろ", "nijiiro"],
    ["つきあかり", "tsukiakari"],
    ["おもいやり", "omoiyari"],
    ["なつやすみ", "natsuyasumi"],
    ["ひこうき", "hikouki"],
    ["かえりみち", "kaerimichi"],
    ["あまやどり", "amayadori"],
    ["わすれもの", "wasuremono"],
    ["ゆきだるま", "yukidaruma"],
    ["ありがとう", "arigatou"],
    ["ほほえみ", "hohoemi"],
    ["みらい", "mirai"],
    ["ともだち", "tomodachi"],
    ["おさんぽ", "osanpo"],
    ["まなび", "manabi"],
    ["ゆうやけ", "yuuyake"],
    ["せせらぎ", "seseragi"],
    ["あたらしい", "atarashii"],
    ["こころ", "kokoro"],
    ["はるかぜ", "harukaze"],
    ["ふうせん", "fuusen"],
    ["あじさい", "ajisai"],
    ["しあわせ", "shiawase"],
  ].map(([label, text]) => ({ label, text })),
  english: [
    "bloom",
    "gentle",
    "garden",
    "sunshine",
    "breathe",
    "little",
    "wonder",
    "morning",
    "journey",
    "create",
    "nature",
    "balance",
    "practice",
    "bright",
    "kindness",
    "discover",
    "quiet",
    "meadow",
    "feather",
    "growth",
    "dream",
    "simple",
    "forest",
    "curious",
    "rhythm",
    "enjoy",
    "progress",
    "flower",
    "peaceful",
    "horizon",
    "welcome",
    "learn",
    "ocean",
    "spring",
    "together",
    "smile",
  ].map((text) => ({ label: text, text })),
};

export function makeQueue(mode, random = Math.random) {
  const list = [...WORDS[mode]];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class TypingSession {
  constructor({
    duration = 60,
    mode = "japanese",
    now = () => performance.now(),
    queue,
  } = {}) {
    this.duration = duration;
    this.mode = mode;
    this.now = now;
    this.queue = queue || makeQueue(mode);
    this.index = 0;
    this.value = "";
    this.startedAt = null;
    this.finished = false;
    this.attempts = 0;
    this.correctAttempts = 0;
    this.completedCharacters = 0;
    this.completedWords = 0;
    this.mistakes = {};
  }
  get target() {
    return this.queue[this.index % this.queue.length];
  }
  get elapsed() {
    return this.startedAt === null
      ? 0
      : Math.min(
          this.duration,
          Math.max(0, (this.now() - this.startedAt) / 1000),
        );
  }
  get remaining() {
    return Math.max(0, Math.ceil(this.duration - this.elapsed));
  }
  get expired() {
    return this.startedAt !== null && this.elapsed >= this.duration;
  }
  update(value) {
    if (this.finished || this.expired) return false;
    if (value && this.startedAt === null) this.startedAt = this.now();
    let prefix = 0;
    while (
      prefix < value.length &&
      prefix < this.value.length &&
      value[prefix] === this.value[prefix]
    )
      prefix++;
    for (let i = prefix; i < value.length; i++) {
      this.attempts++;
      if (value[i] === this.target.text[i]) this.correctAttempts++;
      else {
        const expected = this.target.text[i] || "extra";
        this.mistakes[expected] = (this.mistakes[expected] || 0) + 1;
      }
    }
    this.value = value;
    return true;
  }
  advance() {
    if (this.finished || this.expired || this.value !== this.target.text)
      return false;
    this.completedCharacters += this.target.text.length + 1;
    this.completedWords++;
    this.index++;
    this.value = "";
    return true;
  }
  stats() {
    const currentCorrect = [...this.value].reduce(
      (sum, char, i) => sum + Number(char === this.target.text[i]),
      0,
    );
    return {
      wpm:
        this.elapsed > 0
          ? Math.round(
              (this.completedCharacters + currentCorrect) /
                5 /
                (this.elapsed / 60),
            )
          : 0,
      accuracy: this.attempts
        ? Math.round((this.correctAttempts / this.attempts) * 100)
        : 100,
      words: this.completedWords,
    };
  }
  finish() {
    this.finished = true;
    return {
      ...this.stats(),
      mode: this.mode,
      duration: this.duration,
      mistakes: { ...this.mistakes },
    };
  }
}

export function parseHistory(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (item) =>
          item &&
          ["japanese", "english"].includes(item.mode) &&
          [30, 60, 120].includes(item.duration) &&
          Number.isFinite(item.wpm) &&
          item.wpm >= 0 &&
          Number.isFinite(item.accuracy) &&
          item.accuracy >= 0 &&
          item.accuracy <= 100 &&
          Number.isFinite(item.words) &&
          item.words >= 0 &&
          typeof item.date === "string" &&
          !Number.isNaN(Date.parse(item.date)),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
