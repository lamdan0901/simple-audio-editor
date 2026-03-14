import { app as i, BrowserWindow as r, ipcMain as f } from "electron";
import { fileURLToPath as m } from "node:url";
import e from "node:path";
import { execFile as R } from "node:child_process";
const s = e.dirname(m(import.meta.url));
process.env.APP_ROOT = e.join(s, "..");
const o = process.env.VITE_DEV_SERVER_URL, u = e.join(process.env.APP_ROOT, "dist-electron"), c = e.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = o ? e.join(process.env.APP_ROOT, "public") : c;
let n;
function _() {
  return new Promise((t) => {
    R("ffmpeg", ["-version"], { windowsHide: !0 }, (a, p) => {
      if (a) {
        t({ available: !1, version: "" });
        return;
      }
      const d = p.split(/\r?\n/, 1)[0] ?? "";
      t({ available: !0, version: d.trim() });
    });
  });
}
function w() {
  f.handle("ffmpeg:check", () => _());
}
function l() {
  n = new r({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: e.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: e.join(s, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), o ? n.loadURL(o) : n.loadFile(e.join(c, "index.html"));
}
i.on("window-all-closed", () => {
  process.platform !== "darwin" && (i.quit(), n = null);
});
i.on("activate", () => {
  r.getAllWindows().length === 0 && l();
});
i.whenReady().then(() => {
  w(), l();
});
export {
  u as MAIN_DIST,
  c as RENDERER_DIST,
  o as VITE_DEV_SERVER_URL
};
