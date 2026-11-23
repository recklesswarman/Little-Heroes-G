# Checks scripts/pi/voice-extras/voice_extras.py word timings with stub models (no downloads).
import base64, json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, "voice_extras_stubs"))
sys.path.insert(0, os.path.join(here, "..", "..", "scripts", "pi", "voice-extras"))
import voice_extras as v

out = v.read_story("River found a star. It glowed softly!", "af_heart", 0.9)
words = out["words"]
assert [w[0] for w in words] == ["River", "found", "a", "star", "It", "glowed", "softly"], words
assert all(a[1] <= b[1] for a, b in zip(words, words[1:])), "in order"
assert all(w[2] > w[1] for w in words)
assert words[4][1] > words[3][2], "second sentence starts after the first ends"
assert abs(out["duration"] - (19 * 0.1 + 0.25 + 17 * 0.1 + 0.25)) < 0.05, out["duration"]
assert base64.b64decode(out["wav"]).startswith(b"RIFF")
assert v.split_sentences("One. Two! Three?") == ["One.", "Two!", "Three?"]
assert v.VOICE_RE.match("af_heart") and not v.VOICE_RE.match("../x")
print(json.dumps({"ok": True, "words": len(words)}))
