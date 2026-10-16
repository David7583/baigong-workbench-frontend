"""Generate Chinese narration from public product copy; no user data is sent.
Inputs: narration.json. Outputs: assets/voice_XX.mp3. Optional rebuild step.
Requires edge-tts; uses Microsoft's online speech service, not a cloned voice.
"""
from pathlib import Path
import asyncio, json, os, sys

ROOT = Path(__file__).resolve().parents[1]
deps = ROOT / '.build/voice-deps'
if deps.exists(): sys.path.insert(0, str(deps))
import edge_tts

async def main():
    for i, cue in enumerate(json.loads((ROOT/'source/narration.json').read_text('utf-8'))):
        target = ROOT/'assets'/f'voice_{i:02}.mp3'
        if target.exists(): continue
        voice = edge_tts.Communicate(cue['text'], 'zh-CN-XiaoxiaoNeural', rate='+8%', proxy=os.environ.get('VIDEO_TTS_PROXY'))
        await voice.save(str(target))
        print(f'Voice {i+1} saved', flush=True)

if __name__ == '__main__': asyncio.run(main())
