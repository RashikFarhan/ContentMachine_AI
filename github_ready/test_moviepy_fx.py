
try:
    from moviepy import VideoFileClip
    print("MoviePy imported")
    
    try:
        from moviepy.audio.fx.all import speedx
        print("Found moviepy.audio.fx.all.speedx")
    except ImportError:
        print("Not found moviepy.audio.fx.all.speedx")
        
    try:
        from moviepy.video.fx.all import loop
        print("Found moviepy.video.fx.all.loop")
    except ImportError:
        print("Not found moviepy.video.fx.all.loop")

except ImportError as e:
    print(f"Import Error: {e}")
