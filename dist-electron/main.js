import { app as v, BrowserWindow as w, ipcMain as f, dialog as d } from "electron";
import { fileURLToPath as U } from "node:url";
import i from "node:path";
import { existsSync as W } from "node:fs";
import { randomUUID as j } from "node:crypto";
import { tmpdir as $ } from "node:os";
import { execFile as _ } from "node:child_process";
import { writeFile as V, unlink as z, stat as I } from "node:fs/promises";
const O = i.dirname(U(import.meta.url));
process.env.APP_ROOT = i.join(O, "..");
const y = process.env.VITE_DEV_SERVER_URL, ve = i.join(process.env.APP_ROOT, "dist-electron"), L = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? i.join(process.env.APP_ROOT, "public") : L;
const S = i.join(process.env.APP_ROOT, "resources", "icon.ico"), H = i.join(
  process.env.VITE_PUBLIC,
  "electron-vite.svg"
), q = W(S) ? S : H;
let m;
const X = [
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
], E = /* @__PURE__ */ new Set([".mp3", ".m4a"]), A = /* @__PURE__ */ new Set([".wav", ".flac"]), B = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]), G = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]);
function F(t) {
  return typeof t == "number" && Number.isFinite(t);
}
function p(t) {
  return i.resolve(t);
}
function x(t) {
  return t.toFixed(3);
}
function P(t) {
  return i.extname(t).toLowerCase();
}
async function T(t) {
  if (!(await I(t)).isFile())
    throw new Error("Input path must be a file.");
}
async function N(t) {
  const e = i.dirname(t);
  if (!(await I(e)).isDirectory())
    throw new Error("Output directory does not exist.");
}
function b(t) {
  return new Promise((e, n) => {
    _(
      "ffmpeg",
      t,
      { windowsHide: !0 },
      (r, a, u) => {
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
function k(t) {
  return new Promise((e, n) => {
    _(
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
      (a, u, s) => {
        var g;
        if (a) {
          const R = s.trim() || a.message || "FFprobe command failed.";
          n(new Error(R));
          return;
        }
        let c;
        try {
          c = JSON.parse(u);
        } catch {
          n(new Error("Unable to parse FFprobe output."));
          return;
        }
        const o = (g = c.streams) == null ? void 0 : g[0];
        if (!(o != null && o.codec_name)) {
          n(new Error("No primary audio stream found."));
          return;
        }
        const l = Number.parseInt(o.sample_rate ?? "", 10);
        if (!Number.isFinite(l) || l <= 0) {
          n(new Error("Invalid audio sample rate from FFprobe."));
          return;
        }
        const h = o.channels ?? 0;
        if (!Number.isFinite(h) || h <= 0) {
          n(new Error("Invalid audio channel count from FFprobe."));
          return;
        }
        e({
          codec: o.codec_name,
          sampleRate: l,
          channels: h,
          channelLayout: o.channel_layout ?? ""
        });
      }
    );
  });
}
function J(t) {
  if (!t || typeof t != "object")
    throw new Error("Invalid cut payload.");
  const e = t;
  if (!e.inputPath || typeof e.inputPath != "string")
    throw new Error("inputPath is required.");
  if (!e.outputPath || typeof e.outputPath != "string")
    throw new Error("outputPath is required.");
  if (!F(e.startTime) || e.startTime < 0)
    throw new Error("startTime must be a finite number >= 0.");
  if (!F(e.endTime) || e.endTime <= e.startTime)
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
function K(t) {
  if (!t || typeof t != "object")
    throw new Error("Invalid merge payload.");
  const e = t;
  if (!Array.isArray(e.filePaths))
    throw new Error("filePaths must be an array.");
  if (e.filePaths.length < 2)
    throw new Error("At least two files are required to merge.");
  if (!e.outputPath || typeof e.outputPath != "string")
    throw new Error("outputPath is required.");
  const n = e.filePaths.map((a) => {
    if (typeof a != "string" || a.trim().length === 0)
      throw new Error("Each merge file path must be a non-empty string.");
    return p(a);
  });
  if (new Set(n.map(Y)).size !== n.length)
    throw new Error("Duplicate file paths are not allowed in merge queue.");
  return {
    filePaths: n,
    outputPath: p(e.outputPath)
  };
}
function Y(t) {
  return i.normalize(t).toLowerCase();
}
function Q(t, e, n) {
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
function Z(t) {
  if (!t)
    return "";
  const e = t.trim().toLowerCase();
  return e ? e.startsWith(".") ? e : `.${e}` : "";
}
function M(t, e) {
  if (typeof t != "string")
    return e;
  const n = t.trim();
  return n && i.basename(n).replace(/[\u0000-\u001F\u007F]/g, "").trim() || e;
}
function ee(t) {
  if (t == null)
    return { defaultName: "clip.wav" };
  if (typeof t != "object")
    throw new Error("Invalid save-audio payload.");
  const e = t, n = e.mode;
  if (n && n !== "copy" && n !== "precise")
    throw new Error("save-audio mode must be either copy or precise.");
  return {
    defaultName: M(e.defaultName, "clip.wav"),
    inputExtension: Z(e.inputExtension),
    mode: n
  };
}
function te(t) {
  if (t == null)
    return { defaultName: "merged.wav" };
  if (typeof t != "object")
    throw new Error("Invalid save-merge payload.");
  return {
    defaultName: M(t.defaultName, "merged.wav")
  };
}
function ne(t, e) {
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
function re() {
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function oe(t) {
  if (t === ".wav")
    return ["-c:a", "pcm_s16le"];
  if (t === ".flac")
    return ["-c:a", "flac"];
  throw new Error("Mixed-format merges must be saved as .wav or .flac.");
}
function ae(t) {
  const e = [], n = [];
  for (let r = 0; r < t; r += 1) {
    const a = `a${r}`;
    e.push(
      `[${r}:a]aresample=48000,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[${a}]`
    ), n.push(`[${a}]`);
  }
  return e.push(
    `${n.join("")}concat=n=${t}:v=0:a=1[outa]`
  ), e.join(";");
}
function ie(t) {
  return t.replace(/'/g, "'\\''");
}
function se(t) {
  return t.map((e) => `file '${ie(e)}'`).join(`
`);
}
function ue(t) {
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
  const r = i.extname(t).toLowerCase().replace(/^\./, "");
  if (r && n.has(r))
    return t;
  const a = (s = e == null ? void 0 : e[0]) == null ? void 0 : s.extensions[0];
  return a ? `${i.extname(t).length > 0 ? t.slice(0, -i.extname(t).length) : t}.${a}` : t;
}
function ce() {
  return new Promise((t) => {
    _("ffmpeg", ["-version"], { windowsHide: !0 }, (e, n) => {
      if (e) {
        t({ available: !1, version: "" });
        return;
      }
      const r = n.split(/\r?\n/, 1)[0] ?? "";
      t({ available: !0, version: r.trim() });
    });
  });
}
function le() {
  f.handle("ffmpeg:check", () => ce()), f.handle("dialog:open-audio", async () => {
    const t = {
      title: "Select Audio File",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: X
        }
      ]
    }, e = m ?? w.getFocusedWindow(), n = e ? await d.showOpenDialog(e, t) : await d.showOpenDialog(t);
    return n.canceled ? { filePaths: [] } : {
      filePaths: n.filePaths.map(
        (r) => i.resolve(r)
      )
    };
  }), f.handle("dialog:save-audio", async (t, e) => {
    const n = ee(e), r = n.defaultName ?? "clip.wav", a = ne(
      n.inputExtension ?? "",
      n.mode
    ), s = {
      title: "Save Cut Audio",
      defaultPath: C(
        r,
        a
      ),
      filters: a
    }, c = m ?? w.getFocusedWindow(), o = c ? await d.showSaveDialog(c, s) : await d.showSaveDialog(s);
    return o.canceled || !o.filePath ? { filePath: void 0 } : { filePath: p(o.filePath) };
  }), f.handle("dialog:save-merge", async (t, e) => {
    const r = te(e).defaultName ?? "merged.wav", a = re(), s = {
      title: "Save Merged Audio",
      defaultPath: C(
        r,
        a
      ),
      filters: a
    }, c = m ?? w.getFocusedWindow(), o = c ? await d.showSaveDialog(c, s) : await d.showSaveDialog(s);
    return o.canceled || !o.filePath ? { filePath: void 0 } : { filePath: p(o.filePath) };
  }), f.handle("audio:cut", async (t, e) => {
    const n = J(e);
    await T(n.inputPath), await N(n.outputPath);
    const r = P(n.inputPath), a = P(n.outputPath);
    if (E.has(r)) {
      if (n.mode !== "precise" && a !== r)
        throw new Error(
          "Output extension must match input for MP3/M4A passthrough cuts."
        );
    } else if (!A.has(a))
      throw new Error("For non-MP3/M4A sources, output must be .wav or .flac.");
    const u = Q(r, a, n.mode), s = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      x(n.startTime),
      "-to",
      x(n.endTime),
      "-i",
      n.inputPath,
      ...u,
      n.outputPath
    ];
    return await b(s), { success: !0, outputPath: n.outputPath };
  }), f.handle("audio:merge", async (t, e) => {
    const n = K(e);
    await N(n.outputPath), await Promise.all(n.filePaths.map((o) => T(o)));
    const r = n.filePaths.map(
      (o) => P(o)
    ), a = r[0], u = P(n.outputPath);
    if (!G.has(u))
      throw new Error("Merge output must use .mp3, .m4a, .wav, or .flac.");
    const s = r.every(
      (o) => o === a
    );
    let c = !1;
    if (s && B.has(a)) {
      const o = await Promise.all(
        n.filePaths.map((l) => k(l))
      );
      c = ue(o);
    }
    if (c) {
      if (u !== a)
        throw new Error(
          "For stream-copy merge, output extension must match source files."
        );
      const o = i.join(
        $(),
        `audioslice-merge-${j()}.txt`
      );
      try {
        await V(
          o,
          se(n.filePaths),
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
          o,
          "-c",
          "copy",
          n.outputPath
        ]);
      } finally {
        await z(o).catch(() => {
        });
      }
    } else {
      if (!A.has(u))
        throw new Error("Mixed-format merges must be saved as .wav or .flac.");
      const o = n.filePaths.flatMap((g) => [
        "-i",
        g
      ]), l = ae(n.filePaths.length), h = oe(u);
      await b([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...o,
        "-filter_complex",
        l,
        "-map",
        "[outa]",
        ...h,
        n.outputPath
      ]);
    }
    return { success: !0, outputPath: n.outputPath };
  });
}
function D() {
  m = new w({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: q,
    webPreferences: {
      preload: i.join(O, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), y ? m.loadURL(y) : m.loadFile(i.join(L, "index.html"));
}
v.on("window-all-closed", () => {
  process.platform !== "darwin" && (v.quit(), m = null);
});
v.on("activate", () => {
  w.getAllWindows().length === 0 && D();
});
v.whenReady().then(() => {
  le(), D();
});
export {
  ve as MAIN_DIST,
  L as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
