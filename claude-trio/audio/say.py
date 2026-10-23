# Thai VO, offline: espeak-ng (PyPI espeakng-loader). One wav per line of the script.
#   uv run --with espeakng-loader python audio/say.py audio/vo_script.txt audio/vo [rate]
import ctypes, sys, wave, pathlib, espeakng_loader as e
lib = ctypes.CDLL(e.get_library_path())
CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
buf = bytearray()
def cb(wav, n, ev):
    if n > 0: buf.extend(ctypes.string_at(wav, n * 2))
    return 0
cbf = CB(cb)
sr = lib.espeak_Initialize(2, 0, e.get_data_path().encode(), 0)
lib.espeak_SetSynthCallback(cbf)
lib.espeak_SetVoiceByName(b"th")
lib.espeak_SetParameter(1, int(sys.argv[3]) if len(sys.argv) > 3 else 175, 0)  # words/min
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
lines = [l.strip() for l in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines() if l.strip()]
for i, line in enumerate(lines, 1):
    buf.clear()
    t = line.encode("utf-8")
    lib.espeak_Synth(t, len(t) + 1, 0, 0, 0, 0x01, None, None)
    lib.espeak_Synchronize()
    with wave.open(str(out / f"raw{i}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(bytes(buf))
print(len(lines), "lines")
