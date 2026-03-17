
from moviepy import AudioFileClip, ColorClip
from moviepy.video.fx import MultiplySpeed
import numpy as np

# Create dummy audio clip? No easy way without file.
# Just check if MultiplySpeed works on a dummy ColorClip (which has no audio by default)
# and if it accepts it.
# But for Audio...

# Let's inspect MultiplySpeed class or valid usage
print("MultiplySpeed doc:", MultiplySpeed.__doc__)

# Check if AudioFileClip has with_effects
from moviepy.audio.io.AudioFileClip import AudioFileClip
if hasattr(AudioFileClip, 'with_effects'):
    print("AudioFileClip has with_effects")
