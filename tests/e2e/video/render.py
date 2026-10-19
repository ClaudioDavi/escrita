#!/usr/bin/env python3
"""Renders an HD tour recording (RECORD_HD=1) into a finished 1920 x 1080 video.

The recorder leaves <name>.json next to the frames: every screencast frame with its time, and an
event log (captions, zooms, the pointer, section starts). This draws, frame by frame at 30 fps:
eased zooms onto what the tour pointed at, a pointer that glides to each click with a ripple, and the
captions, drawn here so a zoom never crops them. It writes the video (x264), a caption file (.srt)
and the section start times (chapters.txt).

    python3 tests/e2e/video/render.py <folder>/tour-en.json <out.mp4> [--offset SECONDS]

--offset shifts the .srt and the chapter times, for a video that will get an intro in front.
Needs Pillow and an ffmpeg with libx264.
"""
import argparse
import bisect
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
CSS = 1.40625  # device pixels per CSS pixel in the HD layout (1366 x 768); the log's "scale" wins
ZOOM_S = 0.75  # seconds a zoom takes to ease in or out
MAX_ZOOM = 1.8
FONT = "/usr/share/fonts/open-sans/OpenSans-Semibold.ttf"
BRAND = (181, 83, 47)


def ease(p: float) -> float:
    p = min(max(p, 0.0), 1.0)
    return p * p * (3 - 2 * p)


def lerp(a, b, p):
    return a + (b - a) * p


# ------------------------------------------------------------------ zoom
def zoom_target(ev):
    if ev["type"] == "unzoom":
        return (W / 2, H / 2, 1.0)
    x, y, w, h = ev["x"] * CSS, ev["y"] * CSS, ev["w"] * CSS, ev["h"] * CSS
    s = ev.get("scale") or min(MAX_ZOOM, 0.8 * W / max(w, 1), 0.8 * H / max(h, 1))
    s = max(1.0, min(MAX_ZOOM, s))
    return clamp_center(x + w / 2, y + h / 2, s)


def clamp_center(cx, cy, s):
    hw, hh = W / (2 * s), H / (2 * s)
    return (min(max(cx, hw), W - hw), min(max(cy, hh), H - hh), s)


class Zoom:
    def __init__(self, events):
        self.segs = []  # (start, from, to)
        state = (W / 2, H / 2, 1.0)
        for ev in events:
            if ev["type"] not in ("zoom", "unzoom"):
                continue
            to = zoom_target(ev)
            now = self.at(ev["t"]) if self.segs else state
            if self.segs and self.segs[-1][2] == to:
                continue
            self.segs.append((ev["t"], now, to))
        self.starts = [s[0] for s in self.segs]

    def at(self, t):
        i = bisect.bisect_right(self.starts if hasattr(self, "starts") else [s[0] for s in self.segs], t) - 1
        if i < 0:
            return (W / 2, H / 2, 1.0)
        start, a, b = self.segs[i]
        p = ease((t - start) / ZOOM_S)
        # interpolate the visible box (not the scale) so the motion looks straight
        s = 1 / lerp(1 / a[2], 1 / b[2], p)
        return clamp_center(lerp(a[0], b[0], p), lerp(a[1], b[1], p), s)


# ------------------------------------------------------------------ pointer
class Pointer:
    GLIDE = 0.55

    def __init__(self, events):
        self.ev = [e for e in events if e["type"] in ("move", "down")]
        self.ts = [e["t"] for e in self.ev]
        self.downs = [e for e in self.ev if e["type"] == "down"]
        self.down_ts = [e["t"] for e in self.downs]

    def pos(self, e):
        return (e["x"] * CSS, e["y"] * CSS)

    def at(self, t):
        """(x, y, alpha) in frame pixels, or None."""
        if not self.ev:
            return None
        i = bisect.bisect_right(self.ts, t)  # ev[i] is the next event
        prev = self.ev[i - 1] if i > 0 else None
        nxt = self.ev[i] if i < len(self.ev) else None
        start = self.pos(prev) if prev else (W * 0.55, H * 0.62)
        x, y = start
        if nxt:
            gap = nxt["t"] - (prev["t"] if prev else nxt["t"] - 1.0)
            glide = min(self.GLIDE, max(gap, 0.0))
            if glide > 0 and t >= nxt["t"] - glide:
                p = ease((t - (nxt["t"] - glide)) / glide)
                tx, ty = self.pos(nxt)
                x, y = lerp(start[0], tx, p), lerp(start[1], ty, p)
        since = t - prev["t"] if prev else math.inf
        until = nxt["t"] - t if nxt else math.inf
        a_after = 1.0 if since < 2.4 else max(0.0, 1 - (since - 2.4) / 0.4)
        a_before = 1.0 if until < 0.9 else max(0.0, 1 - (until - 0.9) / 0.4)
        a = max(a_after, a_before)
        return (x, y, a) if a > 0 else None

    def ripples(self, t):
        out = []
        i = bisect.bisect_right(self.down_ts, t)
        for e in self.downs[max(0, i - 3):i]:
            age = t - e["t"]
            if 0 <= age < 0.5:
                out.append((*self.pos(e), age / 0.5))
        return out


def arrow_sprite(height=40):
    """A classic arrow pointer, white with a dark outline and a soft shadow; tip at (pad, pad)."""
    k = height / 24
    pts = [(0, 0), (0, 20), (5, 15.5), (8.5, 23), (11.5, 21.7), (8.2, 14.5), (14.5, 14.5)]
    pad = 8
    size = (int(16 * k) + pad * 2, int(25 * k) + pad * 2)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    poly = [(pad + x * k, pad + y * k) for x, y in pts]
    ImageDraw.Draw(shadow).polygon([(x + 2, y + 3) for x, y in poly], fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(shadow)
    d = ImageDraw.Draw(img)
    d.polygon(poly, fill=(255, 255, 255, 255))
    d.line(poly + [poly[0]], fill=(30, 22, 18, 255), width=max(2, int(1.6 * k)), joint="curve")
    return img, pad


# ------------------------------------------------------------------ captions
class Captions:
    def __init__(self, events):
        self.items = []  # (start, end, text, where, size)
        cur = None
        for ev in events:
            if ev["type"] not in ("caption", "uncaption"):
                continue
            if cur:
                self.items.append((cur["t"], ev["t"], cur["text"], cur["where"], cur["size"]))
                cur = None
            if ev["type"] == "caption":
                cur = ev
        if cur:
            self.items.append((cur["t"], math.inf, cur["text"], cur["where"], cur["size"]))
        self.starts = [i[0] for i in self.items]
        self.cache = {}

    def at(self, t):
        i = bisect.bisect_right(self.starts, t) - 1
        if i < 0:
            return None
        item = self.items[i]
        if t >= item[1]:
            return None
        return item

    def sprite(self, text, size):
        key = (text, size)
        if key in self.cache:
            return self.cache[key]
        px = int(size * 1.5 * 1.12)  # in output pixels, the same size whatever the layout
        font = ImageFont.truetype(FONT, px)
        maxw = int(W * 0.8)
        lines, line = [], ""
        for word in text.split():
            trial = (line + " " + word).strip()
            if font.getlength(trial) <= maxw - 2 * px or not line:
                line = trial
            else:
                lines.append(line)
                line = word
        lines.append(line)
        lh = int(px * 1.32)
        tw = int(max(font.getlength(l) for l in lines))
        padx, pady = int(px * 0.85), int(px * 0.5)
        bw, bh = tw + 2 * padx, lh * len(lines) + 2 * pady
        m = 24
        img = Image.new("RGBA", (bw + 2 * m, bh + 2 * m), (0, 0, 0, 0))
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((m, m + 6, m + bw, m + bh + 6), radius=int(px * 0.5), fill=(0, 0, 0, 120))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((m, m, m + bw, m + bh), radius=int(px * 0.5), fill=(32, 22, 16, 236))
        for n, l in enumerate(lines):
            lw = font.getlength(l)
            d.text((m + (bw - lw) / 2, m + pady + n * lh + (lh - px) / 2 - px * 0.12), l, font=font, fill=(253, 246, 234, 255))
        self.cache[key] = (img, m)
        return img, m


def with_alpha(img, a):
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(out.getchannel("A").point(lambda v: int(v * a)))
    return out


# ------------------------------------------------------------------ main
def fmt_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("log")
    ap.add_argument("out")
    ap.add_argument("--offset", type=float, default=0.0)
    args = ap.parse_args()
    global CSS
    log = json.loads(Path(args.log).read_text())
    CSS = log.get("scale", CSS)
    frames = sorted(log["frames"], key=lambda f: f["at"])
    events = sorted(log["events"], key=lambda e: e["t"])
    t0 = frames[0]["at"]
    end = frames[-1]["at"] + 0.5
    at = [f["at"] for f in frames]
    print(f"frames {len(frames)}, {end - t0:.1f} s; events {len(events)}; first event at {events[0]['t'] - t0:+.2f} s", file=sys.stderr)

    zoom, ptr, caps = Zoom(events), Pointer(events), Captions(events)
    arrow, apad = arrow_sprite()

    out = Path(args.out)
    # the caption file and the chapters
    srt = []
    for n, (s, e, text, _, _) in enumerate(caps.items, 1):
        e = min(e, end)
        srt.append(f"{n}\n{fmt_srt(s - t0 + args.offset)} --> {fmt_srt(e - t0 + args.offset)}\n{text}\n")
    out.with_suffix(".srt").write_text("\n".join(srt))
    chapters = [f"{int(e['t'] - t0 + args.offset) // 60}:{int(e['t'] - t0 + args.offset) % 60:02} {e['name']}"
                for e in events if e["type"] == "section"]
    out.with_name(out.stem + "-chapters.txt").write_text("\n".join(chapters) + "\n")

    enc = subprocess.Popen([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
    ], stdin=subprocess.PIPE)

    cached_file, cached_img = None, None
    n_out = int((end - t0) * FPS)
    for n in range(n_out):
        t = t0 + n / FPS
        f = frames[max(0, bisect.bisect_right(at, t) - 1)]
        if f["file"] != cached_file:
            img = Image.open(f["file"]).convert("RGB")
            if img.size != (W, H):
                img = img.resize((W, H), Image.LANCZOS)
            cached_file, cached_img = f["file"], img
        cx, cy, s = zoom.at(t)
        if s > 1.001:
            hw, hh = W / (2 * s), H / (2 * s)
            frame = cached_img.resize((W, H), Image.BICUBIC, box=(cx - hw, cy - hh, cx + hw, cy + hh))
        else:
            frame = cached_img.copy()
        frame = frame.convert("RGBA")
        to_screen = lambda x, y: ((x - (cx - W / (2 * s))) * s, (y - (cy - H / (2 * s))) * s)

        # click ripples, then the pointer
        if ptr.ripples(t):
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            for x, y, p in ptr.ripples(t):
                sx, sy = to_screen(x, y)
                r = lerp(12, 54, ease(p))
                a = int(170 * (1 - p))
                d.ellipse((sx - r, sy - r, sx + r, sy + r), outline=(*BRAND, a), width=5)
                d.ellipse((sx - r * 0.5, sy - r * 0.5, sx + r * 0.5, sy + r * 0.5), fill=(*BRAND, a // 3))
            frame.alpha_composite(layer)
        p = ptr.at(t)
        if p:
            sx, sy = to_screen(p[0], p[1])
            spr = with_alpha(arrow, p[2])
            frame.alpha_composite(spr, (int(sx - apad), int(sy - apad))) if 0 <= sx < W and 0 <= sy < H else None

        # the caption, faded in and out
        c = caps.at(t)
        if c:
            start, stop, text, where, size = c
            a = min(1.0, (t - start) / 0.2, (stop - t) / 0.2 if stop != math.inf else 1.0)
            spr, m = caps.sprite(text, size)
            x = (W - spr.width) // 2
            y = {"top": 40 - m, "center": (H - spr.height) // 2}.get(where, H - 70 - spr.height + m)
            frame.alpha_composite(with_alpha(spr, max(0.0, a)), (x, max(0, y)))

        enc.stdin.write(frame.convert("RGB").tobytes())
        if n % (FPS * 30) == 0:
            print(f"  {n / FPS:5.0f} s / {n_out / FPS:.0f} s", file=sys.stderr)
    enc.stdin.close()
    enc.wait()
    print(f"wrote {out}, {out.with_suffix('.srt').name}, {out.stem}-chapters.txt", file=sys.stderr)


if __name__ == "__main__":
    main()
