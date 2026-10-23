# Place each VO line so its onset lands on a beat; write audio/vo.wav + vo.json (line timing for supers).
#   uv run --with numpy --with soundfile python audio/place_vo.py
import json, numpy as np, soundfile as sf, pathlib
A = pathlib.Path(__file__).parent
grid = json.loads((A.parent / 'beats.json').read_text())
dur = json.loads((A.parent / 'film.json').read_text())['duration']
SR = 48000
AT = [0.5, 8, 16, 30, 44, 57, 68]           # onset beat of each line
out = np.zeros(int(dur * SR) + SR, dtype=np.float32)
lines = []
for i, b in enumerate(AT, 1):
    x, sr = sf.read(A / 'vo' / f'l{i}.wav', dtype='float32')
    assert sr == SR
    if x.ndim > 1: x = x.mean(1)
    x = x / (np.abs(x).max() + 1e-9) * 0.7
    t0 = grid['offset'] + b * grid['period']
    s = int(t0 * SR); out[s:s + len(x)] += x
    lines.append({'line': i, 'beat': b, 't0': round(t0, 3), 't1': round(t0 + len(x) / SR, 3),
                  'beat_end': round(b + len(x) / SR / grid['period'], 2)})
for a, c in zip(lines, lines[1:]):
    gap = c['t0'] - a['t1']
    print(f"line {a['line']} -> {c['line']}: gap {gap:.2f}s" + ('  OVERLAP' if gap < 0.15 else ''))
print(f"last line ends {lines[-1]['t1']:.2f}s of {dur}s")
sf.write(A / 'vo.wav', out[:int(dur * SR)], SR)
(A.parent / 'vo.json').write_text(json.dumps(lines, indent=1))
