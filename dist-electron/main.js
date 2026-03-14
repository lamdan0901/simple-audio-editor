import { app as v, BrowserWindow as w, ipcMain as f, dialog as h } from "electron";
import { fileURLToPath as R } from "node:url";
import a from "node:path";
import { randomUUID as D } from "node:crypto";
import { tmpdir as U } from "node:os";
import { execFile as F } from "node:child_process";
import { writeFile as W, unlink as $, stat as I } from "node:fs/promises";
const N = a.dirname(R(import.meta.url));
process.env.APP_ROOT = a.join(N, "..");
const _ = process.env.VITE_DEV_SERVER_URL, me = a.join(process.env.APP_ROOT, "dist-electron"), L = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = _ ? a.join(process.env.APP_ROOT, "public") : L;
let l;
const j = [
  "mp3",
  "wav",
  "flac",
  "ogg",
  "aac",
  "m4a",
  "wma",
  "aiff",
  "aif",
  "opus"
], E = /* @__PURE__ */ new Set([".mp3", ".m4a"]), S = /* @__PURE__ */ new Set([".wav", ".flac"]), V = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]);
function x(t) {
  return typeof t == "number" && Number.isFinite(t);
}
function p(t) {
  return a.resolve(t);
}
function A(t) {
  return t.toFixed(3);
}
function P(t) {
  return a.extname(t).toLowerCase();
}
async function T(t) {
  if (!(await I(t)).isFile())
    throw new Error("Input path must be a file.");
}
async function y(t) {
  const e = a.dirname(t);
  if (!(await I(e)).isDirectory())
    throw new Error("Output directory does not exist.");
}
function b(t) {
  return new Promise((e, n) => {
    F(
      "ffmpeg",
      t,
      { windowsHide: !0 },
      (r, o, u) => {
        if (!r) {
          e();
          return;
        }
        const s = u.trim() || r.message || "FFmpeg command failed.";
        n(new Error(s));
      }
    );
  });
}
function z(t) {
  return new Promise((e, n) => {
    F(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_streams",
        "-of",
        "json",
        t
      ],
      { windowsHide: !0 },
      (o, u, s) => {
        var g;
        if (o) {
          const O = s.trim() || o.message || "FFprobe command failed.";
          n(new Error(O));
          return;
        }
        let c;
        try {
          c = JSON.parse(u);
        } catch {
          n(new Error("Unable to parse FFprobe output."));
          return;
        }
        const i = (g = c.streams) == null ? void 0 : g[0];
        if (!(i != null && i.codec_name)) {
          n(new Error("No primary audio stream found."));
          return;
        }
        const m = Number.parseInt(i.sample_rate ?? "", 10);
        if (!Number.isFinite(m) || m <= 0) {
          n(new Error("Invalid audio sample rate from FFprobe."));
          return;
        }
        const d = i.channels ?? 0;
        if (!Number.isFinite(d) || d <= 0) {
          n(new Error("Invalid audio channel count from FFprobe."));
          return;
        }
        e({
          codec: i.codec_name,
          sampleRate: m,
          channels: d,
          channelLayout: i.channel_layout ?? ""
        });
      }
    );
  });
}
function q(t) {
  if (!t || typeof t != "object")
    throw new Error("Invalid cut payload.");
  const e = t;
  if (!e.inputPath || typeof e.inputPath != "string")
    throw new Error("inputPath is required.");
  if (!e.outputPath || typeof e.outputPath != "string")
    throw new Error("outputPath is required.");
  if (!x(e.startTime) || e.startTime < 0)
    throw new Error("startTime must be a finite number >= 0.");
  if (!x(e.endTime) || e.endTime <= e.startTime)
    throw new Error("endTime must be greater than startTime.");
  if (e.endTime - e.startTime < 0.05)
    throw new Error("Cut duration must be at least 0.05 seconds.");
  if (e.mode && e.mode !== "copy" && e.mode !== "precise")
    throw new Error("mode must be either copy or precise.");
  return {
    inputPath: p(e.inputPath),
    startTime: e.startTime,
    endTime: e.endTime,
    outputPath: p(e.outputPath),
    mode: e.mode
  };
}
function H(t) {
  if (!t || typeof t != "object")
    throw new Error("Invalid merge payload.");
  const e = t;
  if (!Array.isArray(e.filePaths))
    throw new Error("filePaths must be an array.");
  if (e.filePaths.length < 2)
    throw new Error("At least two files are required to merge.");
  if (!e.outputPath || typeof e.outputPath != "string")
    throw new Error("outputPath is required.");
  const n = e.filePaths.map((o) => {
    if (typeof o != "string" || o.trim().length === 0)
      throw new Error("Each merge file path must be a non-empty string.");
    return p(o);
  });
  if (new Set(n.map(k)).size !== n.length)
    throw new Error("Duplicate file paths are not allowed in merge queue.");
  return {
    filePaths: n,
    outputPath: p(e.outputPath)
  };
}
function k(t) {
  return a.normalize(t).toLowerCase();
}
function X(t, e, n) {
  if (n !== "precise" && E.has(t)) {
    if (e !== t)
      throw new Error(
        "For MP3/M4A passthrough cuts, output extension must match input extension."
      );
    return ["-c", "copy"];
  }
  if (e === ".mp3")
    return ["-c:a", "libmp3lame", "-b:a", "192k"];
  if (e === ".m4a")
    return ["-c:a", "aac", "-b:a", "192k"];
  if (e === ".wav")
    return ["-c:a", "pcm_s16le"];
  if (e === ".flac")
    return ["-c:a", "flac"];
  throw new Error(
    "Unsupported output extension. Use .mp3, .m4a, .wav, or .flac."
  );
}
function B(t) {
  if (!t)
    return "";
  const e = t.trim().toLowerCase();
  return e ? e.startsWith(".") ? e : `.${e}` : "";
}
function G(t, e) {
  return E.has(t) && e !== "precise" ? t === ".mp3" ? [{ name: "MP3", extensions: ["mp3"] }] : [{ name: "M4A", extensions: ["m4a"] }] : E.has(t) ? [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ] : [
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function J() {
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function Y(t) {
  if (t === ".wav")
    return ["-c:a", "pcm_s16le"];
  if (t === ".flac")
    return ["-c:a", "flac"];
  throw new Error("Mixed-format merges must be saved as .wav or .flac.");
}
function K(t) {
  const e = [], n = [];
  for (let r = 0; r < t; r += 1) {
    const o = `a${r}`;
    e.push(
      `[${r}:a]aresample=48000,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[${o}]`
    ), n.push(`[${o}]`);
  }
  return e.push(
    `${n.join("")}concat=n=${t}:v=0:a=1[outa]`
  ), e.join(";");
}
function Q(t) {
  return t.replace(/'/g, "'\\''");
}
function Z(t) {
  return t.map((e) => `file '${Q(e)}'`).join(`
`);
}
function ee(t) {
  if (t.length < 2)
    return !1;
  const e = t[0];
  return t.every((n) => n.codec !== e.codec || n.sampleRate !== e.sampleRate || n.channels !== e.channels ? !1 : e.channelLayout && n.channelLayout ? n.channelLayout === e.channelLayout : !0);
}
function C(t, e) {
  var s;
  const n = new Set(
    (e == null ? void 0 : e.flatMap((c) => c.extensions)) ?? []
  );
  if (n.size === 0)
    return t;
  const r = a.extname(t).toLowerCase().replace(/^\./, "");
  if (r && n.has(r))
    return t;
  const o = (s = e == null ? void 0 : e[0]) == null ? void 0 : s.extensions[0];
  return o ? `${a.extname(t).length > 0 ? t.slice(0, -a.extname(t).length) : t}.${o}` : t;
}
function te() {
  return new Promise((t) => {
    F("ffmpeg", ["-version"], { windowsHide: !0 }, (e, n) => {
      if (e) {
        t({ available: !1, version: "" });
        return;
      }
      const r = n.split(/\r?\n/, 1)[0] ?? "";
      t({ available: !0, version: r.trim() });
    });
  });
}
function ne() {
  f.handle("ffmpeg:check", () => te()), f.handle("dialog:open-audio", async () => {
    const t = {
      title: "Select Audio File",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: j
        }
      ]
    }, e = l ?? w.getFocusedWindow(), n = e ? await h.showOpenDialog(e, t) : await h.showOpenDialog(t);
    return n.canceled ? { filePaths: [] } : {
      filePaths: n.filePaths.map(
        (r) => a.resolve(r)
      )
    };
  }), f.handle(
    "dialog:save-audio",
    async (t, e) => {
      const n = typeof (e == null ? void 0 : e.defaultName) == "string" && e.defaultName.trim().length > 0 ? e.defaultName.trim() : "clip.wav", r = B(e == null ? void 0 : e.inputExtension), o = G(r, e == null ? void 0 : e.mode), s = {
        title: "Save Cut Audio",
        defaultPath: C(
          n,
          o
        ),
        filters: o
      }, c = l ?? w.getFocusedWindow(), i = c ? await h.showSaveDialog(c, s) : await h.showSaveDialog(s);
      return i.canceled || !i.filePath ? { filePath: void 0 } : { filePath: p(i.filePath) };
    }
  ), f.handle(
    "dialog:save-merge",
    async (t, e) => {
      const n = typeof (e == null ? void 0 : e.defaultName) == "string" && e.defaultName.trim().length > 0 ? e.defaultName.trim() : "merged.wav", r = J(), u = {
        title: "Save Merged Audio",
        defaultPath: C(
          n,
          r
        ),
        filters: r
      }, s = l ?? w.getFocusedWindow(), c = s ? await h.showSaveDialog(s, u) : await h.showSaveDialog(u);
      return c.canceled || !c.filePath ? { filePath: void 0 } : { filePath: p(c.filePath) };
    }
  ), f.handle("audio:cut", async (t, e) => {
    const n = q(e);
    await T(n.inputPath), await y(n.outputPath);
    const r = P(n.inputPath), o = P(n.outputPath);
    if (E.has(r)) {
      if (n.mode !== "precise" && o !== r)
        throw new Error(
          "Output extension must match input for MP3/M4A passthrough cuts."
        );
    } else if (!S.has(o))
      throw new Error("For non-MP3/M4A sources, output must be .wav or .flac.");
    const u = X(r, o, n.mode), s = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      A(n.startTime),
      "-to",
      A(n.endTime),
      "-i",
      n.inputPath,
      ...u,
      n.outputPath
    ];
    return await b(s), { success: !0, outputPath: n.outputPath };
  }), f.handle("audio:merge", async (t, e) => {
    const n = H(e);
    await y(n.outputPath), await Promise.all(n.filePaths.map((i) => T(i)));
    const r = n.filePaths.map(
      (i) => P(i)
    ), o = r[0], u = P(n.outputPath), s = r.every(
      (i) => i === o
    );
    let c = !1;
    if (s && V.has(o)) {
      const i = await Promise.all(
        n.filePaths.map((m) => z(m))
      );
      c = ee(i);
    }
    if (c) {
      if (u !== o)
        throw new Error(
          "For stream-copy merge, output extension must match source files."
        );
      const i = a.join(
        U(),
        `audioslice-merge-${D()}.txt`
      );
      try {
        await W(
          i,
          Z(n.filePaths),
          {
            encoding: "utf8"
          }
        ), await b([
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          i,
          "-c",
          "copy",
          n.outputPath
        ]);
      } finally {
        await $(i).catch(() => {
        });
      }
    } else {
      if (!S.has(u))
        throw new Error("Mixed-format merges must be saved as .wav or .flac.");
      const i = n.filePaths.flatMap((g) => [
        "-i",
        g
      ]), m = K(n.filePaths.length), d = Y(u);
      await b([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...i,
        "-filter_complex",
        m,
        "-map",
        "[outa]",
        ...d,
        n.outputPath
      ]);
    }
    return { success: !0, outputPath: n.outputPath };
  });
}
function M() {
  l = new w({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(N, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), _ ? l.loadURL(_) : l.loadFile(a.join(L, "index.html"));
}
v.on("window-all-closed", () => {
  process.platform !== "darwin" && (v.quit(), l = null);
});
v.on("activate", () => {
  w.getAllWindows().length === 0 && M();
});
v.whenReady().then(() => {
  ne(), M();
});
export {
  me as MAIN_DIST,
  L as RENDERER_DIST,
  _ as VITE_DEV_SERVER_URL
};
