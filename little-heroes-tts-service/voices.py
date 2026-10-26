"""
voices.py
─────────
Centralized pet → Kokoro voice casting table.

This is the single source of truth for "which Kokoro voice speaks for which
companion pet." Previously this mapping was duplicated (and inconsistent)
across server/elevenLabsService.js, server/geminiService.js, and
functions/src/voiceApi.ts, and every one of them collapsed to a single
universal voice regardless of which of the 24 pets was speaking. Centralizing
it here, in the one service that actually talks to Kokoro, is what makes this
"centralized processing" instead of three copies drifting out of sync again.

Voice ids are Kokoro v1.0 American English voicepacks (lang_code 'a'), picked
for an even gender/tone spread across personality archetypes rather than
assigned by the pet's fictional gender. If a pet id isn't listed, or the
casting table references a voice id that isn't present in the installed
`kokoro` package's voice files, callers fall back to DEFAULT_VOICE.
"""
from __future__ import annotations

DEFAULT_VOICE = "af_heart"
LANG_CODE = "a"  # American English

# Pet key -> Kokoro voice id. Grouped by rough personality archetype in
# comments for readability; the mapping itself is flat.
PET_VOICE_MAP: dict[str, str] = {
    # Prehistoric Dino roster (8) -- energetic, young, playful cast
    "rex": "am_puck",        # Rex the T-Rex -- confident, energetic mascot voice
    "raptor": "am_echo",     # Raptor the Velociraptor -- quick, sharp
    "stego": "af_nicole",    # Stego the Stegosaurus -- gentle, steady
    "pterry": "af_sky",      # Pterry the Pterodactyl -- bright, airy
    "chomper": "af_bella",   # Chomper the Compsognathus -- small & spunky
    "brachio": "am_fenrir",  # Brachio the Brachiosaurus -- deep, gentle giant
    "dippy": "am_adam",      # Dippy the Diplodocus -- warm, easygoing
    "spino": "am_onyx",      # Spino the Spinosaurus -- deep, bold

    # Dragons & Mystics (5)
    "sparky": "am_liam",     # Sparky the Dragon -- young, fiery
    "aero": "af_aoede",      # Aero the Griffin -- soaring, noble
    "blaze": "af_kore",      # Blaze the Phoenix -- warm, dramatic
    "luna": "af_heart",      # Luna the Unicorn -- soft, soothing (default voice)
    "kira": "af_nova",       # Kira the Kirin -- bright, wise-beyond-years

    # Aquatic (3)
    "hydra": "am_eric",      # Hydra the Sea Serpent -- deep, mysterious
    "gnasher": "am_michael", # Gnasher the Shark -- bold, confident
    "ollie": "af_river",     # Ollie the Otter -- playful, bubbly

    # Mech (2)
    "boulder": "am_onyx",    # Boulder the Crystal Golem -- deep, steady
    "cosmo": "af_sky",       # Cosmo the Cyber Mech -- bright, synthetic-crisp

    # Beast (6)
    "leo": "am_michael",     # Leo the Lion -- confident, regal
    "stripe": "af_bella",    # Stripe the Tiger -- spunky, sharp
    "fang": "am_fenrir",     # Fang the Wolf -- deep, loyal
    "scout": "af_nicole",    # Scout the Eagle -- clear, alert
    "shadow-sm": "am_echo",  # Shadow the Panther -- quick, sly
    "barnaby": "am_adam",    # Barnaby the Bear -- warm, cuddly
}

# Legacy numeric ids (1-24) map 1:1 onto the keys above in PETS_DATABASE
# order, so numeric-id lookups resolve the same voice as the pet's key.
_NUMERIC_ID_TO_KEY = {
    "1": "rex", "2": "raptor", "3": "stego", "4": "pterry",
    "5": "chomper", "6": "brachio", "7": "dippy", "8": "spino",
    "9": "sparky", "10": "aero", "11": "blaze", "12": "hydra",
    "13": "luna", "14": "kira", "15": "boulder", "16": "cosmo",
    "17": "leo", "18": "stripe", "19": "fang", "20": "scout",
    "21": "gnasher", "22": "shadow-sm", "23": "barnaby", "24": "ollie",
}


def resolve_voice(pet_id: str | None) -> tuple[str, str]:
    """Resolves a client-supplied petId (numeric id or key) to a
    (normalized_pet_key, kokoro_voice_id) pair. Unknown pets fall back to the
    default voice rather than erroring, matching the app's existing
    "never 404 on an unrecognized pet" convention."""
    raw = str(pet_id or "rex").strip().lower()
    key = _NUMERIC_ID_TO_KEY.get(raw, raw)
    return key, PET_VOICE_MAP.get(key, DEFAULT_VOICE)
