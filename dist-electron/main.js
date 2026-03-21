import { app as b, BrowserWindow as P, ipcMain as p, dialog as w } from "electron";
import { fileURLToPath as G } from "node:url";
import s from "node:path";
import { existsSync as X } from "node:fs";
import { randomUUID as J } from "node:crypto";
import { tmpdir as K } from "node:os";
import { execFile as I } from "node:child_process";
import { readFile as U, mkdir as Y, writeFile as W, unlink as Q, stat as T } from "node:fs/promises";
const Z = {
  defaultOutputFolder: null
};
function $() {
  return s.join(b.getPath("userData"), "settings.json");
}
function z(t) {
  if (typeof t != "string")
    return null;
  const e = t.trim();
  return e ? s.resolve(e) : null;
}
async function ee() {
  try {
    const t = await U($(), "utf8"), e = JSON.parse(t);
    return {
      defaultOutputFolder: z(e.defaultOutputFolder)
    };
  } catch {
    return Z;
  }
}
async function y(t) {
  const e = $();
  await Y(s.dirname(e), { recursive: !0 });
  const n = {
    defaultOutputFolder: z(t.defaultOutputFolder)
  };
  await W(e, JSON.stringify(n, null, 2), "utf8");
}
const q = s.dirname(G(import.meta.url));
process.env.APP_ROOT = s.join(q, "..");
const x = process.env.VITE_DEV_SERVER_URL, Te = s.join(process.env.APP_ROOT, "dist-electron"), V = s.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = x ? s.join(process.env.APP_ROOT, "public") : V;
const C = s.join(process.env.APP_ROOT, "resources", "icon.ico"), te = s.join(
  process.env.VITE_PUBLIC,
  "electron-vite.svg"
), ne = X(C) ? C : te;
let g, f = { defaultOutputFolder: null };
const re = [
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
], O = /* @__PURE__ */ new Set([".mp3", ".m4a"]), M = /* @__PURE__ */ new Set([".wav", ".flac"]), oe = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]), ae = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]), D = 2;
function E(t) {
  return typeof t == "number" && Number.isFinite(t);
}
function h(t) {
  return s.resolve(t);
}
function v(t) {
  return t.toFixed(3);
}
function F(t) {
  return s.extname(t).toLowerCase();
}
async function S(t) {
  if (!(await T(t)).isFile())
    throw new Error("Input path must be a file.");
}
async function L(t) {
  const e = s.dirname(t);
  if (!(await T(e)).isDirectory())
    throw new Error("Output directory does not exist.");
}
async function _(t) {
  try {
    return (await T(t)).isDirectory();
  } catch {
    return !1;
  }
}
function A(t) {
  return new Promise((e, n) => {
    I(
      "ffmpeg",
      t,
      { windowsHide: !0 },
      (r, o, u) => {
        if (!r) {
          e();
          return;
        }
        const i = u.trim() || r.message || "FFmpeg command failed.";
        n(new Error(i));
      }
    );
  });
}
function R(t) {
  return new Promise((e, n) => {
    I(
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
      (o, u, i) => {
        var N;
        if (o) {
          const k = i.trim() || o.message || "FFprobe command failed.";
          n(new Error(k));
          return;
        }
        let l;
        try {
          l = JSON.parse(u);
        } catch {
          n(new Error("Unable to parse FFprobe output."));
          return;
        }
        const a = (N = l.streams) == null ? void 0 : N[0];
        if (!(a != null && a.codec_name)) {
          n(new Error("No primary audio stream found."));
          return;
        }
        const c = Number.parseInt(a.sample_rate ?? "", 10);
        if (!Number.isFinite(c) || c <= 0) {
          n(new Error("Invalid audio sample rate from FFprobe."));
          return;
        }
        const d = a.channels ?? 0;
        if (!Number.isFinite(d) || d <= 0) {
          n(new Error("Invalid audio channel count from FFprobe."));
          return;
        }
        const m = Number.parseInt(a.bit_rate ?? "", 10);
        e({
          codec: a.codec_name,
          sampleRate: c,
          channels: d,
          channelLayout: a.channel_layout ?? "",
          bitRate: Number.isFinite(m) && m > 0 ? m : 0
        });
      }
    );
  });
}
function ie(t) {
  if (!t || typeof t != "object")
    throw new Error("Invalid cut payload.");
  const e = t;
  if (!e.inputPath || typeof e.inputPath != "string")
    throw new Error("inputPath is required.");
  if (!e.outputPath || typeof e.outputPath != "string")
    throw new Error("outputPath is required.");
  if (!E(e.startTime) || e.startTime < 0)
    throw new Error("startTime must be a finite number >= 0.");
  if (!E(e.endTime) || e.endTime <= e.startTime)
    throw new Error("endTime must be greater than startTime.");
  if (e.endTime - e.startTime < 0.05)
    throw new Error("Cut duration must be at least 0.05 seconds.");
  if (e.mode && e.mode !== "copy" && e.mode !== "precise")
    throw new Error("mode must be either copy or precise.");
  if (e.fadeIn != null && typeof e.fadeIn != "boolean")
    throw new Error("fadeIn must be a boolean.");
  if (e.fadeOut != null && typeof e.fadeOut != "boolean")
    throw new Error("fadeOut must be a boolean.");
  if (e.fadeInDuration != null && (!E(e.fadeInDuration) || e.fadeInDuration <= 0))
    throw new Error("fadeInDuration must be a finite number > 0.");
  if (e.fadeOutDuration != null && (!E(e.fadeOutDuration) || e.fadeOutDuration <= 0))
    throw new Error("fadeOutDuration must be a finite number > 0.");
  return {
    inputPath: h(e.inputPath),
    startTime: e.startTime,
    endTime: e.endTime,
    outputPath: h(e.outputPath),
    mode: e.mode,
    fadeIn: e.fadeIn ?? !1,
    fadeOut: e.fadeOut ?? !1,
    fadeInDuration: e.fadeInDuration ?? D,
    fadeOutDuration: e.fadeOutDuration ?? D
  };
}
function se(t) {
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
    return h(o);
  });
  if (new Set(n.map(ue)).size !== n.length)
    throw new Error("Duplicate file paths are not allowed in merge queue.");
  return {
    filePaths: n,
    outputPath: h(e.outputPath)
  };
}
function ue(t) {
  return s.normalize(t).toLowerCase();
}
function le(t, e, n, r) {
  if (n !== "precise" && O.has(t)) {
    if (e !== t)
      throw new Error(
        "For MP3/M4A passthrough cuts, output extension must match input extension."
      );
    return ["-c", "copy"];
  }
  if (e === ".mp3")
    return ["-c:a", "libmp3lame", "-b:a", "192k"];
  if (e === ".m4a")
    return ["-c:a", "aac", "-b:a", r && r > 0 ? `${Math.round(r / 1e3)}k` : "256k"];
  if (e === ".wav")
    return ["-c:a", "pcm_s16le"];
  if (e === ".flac")
    return ["-c:a", "flac"];
  throw new Error(
    "Unsupported output extension. Use .mp3, .m4a, .wav, or .flac."
  );
}
function ce(t, e, n, r, o) {
  if (!e && !n)
    return null;
  const u = Math.max(0.01, t / 2), i = Math.min(
    u,
    Math.max(0.01, r)
  ), l = Math.min(
    u,
    Math.max(0.01, o)
  ), a = [];
  if (e && a.push(`afade=t=in:st=0:d=${v(i)}`), n) {
    const c = Math.max(0, t - l);
    a.push(
      `afade=t=out:st=${v(c)}:d=${v(l)}`
    );
  }
  return a.join(",");
}
function fe(t) {
  if (!t)
    return "";
  const e = t.trim().toLowerCase();
  return e ? e.startsWith(".") ? e : `.${e}` : "";
}
function B(t, e) {
  if (typeof t != "string")
    return e;
  const n = t.trim();
  return n && [...s.basename(n)].filter((i) => {
    const l = i.charCodeAt(0);
    return l >= 32 && l !== 127;
  }).join("").trim() || e;
}
function de(t) {
  if (t == null)
    return { defaultName: "clip.wav", forceDialog: !1 };
  if (typeof t != "object")
    throw new Error("Invalid save-audio payload.");
  const e = t, n = e.mode;
  if (n && n !== "copy" && n !== "precise")
    throw new Error("save-audio mode must be either copy or precise.");
  if (e.forceDialog != null && typeof e.forceDialog != "boolean")
    throw new Error("save-audio forceDialog must be a boolean.");
  return {
    defaultName: B(e.defaultName, "clip.wav"),
    inputExtension: fe(e.inputExtension),
    mode: n,
    forceDialog: e.forceDialog ?? !1
  };
}
function me(t) {
  if (t == null)
    return { defaultName: "merged.wav", forceDialog: !1 };
  if (typeof t != "object")
    throw new Error("Invalid save-merge payload.");
  const e = t;
  if (e.forceDialog != null && typeof e.forceDialog != "boolean")
    throw new Error("save-merge forceDialog must be a boolean.");
  return {
    defaultName: B(e.defaultName, "merged.wav"),
    forceDialog: e.forceDialog ?? !1
  };
}
function pe(t, e) {
  return O.has(t) && e !== "precise" ? t === ".mp3" ? [{ name: "MP3", extensions: ["mp3"] }] : [{ name: "M4A", extensions: ["m4a"] }] : O.has(t) ? [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ] : [
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function he() {
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function we(t) {
  if (t === ".wav")
    return ["-c:a", "pcm_s16le"];
  if (t === ".flac")
    return ["-c:a", "flac"];
  throw new Error("Mixed-format merges must be saved as .wav or .flac.");
}
function ge(t) {
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
function Pe(t) {
  return t.replace(/'/g, "'\\''");
}
function ve(t) {
  return t.map((e) => `file '${Pe(e)}'`).join(`
`);
}
function be(t) {
  if (t.length < 2)
    return !1;
  const e = t[0];
  return t.every((n) => n.codec !== e.codec || n.sampleRate !== e.sampleRate || n.channels !== e.channels ? !1 : e.channelLayout && n.channelLayout ? n.channelLayout === e.channelLayout : !0);
}
function j(t, e) {
  var i;
  const n = new Set(
    (e == null ? void 0 : e.flatMap((l) => l.extensions)) ?? []
  );
  if (n.size === 0)
    return t;
  const r = s.extname(t).toLowerCase().replace(/^\./, "");
  if (r && n.has(r))
    return t;
  const o = (i = e == null ? void 0 : e[0]) == null ? void 0 : i.extensions[0];
  return o ? `${s.extname(t).length > 0 ? t.slice(0, -s.extname(t).length) : t}.${o}` : t;
}
function ye() {
  return new Promise((t) => {
    I("ffmpeg", ["-version"], { windowsHide: !0 }, (e, n) => {
      if (e) {
        t({ available: !1, version: "" });
        return;
      }
      const r = n.split(/\r?\n/, 1)[0] ?? "";
      t({ available: !0, version: r.trim() });
    });
  });
}
function Ee() {
  p.handle("ffmpeg:check", () => ye()), p.handle("audio:read-file", async (t, e) => {
    if (typeof e != "string" || e.trim().length === 0)
      throw new Error("A valid file path is required.");
    const n = h(e);
    await S(n);
    const r = await U(n), o = r.byteOffset, u = r.byteLength;
    return { arrayBuffer: r.buffer.slice(o, o + u) };
  }), p.handle("dialog:open-audio", async () => {
    const t = {
      title: "Select Audio File",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: re
        }
      ]
    }, e = g ?? P.getFocusedWindow(), n = e ? await w.showOpenDialog(e, t) : await w.showOpenDialog(t);
    return n.canceled ? { filePaths: [] } : {
      filePaths: n.filePaths.map(
        (r) => s.resolve(r)
      )
    };
  }), p.handle("dialog:select-output-folder", async () => {
    const t = {
      title: "Select Default Output Folder",
      properties: ["openDirectory", "createDirectory"]
    }, e = g ?? P.getFocusedWindow(), n = e ? await w.showOpenDialog(e, t) : await w.showOpenDialog(t);
    return n.canceled || n.filePaths.length === 0 ? { folderPath: void 0 } : {
      folderPath: h(n.filePaths[0])
    };
  }), p.handle("settings:get-default-output-folder", () => ({ folderPath: f.defaultOutputFolder ?? void 0 })), p.handle(
    "settings:set-default-output-folder",
    async (t, e) => {
      if (typeof e != "string" || e.trim().length === 0)
        throw new Error("A valid output folder path is required.");
      const n = h(e);
      if (!await _(n))
        throw new Error("Selected output folder does not exist.");
      return f = {
        ...f,
        defaultOutputFolder: n
      }, await y(f), { folderPath: n };
    }
  ), p.handle("settings:clear-default-output-folder", async () => (f = {
    ...f,
    defaultOutputFolder: null
  }, await y(f), { success: !0 })), p.handle("dialog:save-audio", async (t, e) => {
    const n = de(e), r = n.defaultName ?? "clip.wav", o = pe(
      n.inputExtension ?? "",
      n.mode
    ), u = j(
      r,
      o
    ), i = f.defaultOutputFolder, l = typeof i == "string" && i.length > 0 && await _(i);
    if (!n.forceDialog && l)
      return {
        filePath: h(s.join(i, u))
      };
    const a = {
      title: "Save Cut Audio",
      defaultPath: l ? s.join(i, u) : u,
      filters: o
    }, c = g ?? P.getFocusedWindow(), d = c ? await w.showSaveDialog(c, a) : await w.showSaveDialog(a);
    if (d.canceled || !d.filePath)
      return { filePath: void 0 };
    const m = s.dirname(d.filePath);
    return m !== f.defaultOutputFolder && (f = {
      ...f,
      defaultOutputFolder: m
    }, await y(f).catch(() => {
    })), { filePath: h(d.filePath) };
  }), p.handle("dialog:save-merge", async (t, e) => {
    const n = me(e), r = n.defaultName ?? "merged.wav", o = he(), u = j(
      r,
      o
    ), i = f.defaultOutputFolder, l = typeof i == "string" && i.length > 0 && await _(i);
    if (!n.forceDialog && l)
      return {
        filePath: h(s.join(i, u))
      };
    const a = {
      title: "Save Merged Audio",
      defaultPath: l ? s.join(i, u) : u,
      filters: o
    }, c = g ?? P.getFocusedWindow(), d = c ? await w.showSaveDialog(c, a) : await w.showSaveDialog(a);
    if (d.canceled || !d.filePath)
      return { filePath: void 0 };
    const m = s.dirname(d.filePath);
    return m !== f.defaultOutputFolder && (f = {
      ...f,
      defaultOutputFolder: m
    }, await y(f).catch(() => {
    })), { filePath: h(d.filePath) };
  }), p.handle("audio:cut", async (t, e) => {
    const n = ie(e);
    await S(n.inputPath), await L(n.outputPath);
    const r = F(n.inputPath), o = F(n.outputPath), u = !!(n.fadeIn || n.fadeOut), i = n.mode === "precise" || u ? "precise" : "copy";
    if (O.has(r)) {
      if (i !== "precise" && o !== r)
        throw new Error(
          "Output extension must match input for MP3/M4A passthrough cuts."
        );
    } else if (!M.has(o))
      throw new Error("For non-MP3/M4A sources, output must be .wav or .flac.");
    let l;
    i === "precise" && r === ".m4a" && o === ".m4a" && (l = (await R(n.inputPath)).bitRate);
    const a = le(
      r,
      o,
      i,
      l
    ), c = ce(
      n.endTime - n.startTime,
      !!n.fadeIn,
      !!n.fadeOut,
      n.fadeInDuration ?? D,
      n.fadeOutDuration ?? D
    ), d = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      v(n.startTime),
      "-to",
      v(n.endTime),
      "-i",
      n.inputPath,
      ...c ? ["-af", c] : [],
      ...a,
      n.outputPath
    ];
    return await A(d), { success: !0, outputPath: n.outputPath };
  }), p.handle("audio:merge", async (t, e) => {
    const n = se(e);
    await L(n.outputPath), await Promise.all(n.filePaths.map((a) => S(a)));
    const r = n.filePaths.map(
      (a) => F(a)
    ), o = r[0], u = F(n.outputPath);
    if (!ae.has(u))
      throw new Error("Merge output must use .mp3, .m4a, .wav, or .flac.");
    const i = r.every(
      (a) => a === o
    );
    let l = !1;
    if (i && oe.has(o)) {
      const a = await Promise.all(
        n.filePaths.map((c) => R(c))
      );
      l = be(a);
    }
    if (l) {
      if (u !== o)
        throw new Error(
          "For stream-copy merge, output extension must match source files."
        );
      const a = s.join(
        K(),
        `audioslice-merge-${J()}.txt`
      );
      try {
        await W(
          a,
          ve(n.filePaths),
          {
            encoding: "utf8"
          }
        ), await A([
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          a,
          "-c",
          "copy",
          n.outputPath
        ]);
      } finally {
        await Q(a).catch(() => {
        });
      }
    } else {
      if (!M.has(u))
        throw new Error("Mixed-format merges must be saved as .wav or .flac.");
      const a = n.filePaths.flatMap((m) => [
        "-i",
        m
      ]), c = ge(n.filePaths.length), d = we(u);
      await A([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...a,
        "-filter_complex",
        c,
        "-map",
        "[outa]",
        ...d,
        n.outputPath
      ]);
    }
    return { success: !0, outputPath: n.outputPath };
  });
}
function H() {
  g = new P({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: ne,
    webPreferences: {
      preload: s.join(q, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), x ? g.loadURL(x) : g.loadFile(s.join(V, "index.html"));
}
b.on("window-all-closed", () => {
  process.platform !== "darwin" && (b.quit(), g = null);
});
b.on("activate", () => {
  P.getAllWindows().length === 0 && H();
});
b.whenReady().then(async () => {
  f = await ee(), Ee(), H();
});
export {
  Te as MAIN_DIST,
  V as RENDERER_DIST,
  x as VITE_DEV_SERVER_URL
};
