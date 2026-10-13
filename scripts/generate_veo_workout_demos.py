"""
scripts/generate_veo_workout_demos.py

Uses the official Google GenAI SDK (google-genai) and Veo / Gemini Omni Flash
model to generate high quality, instructional video demo clips for the 8 Dino
Hero Workouts in Little Hero Adventures.

Output directory: public/assets/workouts/
Each clip is formatted for 16:9 or 1:1 kid-friendly fitness demonstrations.

Usage:
    python scripts/generate_veo_workout_demos.py [--model veo-2.0-generate-001 | gemini-omni-1.1-flash] [--api-key YOUR_KEY]
"""

import os
import sys
import argparse
import time
from pathlib import Path

# Workout specification matching src/data/petsData.js
DINO_WORKOUT_SPECS = [
    {
        "id": "trex_run",
        "coach_name": "Rex",
        "title": "T-Rex Run: Knee-Lifter Stomp",
        "avatar_path": "public/assets/pets/rex.png",
        "output_file": "trex_run_demo.mp4",
        "prompt": (
            "A friendly, vibrant 3D stylized cartoon green Tyrannosaurus Rex digital toy creature "
            "coaching young kids through a fun physical exercise routine in a bright prehistoric fitness playground. "
            "The T-Rex has short playful arms tucked into its chest (elbows in armpits) and is happily stomping its feet "
            "in place, lifting its knees high with powerful rhythmic stomps. Colorful dust sparkles puff from each high knee stomp. "
            "Smooth looping character animation, bright friendly lighting, saturated green and solar gold palette, Pixar/DreamWorks toy aesthetic, 4k ultra clean."
        )
    },
    {
        "id": "velociraptor_run",
        "coach_name": "Raptor",
        "title": "Velociraptor Run: Lightning Sprint",
        "avatar_path": "public/assets/pets/raptor.png",
        "output_file": "velociraptor_run_demo.mp4",
        "prompt": (
            "A cheerful, sleek 3D stylized cartoon crimson red Velociraptor digital toy creature "
            "coaching kids through a lightning speed sprint exercise. The velociraptor is sprinting rapidly in place "
            "on the balls of its feet with quick rhythmic footsteps and energetic pumping arms. Electric cyan wind trails "
            "and golden spark trails swirl behind its feet. Energetic, encouraging, looping motion, vibrant clean 3D toy render."
        )
    },
    {
        "id": "stegosaurus_walks",
        "coach_name": "Stego",
        "title": "Stegosaurus Walks: Four-Foot Stomp",
        "avatar_path": "public/assets/pets/stego.png",
        "output_file": "stegosaurus_walks_demo.mp4",
        "prompt": (
            "A cute, friendly 3D stylized cartoon golden-amber Stegosaurus digital toy creature with bright glowing back plates. "
            "Stego is demonstrating a bear crawl exercise pose: hands and feet on the gym floor, hips raised high, stomping forward "
            "and backward with heavy, bouncy, playful four-footed stomps. Encouraging smile, bright kid-friendly animation, vibrant preschool fitness style."
        )
    },
    {
        "id": "pterodactyl_takeoff",
        "coach_name": "Pterry",
        "title": "Pterodactyl Take Off: Sky Launcher",
        "avatar_path": "public/assets/pets/pterry.png",
        "output_file": "pterodactyl_takeoff_demo.mp4",
        "prompt": (
            "A lovable 3D stylized cartoon cyan Pterodactyl creature wearing heroic wristbands, flapping wide wings in big graceful circles "
            "and performing joyful explosive vertical hops into the air. Golden star sparkles radiate from every takeoff jump. "
            "Continuous enthusiastic jumping and wing-circling motion, bright playful prehistoric gym background, 3D animated toy style."
        )
    },
    {
        "id": "compsognathus_prance",
        "coach_name": "Chomper",
        "title": "Compsognathus Prance: Beat Prance",
        "avatar_path": "public/assets/pets/chomper.png",
        "output_file": "compsognathus_prance_demo.mp4",
        "prompt": (
            "A tiny, energetic 3D stylized cartoon emerald-teal Compsognathus dino toy with big expressive joyful eyes. "
            "Chomper is prancing rhythmically side to side, jumping to the left and crossing its back leg behind, then hopping to the right "
            "in a skater prance dance to the beat. Colorful musical notes bounce along the floor. Fun, bouncy, dance-fitness animation."
        )
    },
    {
        "id": "brachiosaurus_stretch",
        "coach_name": "Brachio",
        "title": "Brachiosaurus Stretch: Star Reach",
        "avatar_path": "public/assets/pets/brachio.png",
        "output_file": "brachiosaurus_stretch_demo.mp4",
        "prompt": (
            "A majestic and friendly 3D cartoon gentle giant Brachiosaurus toy creature with a gentle smile. "
            "Brachio stands tall, rises onto its tiptoes, and stretches both arms and long graceful neck high toward glowing starlight "
            "at the ceiling, reaching as tall as possible with elongated posture. Calming yet empowering stretch demonstration, soft golden sunbeams."
        )
    },
    {
        "id": "diplodocus",
        "coach_name": "Dippy",
        "title": "The Diplodocus: Bird-Dog Balance",
        "avatar_path": "public/assets/pets/dippy.png",
        "output_file": "diplodocus_demo.mp4",
        "prompt": (
            "A friendly 3D stylized orange Diplodocus toy companion kneeling on hands and knees on a soft gym mat. "
            "Dippy extends its right arm straight forward and left leg straight backward in a perfect, stable bird-dog balance pose, "
            "holding balance with playful focus and a proud smile, then smoothly switching opposite limbs. Core balance workout for kids."
        )
    },
    {
        "id": "spinosaurus_stretch",
        "coach_name": "Spino",
        "title": "Spinosaurus Stretch: Sail Fin Arch",
        "avatar_path": "public/assets/pets/spino.png",
        "output_file": "spinosaurus_stretch_demo.mp4",
        "prompt": (
            "A gentle 3D cartoon crimson Spinosaurus toy companion on hands and knees demonstrating a calm cat-cow stretch. "
            "Spino draws its belly upward, rounding its spine gracefully toward the sky so its colorful sail-fin forms a high arch, "
            "taking deep calm breathing breaths with glowing serene aura. Relaxing cool-down movement, kid-friendly yoga posture."
        )
    }
]


def generate_demos(api_key: str = None, model: str = "veo-2.0-generate-001"):
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        print("[!] No GEMINI_API_KEY provided or detected.")
        print("    To run Veo / Gemini video generation, please set GEMINI_API_KEY or supply --api-key.")
        print("    Example: python scripts/generate_veo_workout_demos.py --api-key AIzaSy...")
        print("    The application will continue to use the high-fidelity procedural canvas kinematic engine in the meantime.")
        return False

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("[!] google-genai Python SDK is not installed. Run: pip install -U google-genai")
        return False

    client = genai.Client(api_key=key)
    output_dir = Path("public/assets/workouts")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Starting Veo / Video generation for {len(DINO_WORKOUT_SPECS)} Dino Workouts...")
    print(f"[*] Model: {model} | Output Directory: {output_dir.resolve()}")

    for i, spec in enumerate(DINO_WORKOUT_SPECS, 1):
        target_path = output_dir / spec["output_file"]
        print(f"\n--- [{i}/{len(DINO_WORKOUT_SPECS)}] Generating Demo for {spec['coach_name']}: {spec['title']} ---")
        print(f"Target: {target_path}")

        if target_path.exists() and target_path.stat().st_size > 10000:
            print(f"[✓] {spec['output_file']} already exists ({target_path.stat().st_size} bytes). Skipping.")
            continue

        try:
            # Check if reference avatar image exists
            ref_path = Path(spec["avatar_path"])
            uploaded_ref = None
            if ref_path.exists():
                print(f"[*] Uploading reference character avatar: {ref_path}")
                try:
                    uploaded_ref = client.files.upload(file=str(ref_path))
                    print(f"[✓] Uploaded character reference: {uploaded_ref.name}")
                except Exception as upload_err:
                    print(f"[!] Reference upload notice: {upload_err}")

            print(f"[*] Calling video generation API (this can take 60-180 seconds)...")
            
            # Veo 2 / Gemini Omni video request
            if "veo" in model.lower():
                operation = client.models.generate_videos(
                    model=model,
                    prompt=spec["prompt"],
                    config=types.GenerateVideosConfig(
                        aspect_ratio="16:9",
                        duration_seconds=5,
                        number_of_videos=1,
                    )
                )
                print(f"[*] Polling video operation: {operation.name}...")
                while not operation.done:
                    time.sleep(10)
                    operation = client.operations.get(operation)
                    print(".", end="", flush=True)
                print("\n[✓] Operation finished!")
                
                generated_videos = operation.result.generated_videos
                if generated_videos and len(generated_videos) > 0:
                    video_bytes = client.files.download(file=generated_videos[0].video.uri)
                    with open(target_path, "wb") as f:
                        f.write(video_bytes)
                    print(f"[✓] Saved {target_path} ({len(video_bytes)} bytes)")
            else:
                # Gemini Omni Flash fallback via interactions / generateContent
                print(f"[*] Attempting generation with {model}...")
                interaction = client.interactions.create(
                    model=model,
                    input=spec["prompt"]
                )
                if hasattr(interaction, "output_video") and interaction.output_video:
                    with open(target_path, "wb") as f:
                        f.write(interaction.output_video.data)
                    print(f"[✓] Saved {target_path}")

        except Exception as e:
            print(f"[!] Error generating video for {spec['id']}: {e}")
            print(f"    (The app will automatically fall back to the live interactive 3D kinematic engine)")

    print("\n[✓] Video generation process completed.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate 8 Dino Hero Workout Video Demos using Veo")
    parser.add_argument("--api-key", default=None, help="Google Gemini / Veo API Key")
    parser.add_argument("--model", default="veo-2.0-generate-001", help="Model name (e.g., veo-2.0-generate-001 or gemini-omni-1.1-flash)")
    args = parser.parse_args()

    generate_demos(api_key=args.api_key, model=args.model)
