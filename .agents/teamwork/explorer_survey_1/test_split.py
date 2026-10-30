import re

test_cases = [
    'Once upon a time. Rex walked slowly! Did you see that? Yes.',
    'Rex whispered, "Look at that." The stars shone. "Are you ready?" asked Rex.',
    'Line one without punctuation\nLine two with period.\nLine three.',
    'Paragraph 1 is here.\n\nParagraph 2 is here!',
    'A full bedtime chapter: In the quiet whispering woods, Luna walked gently. The starlight danced upon the crystal leaves. Every little creature curled up in their mossy bed. "Sleep tight," Luna whispered softly. Tomorrow brings another grand adventure.'
]

pattern = r"(?<=[.!?])\s+|(?<=[.!?][\"'])\s+|\n+"

for idx, text in enumerate(test_cases):
    print(f"\n--- Test Case {idx + 1} ---")
    chunks = [c.strip() for c in re.split(pattern, text) if c and c.strip()]
    for i, c in enumerate(chunks):
        print(f"  [{i}]: {c}")
