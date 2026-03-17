
try:
    from moviepy import VideoFileClip, AudioFileClip, ImageClip, ColorClip, concatenate_videoclips
    print("Imports Successful from top level")
except ImportError as e:
    print(f"Import Error: {e}")
    try:
        from moviepy.editor import *
        print("Imports Successful from moviepy.editor")
    except ImportError as e2:
        print(f"Import Error 2: {e2}")
