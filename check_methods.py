
from moviepy import ColorClip
print("Methods of ColorClip:", dir(ColorClip))
clip = ColorClip(size=(100,100), color=(255,0,0), duration=5)
if hasattr(clip, 'resize'):
    print("clip.resize exists")
else:
    print("clip.resize MISSING")
    
if hasattr(clip, 'crop'):
    print("clip.crop exists")
else:
    print("clip.crop MISSING")
    
if hasattr(clip, 'with_effects'):
    print("clip.with_effects exists")
