import { describe, it, expect } from "vitest";
import { segment } from "../src/core/markdown";
import { countCharacters, countSelection, countWords } from "../src/core/wordcount";
import { measureText } from "../src/core/measure";
import { bodyStartLine, isSceneBreakLine, parseBeats, parsePlaceholders } from "../src/core/markers";
import { blockStateAt, bodyLineIn } from "../src/editor/context";
import { dialogueInDoc } from "../src/editor/dialogue";
import { decideEnter, trailingBreakKeep } from "../src/editor/enter-flow";
import { scanBeats } from "../src/outline/model";
import { insertBeat } from "../src/outline/beats-edit";
import { placeholderSpans, scan } from "../src/placeholders/logic";
import { runChecks, unclosedComment } from "../src/publish/checks";

// Characterization table: what every consumer of core/markdown says about the
// same documents. Values were recorded from the code before the segmenter; a row
// that a deliberate behavior change touches lists its D-numbers in `changes` and
// keeps the old value in a comment (docs/ARCHITECTURE.md, "Markdown segmentation").
//
// D1  markers in code, frontmatter or closed HTML comments are not placeholders
// D2  a beat in a fenced block, frontmatter or an open multi-line comment is not a beat
//     (inside inline code it never was one: BEAT_LINE needs the whole line)
// D3  a marker is one closed %% comment span: a placeholder can't straddle comment
//     boundaries, and a line of several %% comments ("%% beat: a %% %% beat: b %%") is no beat
// D4  counts use the CommonMark-like fence rule the editor and publish used, minus
//     the tab those two accepted in the indent (only spaces now, like CommonMark)
// D5  a frontmatter opener with trailing blanks (or a CRLF one in the editor) is frontmatter
// D6  an escaped backtick doesn't open inline code
// D7  one left-to-right precedence: fences inside an open %% comment are literal
// D8  %% inside inline code no longer flips the editor into "comment"
// D9  $$ is counted in prose only; %% inside $$ opens a comment
// D10 a closed multi-line <!-- --> is a comment block; html-only text isn't "written"
// D11 an unclosed <!-- is literal prose, so publish can't miss a placeholder after it;
//     counts over-count after a stray line-start <!-- (Reading view hides the rest)
// D12 the selection count uses the file count's rules on the whole document
// D13 Enter flow never removes a --- inside code or a comment
// D14 %% inside a closed <!-- --> is literal (first opener wins): counts and the editor
//     read past it; publish still blocks an odd %% count inside one (parity unverified)
//
// Columns: blocks = blockStateAt per line (F frontmatter, C code, % comment, M math);
// enter = decideEnter on the last line after appending two blank lines ("blank" style).

interface Row {
  name: string;
  text: string;
  changes?: string[];
  expect: Record<string, unknown>;
}

const ROWS: Row[] = [
  {
    name: "empty",
    text: "",
    expect: {
      words: 0,
      chars: 0,
      selection: 0,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "plain",
    text: "Ela abriu a porta.\n\nE saiu.",
    expect: {
      words: 6,
      chars: 26,
      selection: 6,
      bodyStartLine: 0,
      blocks: ". . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "unclosedFM",
    text: "---\na: 1\nprosa aqui",
    expect: {
      words: 4,
      chars: 15,
      selection: 4,
      bodyStartLine: 0,
      blocks: ". F F",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "unclosedFMph",
    text: "---\n%% XXX: u %%\nprosa",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". F F",
      beats: "",
      scanBeats: "",
      placeholders: "1:4-16:u",
      spans: "4-16/12-13",
      unclosed: null,
      checks: "placeholders@1",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "fmDots",
    text: "---\na: 1\n...\nprosa",
    changes: ["D12"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1, // D12, was 3
      bodyStartLine: 3,
      blocks: ". F F .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fmEmpty",
    text: "---\n---\nprosa",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 2,
      blocks: ". F .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fmTrailing",
    text: "--- \na: um dois\n---\nprosa final",
    changes: ["D5"],
    expect: {
      words: 2, // D5, was 5
      chars: 11, // D5, was 22
      selection: 2, // D5, was 5
      bodyStartLine: 3,
      blocks: ". F F .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fmCRLF",
    text: "---\r\na: 1\r\n---\r\nprosa\r\n%% XXX: x %%\r\n",
    changes: ["D5", "D12"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1, // D12, was 3
      bodyStartLine: 3,
      blocks: ". F F . . .", // D5, was ". . . . . ."
      beats: "",
      scanBeats: "",
      placeholders: "4:23-35:x",
      spans: "23-35/31-32",
      unclosed: null,
      checks: "placeholders@4",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "fmNotLine0",
    text: "\n---\na\n---\nb",
    expect: {
      words: 2,
      chars: 3,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . . . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fmClosedLastLine",
    text: "---\na: 1\n---",
    changes: ["D12"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0, // D12, was 2
      bodyStartLine: 3,
      blocks: ". F F",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "fenceIndented",
    text: "a\n  ```\n%% XXX: in %%\n  ```\nb",
    changes: ["D1", "D4"],
    expect: {
      words: 2,
      chars: 3, // D4, was 11
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . C C .",
      beats: "",
      scanBeats: "",
      placeholders: "", // D1, was "2:8-21:in"
      spans: "", // D1, was "8-21/16-18"
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceLonger",
    text: "a\n````\ncode\n```\nstill\n````\nb",
    changes: ["D4"],
    expect: {
      words: 2,
      chars: 3, // D4, was 7
      selection: 2, // D4, was 4
      bodyStartLine: 0,
      blocks: ". . C C C C .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceCloserLonger",
    text: "```\ncode\n`````\nafter",
    changes: ["D4"],
    expect: {
      words: 1, // D4, was 0
      chars: 5, // D4, was 0
      selection: 1, // D4, was 2
      bodyStartLine: 0,
      blocks: ". C C .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "", // D4, was "emptyBody"
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceTilde",
    text: "~~~\nx %% y\n~~~\nz",
    expect: {
      words: 1,
      chars: 1,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". C C .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceInfoBacktick",
    text: "```a`b\nnot code\n```\nx",
    changes: ["D4"],
    expect: {
      words: 4, // D4, was 1
      chars: 15, // D4, was 1
      selection: 4, // D4, was 5
      bodyStartLine: 0,
      blocks: ". . . C", // D4, was ". C C ."
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal", // D4, was "break"
      trailingKeep: null,
    },
  },
  {
    name: "fenceCloserInfo",
    text: "```\ncode\n``` js\nstill code",
    changes: ["D12"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0, // D12, was 4
      bodyStartLine: 0,
      blocks: ". C C C",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "fenceIndent4",
    text: "a\n    ```\n%% XXX: n %%\n    ```\nb",
    expect: {
      words: 2,
      chars: 11,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . . . .",
      beats: "",
      scanBeats: "",
      placeholders: "2:10-22:n",
      spans: "10-22/18-19",
      unclosed: null,
      checks: "placeholders@2",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceUnclosed",
    text: "a\n```\ncode %% x\nmore",
    changes: ["D12"],
    expect: {
      words: 1,
      chars: 1,
      selection: 1, // D12, was 2
      bodyStartLine: 0,
      blocks: ". . C C",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "commentMultiline",
    text: "a %% one\ntwo %% b\n\nc",
    expect: {
      words: 3,
      chars: 5,
      selection: 3,
      bodyStartLine: 0,
      blocks: ". % . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "commentUnclosed",
    text: "um\ndois %% três\nquatro",
    expect: {
      words: 2,
      chars: 7,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . %",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: 1,
      checks: "unclosedComment@1",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "commentInInline",
    text: "use `%%` here\nand more",
    changes: ["D8", "D12"],
    expect: {
      words: 4,
      chars: 17,
      selection: 4, // D12, was 1
      bodyStartLine: 0,
      blocks: ". .", // D8, was ". %"
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break", // D8, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "commentOnly",
    text: "%% só nota %%",
    expect: {
      words: 0,
      chars: 0,
      selection: 0,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "phBasic",
    text: "A %% XXX: um %% e %% XXX %%.\n",
    expect: {
      words: 2,
      chars: 5,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". .",
      beats: "",
      scanBeats: "",
      placeholders: "0:2-15:um | 0:18-27:",
      spans: "2-15/10-12 | 18-27/24-24",
      unclosed: null,
      checks: "placeholders@0",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "phInFence",
    text: "```\n%% XXX: a %%\n```\nprosa",
    changes: ["D1"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". C C .",
      beats: "",
      scanBeats: "",
      placeholders: "", // D1, was "1:4-16:a"
      spans: "", // D1, was "4-16/12-13"
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "phInInline",
    text: "texto `%% XXX: a %%` fim",
    changes: ["D1"],
    expect: {
      words: 2,
      chars: 9,
      selection: 2,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "", // D1, was "0:7-19:a"
      spans: "", // D1, was "7-19/15-16"
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "phInFM",
    text: "---\nx: \"%% XXX: fm %%\"\n---\nprosa",
    changes: ["D1", "D12"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1, // D12, was 2
      bodyStartLine: 3,
      blocks: ". F F .",
      beats: "",
      scanBeats: "",
      placeholders: "", // D1, was "1:8-21:fm"
      spans: "", // D1, was "8-21/16-18"
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "phInHtml",
    text: "a <!-- %% XXX: h %% --> b",
    changes: ["D1"],
    expect: {
      words: 2,
      chars: 3,
      selection: 2,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "", // D1, was "0:7-19:h"
      spans: "", // D1, was "7-19/15-16"
      unclosed: null,
      checks: "", // D1, was "placeholders@0"
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "phStraddle",
    text: "%% note %% XXX: y %%\nprosa",
    changes: ["D3"],
    expect: {
      words: 2,
      chars: 6,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". %",
      beats: "",
      scanBeats: "",
      placeholders: "", // D3, was "0:8-20:y"
      spans: "", // D3, was "8-20/16-17"
      unclosed: 0,
      checks: "unclosedComment@0", // D3, was "unclosedComment@0 placeholders@0"
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatWritten",
    text: "%% beat: a %%\ntexto\n\n---\n\n%% beat: b %%\n",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . . . . .",
      beats: "0:a:w | 5:b:u",
      scanBeats: "0:a:a | 5:b:b",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "unwrittenBeats@5",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatInFence",
    text: "%% beat: a %%\n```\n%% beat: b %%\n```\n",
    changes: ["D2"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0,
      bodyStartLine: 0,
      blocks: ". . C C .",
      beats: "0:a:w", // D2, was "0:a:w | 2:b:w"
      scanBeats: "0:a:a", // D2, was "0:a:a | 2:b:b"
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatInComment",
    text: "%%\n%% beat: x %%\n%%\ntext",
    changes: ["D2"],
    expect: {
      words: 3,
      chars: 12,
      selection: 3,
      bodyStartLine: 0,
      blocks: ". % % .",
      beats: "", // D2, was "1:x:u"
      scanBeats: "", // D2, was "1:a:x"
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "", // D2, was "unwrittenBeats@1"
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "beatThenFence",
    text: "%% beat: a %%\n```\n---\n%% beat: q %%\n```\n\n%% beat: b %%\n",
    changes: ["D2"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0,
      bodyStartLine: 0,
      blocks: ". . C C C . . .",
      beats: "0:a:w | 6:b:u", // D2, was "0:a:w | 3:q:w | 6:b:u"
      scanBeats: "0:a:a | 6:b:b", // D2, was "0:a:a | 3:b:q | 6:c:b"
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "unwrittenBeats@6 emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatInFM",
    text: "---\nb: \"%% beat: fm %%\"\n---\n%% beat: real %%\n",
    changes: ["D12"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0, // D12, was 1
      bodyStartLine: 3,
      blocks: ". F F . .",
      beats: "3:real:u",
      scanBeats: "3:a:real",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "unwrittenBeats@3 emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatHtmlOnly",
    text: "%% beat: a %%\n<!-- só html -->\n",
    changes: ["D10", "D12"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0, // D12, was 2
      bodyStartLine: 0,
      blocks: ". . .",
      beats: "0:a:u", // D10, was "0:a:w"
      scanBeats: "0:a:a",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "unwrittenBeats@0 emptyBody", // D10, was "emptyBody"
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "beatInInline",
    text: "`%% beat: i %%`\ntexto",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "mathBlock",
    text: "$$\nx^2\n$$\nprosa",
    expect: {
      words: 3,
      chars: 15,
      selection: 3,
      bodyStartLine: 0,
      blocks: ". M M .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "mathWithPct",
    text: "$$\n%% not\n$$\nprosa %% XXX: m %%",
    changes: ["D3", "D9"],
    expect: {
      words: 2,
      chars: 9,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". M %M %M", // D9, was ". M M ."
      beats: "",
      scanBeats: "",
      placeholders: "", // D3, was "3:19-31:m"
      spans: "", // D3, was "19-31/27-28"
      unclosed: 3,
      checks: "unclosedComment@3", // D3, was "unclosedComment@3 placeholders@3"
      enter: "normal", // D9, was "break"
      trailingKeep: null,
    },
  },
  {
    name: "dollarInComment",
    text: "%% $$ %%\nprosa\n\n",
    changes: ["D9"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . .", // D9, was ". M M M"
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break", // D9, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "htmlComment",
    text: "a <!-- one\ntwo --> b\n\nc",
    changes: ["D10", "D12"],
    expect: {
      words: 3,
      chars: 5,
      selection: 3, // D12, was 5
      bodyStartLine: 0,
      blocks: ". % . .", // D10, was ". . . ."
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "htmlOnly",
    text: "<!-- a -->",
    changes: ["D12"],
    expect: {
      words: 0,
      chars: 0,
      selection: 0, // D12, was 1
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "htmlUnclosed",
    text: "a <!-- x\n%% XXX: after %%\nmore words",
    changes: ["D11"],
    expect: {
      words: 4, // D11, was 1
      chars: 19, // D11, was 1
      selection: 4,
      bodyStartLine: 0,
      blocks: ". . .",
      beats: "",
      scanBeats: "",
      placeholders: "1:9-25:after",
      spans: "9-25/17-22",
      unclosed: null,
      checks: "placeholders@1",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceInComment",
    text: "%%\n```\n%%\nprose",
    changes: ["D7"],
    expect: {
      words: 1, // D7, was 0
      chars: 5, // D7, was 0
      selection: 1,
      bodyStartLine: 0,
      blocks: ". % % .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null, // D7, was 0
      checks: "", // D7, was "unclosedComment@0 emptyBody"
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "escapedTick",
    text: "a \\`%% b %% c\\` d",
    changes: ["D6"],
    expect: {
      words: 3, // D6, was 2
      chars: 8, // D6, was 5
      selection: 3,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "multiTickInline",
    text: "a ``x ` %%`` b %% c %% d",
    changes: ["D8"],
    expect: {
      words: 3,
      chars: 5,
      selection: 3,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break", // D8, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "tickPctTick",
    text: "a %% `b %% c`",
    changes: ["D7"],
    expect: {
      words: 2, // D7, was 1
      chars: 4, // D7, was 1
      selection: 2,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null, // D7, was 0
      checks: "", // D7, was "unclosedComment@0"
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "inlineCodeEnter",
    text: "use `%%` here\n\n",
    changes: ["D8", "D12"],
    expect: {
      words: 2,
      chars: 8,
      selection: 2, // D12, was 1
      bodyStartLine: 0,
      blocks: ". . .", // D8, was ". % %"
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break", // D8, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "sceneBreakInCode",
    text: "prosa\n\n```\n---\n\n",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . C C C",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "sceneBreakInFence",
    text: "prosa\n\n```\n\n---\n\n",
    changes: ["D13"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . C C C C",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null, // D13, was 3
    },
  },
  {
    name: "sceneBreakInComment",
    text: "prosa\n\n%%\n\n---\n\n",
    changes: ["D13"],
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . % % % %",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: 2,
      checks: "unclosedComment@2",
      enter: "normal",
      trailingKeep: null, // D13, was 3
    },
  },
  {
    name: "sceneBreakEnd",
    text: "prosa\n\n---\n\n",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "chapter",
      trailingKeep: 1,
    },
  },
  {
    name: "setext",
    text: "Title\n---\n\n",
    expect: {
      words: 1,
      chars: 5,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "crlfMix",
    text: "a\r\n%% x\r\ny %%\r\nb",
    expect: {
      words: 2,
      chars: 3,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . % .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "codeOnlyBody",
    text: "```\n%%\n```\n",
    expect: {
      words: 0,
      chars: 0,
      selection: 0,
      bodyStartLine: 0,
      blocks: ". C C .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "emptyBody",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "listsAndLinks",
    text: "- item [[Nota|alias]] e [texto](http://x.y) #tag\n> citação **forte**",
    changes: ["D12"],
    expect: {
      words: 6,
      chars: 32,
      selection: 6, // D12, was 11
      bodyStartLine: 0,
      blocks: ". .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "fenceEmptyAfter",
    text: "texto\n```\ncode\n```\nfim\n\n",
    changes: ["D12"],
    expect: {
      words: 2,
      chars: 9,
      selection: 2, // D12, was 3
      bodyStartLine: 0,
      blocks: ". . C C . . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "htmlOddPct",
    text: "Prosa.\n\n<!-- nota com %% no meio -->\n\nMais prosa.",
    changes: ["D14"],
    expect: {
      words: 3, // D14, was 1
      chars: 18, // D14, was 6
      selection: 3,
      bodyStartLine: 0,
      blocks: ". . . . .", // D14, was ". . . % %"
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: 2,
      checks: "unclosedComment@2",
      enter: "break", // D14, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "htmlPctThenPct",
    text: "<!-- a %% --> texto %% mais",
    changes: ["D12", "D14"],
    expect: {
      words: 1, // D14, was 0
      chars: 5, // D14, was 0
      selection: 1, // D12, was 2
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: 0, // D14, was null
      checks: "unclosedComment@0", // D14, was "emptyBody"
      enter: "normal",
      trailingKeep: null,
    },
  },
  {
    name: "htmlPctThenPair",
    text: "<!-- a %% --> x %% y %%",
    changes: ["D12", "D14"],
    expect: {
      words: 1, // D14, was 0
      chars: 1, // D14, was 0
      selection: 1, // D12, was 2
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: 0,
      checks: "unclosedComment@0", // D14, was "unclosedComment@0 emptyBody"
      enter: "break", // D14, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "beatTwoComments",
    text: "%% beat: a %% %% beat: b %%\ntext",
    changes: ["D3"],
    expect: {
      words: 1,
      chars: 4,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". .",
      beats: "", // D3, was "0:a %% %% beat: b:w"
      scanBeats: "", // D3, was "0:a:a %% %% beat: b"
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "escapedTickPh",
    text: "a \\`%% XXX: y %%\\` b",
    changes: ["D6"],
    expect: {
      words: 2,
      chars: 7, // D6, was 5
      selection: 2,
      bodyStartLine: 0,
      blocks: ".",
      beats: "",
      scanBeats: "",
      placeholders: "0:4-16:y",
      spans: "4-16/12-13",
      unclosed: null,
      checks: "placeholders@0", // D6, was "" (passed)
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "tabFence",
    text: "\t```\n%% XXX: t %%\n\t```\ny",
    changes: ["D4"],
    expect: {
      words: 1,
      chars: 9,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". . . .", // D4, was ". C C ."
      beats: "",
      scanBeats: "",
      placeholders: "1:5-17:t",
      spans: "5-17/13-14",
      unclosed: null,
      checks: "placeholders@1", // D4, was "" (passed)
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "fenceInMath",
    text: "$$\n```\nx\n```\n$$\np",
    changes: ["D9", "D12"],
    expect: {
      words: 1,
      chars: 7,
      selection: 1, // D12, was 2
      bodyStartLine: 0,
      blocks: ". M CM CM M .", // D9, was ". M M M M ."
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "dollarInInline",
    text: "`$$` a\nb\n",
    changes: ["D9"],
    expect: {
      words: 2,
      chars: 3,
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . .", // D9, was ". M M"
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break", // D9, was "normal"
      trailingKeep: null,
    },
  },
  {
    name: "dollarInFence",
    text: "```\n$$\n```\nb\n",
    expect: {
      words: 1,
      chars: 1,
      selection: 1,
      bodyStartLine: 0,
      blocks: ". C C . .",
      beats: "",
      scanBeats: "",
      placeholders: "",
      spans: "",
      unclosed: null,
      checks: "",
      enter: "break",
      trailingKeep: null,
    },
  },
  {
    name: "htmlUnclosedLineStart",
    text: "<!-- nota\n\n%% XXX: falta %%\nmais\n",
    changes: ["D11", "D12"],
    expect: {
      words: 2, // D11, was 0 (Reading view hides it all: an over-count)
      chars: 14, // D11, was 0
      selection: 2,
      bodyStartLine: 0,
      blocks: ". . . . .",
      beats: "",
      scanBeats: "",
      placeholders: "2:11-27:falta",
      spans: "11-27/19-24",
      unclosed: null,
      checks: "placeholders@2", // D11, was "placeholders@2 emptyBody"
      enter: "break",
      trailingKeep: null,
    },
  },
];

const CTX = { path: "a.md", placeholderMarker: "XXX", recommendedProperties: [] as string[] };

function observe(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/);
  const elines = text.split("\n");
  const blocks = elines.map((_, i) => {
    const s = blockStateAt(elines, i);
    return (s.frontmatter ? "F" : "") + (s.code ? "C" : "") + (s.comment ? "%" : "") + (s.math ? "M" : "") || ".";
  }).join(" ");
  const el = (text + "\n\n").split("\n");
  return {
    words: countWords(text),
    chars: countCharacters(text, { spaces: true }),
    selection: countSelection(segment(text), [{ from: 0, to: text.length }]),
    bodyStartLine: bodyStartLine(lines),
    blocks,
    beats: parseBeats(text).map((b) => `${b.line}:${b.text}:${b.written ? "w" : "u"}`).join(" | "),
    scanBeats: scanBeats(lines).map((b) => `${b.line}:${b.letter}:${b.text}`).join(" | "),
    placeholders: parsePlaceholders(text, "XXX").map((p) => `${p.line}:${p.from}-${p.to}:${p.text}`).join(" | "),
    spans: placeholderSpans(text, "XXX").map((s) => `${s.from}-${s.to}/${s.noteFrom}-${s.noteTo}`).join(" | "),
    unclosed: unclosedComment(text),
    checks: runChecks(text, {}, CTX).filter((c) => c.level !== "passed")
      .map((c) => `${c.id}${c.line !== undefined ? "@" + c.line : ""}`).join(" "),
    enter: decideEnter(el, el.length - 1, "blank"),
    trailingKeep: trailingBreakKeep(text.split("\n")),
  };
}

describe("characterization table", () => {
  for (const row of ROWS) {
    it(`${row.name}${row.changes ? ` (${row.changes.join(", ")})` : ""}`, () => {
      expect(observe(row.text)).toEqual(row.expect);
    });
  }

  it("the selection count of a whole document equals its word count", () => {
    for (const row of ROWS) {
      expect(countSelection(segment(row.text), [{ from: 0, to: row.text.length }]), row.name).toBe(countWords(row.text));
    }
  });

  it("measureText agrees with countWords and countCharacters", () => {
    for (const row of ROWS) {
      expect(measureText(row.text), row.name).toEqual({
        words: countWords(row.text),
        characters: countCharacters(row.text, { spaces: true }),
        charactersNoSpaces: countCharacters(row.text, { spaces: false }),
      });
    }
  });
});

describe("editor entry points", () => {
  it("take a segmentation (segmentDoc) and answer like the line/string forms", () => {
    for (const row of ROWS) {
      const text = row.text.replace(/\r\n/g, "\n"); // an editor document has LF lines
      const lines = text.split("\n");
      const el = (text + "\n\n").split("\n");
      const md = segment(text);
      expect(scanBeats(md), row.name).toEqual(scanBeats(lines));
      expect(placeholderSpans(md, "XXX"), row.name).toEqual(placeholderSpans(text, "XXX"));
      expect(trailingBreakKeep(md), row.name).toEqual(trailingBreakKeep(lines));
      for (let i = 0; i < el.length; i++) {
        expect(decideEnter(segment(el.join("\n")), i, "blank"), `${row.name} line ${i}`).toBe(decideEnter(el, i, "blank"));
      }
      expect(unclosedComment(md), row.name).toBe(unclosedComment(text));
    }
  });
});

describe("consumer regressions", () => {
  it("a placeholder in a fenced block is nowhere", () => {
    const text = "```\n%% XXX: a %%\n```";
    expect(parsePlaceholders(text, "XXX")).toEqual([]);
    expect(scan(text, "XXX")).toEqual([]);
    expect(placeholderSpans(text, "XXX")).toEqual([]);
    expect(runChecks(text, {}, CTX).find((c) => c.id === "placeholders")!.level).toBe("passed");
  });

  it("a beat in a fenced block is not a beat, for the outline or the ghosts", () => {
    const text = "%% beat: a %%\ntexto\n\n```\n%% beat: b %%\n```\n";
    expect(parseBeats(text).map((b) => b.text)).toEqual(["a"]);
    expect(scanBeats(text.split("\n")).map((b) => b.text)).toEqual(["a"]);
  });

  it("ghost letters equal outline letters", () => {
    const text = "%% beat: a %%\n%%\n%% beat: x %%\n%%\n%% beat: b %%\n```\n%% beat: c %%\n```\n%% beat: d %%";
    const beats = parseBeats(text);
    expect(beats.map((b) => b.text)).toEqual(["a", "b", "d"]);
    expect(scanBeats(text.split("\n")).map((g) => [g.line, g.text, g.letter]))
      .toEqual(beats.map((b, i) => [b.line, b.text, "abc"[i]]));
  });

  it("a scene-break line is entirely prose (one definition for the outline and the Enter flow)", () => {
    const md = segment("a\n\n---\n\n```\n---\n```\n%%\n---\n%%\n--- %% x %%\n* * *");
    expect([2, 5, 8, 10, 11].map((i) => isSceneBreakLine(md, i))).toEqual([true, false, false, false, true]);
    expect(isSceneBreakLine(md, -1)).toBe(false);
    expect(isSceneBreakLine(md, 99)).toBe(false);
  });

  it("Enter after a line with %% inside inline code makes a scene break", () => {
    expect(decideEnter(["use `%%` here", "", ""], 2, "blank")).toBe("break");
  });

  it("never removes a --- inside an open fence", () => {
    expect(trailingBreakKeep("prosa\n\n```\n\n---\n".split("\n"))).toBeNull();
    expect(decideEnter("prosa\n\n```\n\n---\n\n".split("\n"), 6, "blank")).toBe("normal");
  });

  it("inserting a beat keeps indices consistent when a beat-looking line sits in code", () => {
    const text = "%% beat: a %%\ntexto\n\n```\n%% beat: code %%\n```\n";
    const out = insertBeat(text, 0, "b");
    expect(out).toContain("```\n%% beat: code %%\n```");
    expect(parseBeats(out).map((b) => b.text)).toEqual(["a", "b"]);
  });
});

describe("countSelection (D12): partial and multiple ranges", () => {
  const sel = (text: string, ranges: [number, number][]) =>
    countSelection(segment(text), ranges.map(([from, to]) => ({ from, to })));
  const range = (text: string, part: string): [number, number] => {
    const at = text.indexOf(part);
    return [at, at + part.length];
  };

  it("counts nothing for no ranges", () => {
    expect(sel("uma frase", [])).toBe(0);
  });

  it("counts nothing inside a fenced block", () => {
    const text = "a\n```\nb c\n```\nd";
    expect(sel(text, [range(text, "b c")])).toBe(0);
    expect(sel(text, [range(text, "```\nb c\n```\nd")])).toBe(1);
  });

  it("a range that starts inside a comment counts only what follows the closer", () => {
    const text = "x %% f\ng %% h i";
    expect(sel(text, [range(text, "g %% h i")])).toBe(2);
    expect(sel(text, [range(text, "f\ng")])).toBe(0);
  });

  it("a range crossing the frontmatter closer counts only the body", () => {
    const text = "---\na: 1\n---\nprosa aqui";
    expect(sel(text, [range(text, "a: 1\n---\nprosa aqui")])).toBe(2);
  });

  it("each range counts on its own (a word split across two ranges counts twice)", () => {
    const text = "palavra outra";
    expect(sel(text, [[0, 3], [8, 13]])).toBe(2);
    expect(sel(text, [[0, 3], [3, 7]])).toBe(2);
    expect(sel(text, [range(text, "pal")])).toBe(1);
  });

  it("reads CRLF text like LF", () => {
    const text = "a\r\n%% x\r\ny %%\r\nb c";
    expect(sel(text, [range(text, "y %%\r\nb c")])).toBe(2);
    expect(sel(text, [range(text, "x\r\ny")])).toBe(0);
  });
});

describe("dialogue focus over the fixtures", () => {
  it("speech lies in prose, after the properties, sorted and single-line", () => {
    for (const row of ROWS) {
      const text = row.text.replace(/\r\n/g, "\n"); // an editor document has LF lines
      const md = segment(text);
      const body = bodyLineIn(md);
      let prev = -1;
      for (const style of ["blank", "single"] as const) {
        prev = -1;
        for (const r of dialogueInDoc(md, 0, md.lineCount - 1, { quoteStyle: "curly", paragraphStyle: style })) {
          expect(md.spans(r.from, r.from + 1)[0].kind, row.name).toBe("prose");
          expect(md.lineOf(r.from), row.name).toBeGreaterThanOrEqual(body);
          expect(r.from, row.name).toBeGreaterThan(prev);
          expect(r.to, row.name).toBeGreaterThan(r.from);
          expect(/[\r\n]/.test(text.slice(r.from, r.to)), row.name).toBe(false);
          prev = r.to;
        }
      }
    }
  });
});
