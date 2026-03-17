
import moviepy.audio.fx as afx
import moviepy.video.fx as vfx

print("--- AUDIO FX ---")
for x in dir(afx):
    if not x.startswith("_"): print(x)
    
print("\n--- VIDEO FX ---")
for x in dir(vfx):
    if not x.startswith("_"): print(x)
