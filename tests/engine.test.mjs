import test from "node:test";
import assert from "node:assert/strict";
import { TypingSession, makeQueue, WORDS, parseHistory } from "../engine.js";

function fixture(duration = 30) {
  let now = 0;
  const session = new TypingSession({
    duration,
    now: () => now,
    queue: [
      { label: "ねこ", text: "neko" },
      { label: "いぬ", text: "inu" },
    ],
  });
  return {
    session,
    setTime: (value) => {
      now = value;
    },
  };
}

test("timer waits for first character and finishes at the exact deadline", () => {
  const { session, setTime } = fixture();
  setTime(10_000);
  assert.equal(session.remaining, 30);
  session.update("n");
  setTime(39_999);
  assert.equal(session.remaining, 1);
  assert.equal(session.expired, false);
  setTime(40_000);
  assert.equal(session.expired, true);
  assert.equal(session.update("neko"), false);
  assert.equal(session.advance(), false);
  assert.equal(session.remaining, 0);
});

test("only correct words advance; corrected mistakes still affect accuracy", () => {
  const { session, setTime } = fixture();
  session.update("n");
  session.update("nx");
  assert.equal(session.advance(), false);
  session.update("n");
  session.update("ne");
  session.update("nek");
  session.update("neko");
  assert.equal(session.stats().accuracy, 80);
  assert.deepEqual(session.mistakes, { e: 1 });
  assert.equal(session.advance(), true);
  assert.equal(session.target.text, "inu");
  setTime(30_000);
  assert.deepEqual(session.finish(), {
    wpm: 2,
    accuracy: 80,
    words: 1,
    mode: "japanese",
    duration: 30,
    mistakes: { e: 1 },
  });
});

test("unfinished correct characters count toward WPM, errors do not", () => {
  const { session, setTime } = fixture();
  session.update("nex");
  setTime(30_000);
  assert.equal(session.finish().wpm, 1);
  assert.equal(session.stats().accuracy, 67);
  assert.equal(session.update("neko"), false);
});

test("replacement edits are counted and queue wraps without running out", () => {
  const { session } = fixture();
  session.update("xeko");
  session.update("neko");
  assert.equal(session.stats().accuracy, 88);
  session.advance();
  session.update("inu");
  session.advance();
  assert.equal(session.target.text, "neko");
  assert.equal(session.completedWords, 2);
});

test("all practice words are typeable, shuffled queues preserve all words", () => {
  for (const mode of ["japanese", "english"]) {
    assert.ok(WORDS[mode].length >= 30);
    assert.ok(WORDS[mode].every((word) => /^[a-z]+$/.test(word.text)));
    assert.equal(
      new Set(WORDS[mode].map((word) => word.text)).size,
      WORDS[mode].length,
    );
    assert.deepEqual(
      makeQueue(mode, () => 0.3)
        .map((word) => word.text)
        .sort(),
      WORDS[mode].map((word) => word.text).sort(),
    );
  }
});

test("malformed or untrusted saved history is ignored and retention is limited", () => {
  assert.deepEqual(parseHistory("bad json"), []);
  assert.deepEqual(parseHistory("null"), []);
  assert.deepEqual(parseHistory('{"wpm":12}'), []);
  const record = {
    mode: "japanese",
    duration: 60,
    wpm: 30,
    accuracy: 95,
    words: 12,
    date: "2026-10-23T12:00:00Z",
  };
  assert.deepEqual(
    parseHistory(
      JSON.stringify([
        record,
        { ...record, mode: "<script>" },
        { ...record, accuracy: 101 },
        { ...record, date: "invalid" },
      ]),
    ),
    [record],
  );
  assert.equal(parseHistory(JSON.stringify(Array(60).fill(record))).length, 50);
});
