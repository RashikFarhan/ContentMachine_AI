import sys
import os
import shutil
import subprocess
import imageio_ffmpeg
from PIL import Image

if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import AudioFileClip

def change_speed(file_path, speed_factor):
    print(f"Checking speed for: {file_path}")
    print(f"Target speed factor: {speed_factor}x")
    
    if not os.path.exists(file_path):
        print(f"Error: File not found {file_path}")
        sys.exit(1)

    # Convert strictly to float
    try:
        speed_factor = float(speed_factor)
    except ValueError:
        print("Error: speed_factor must be a number")
        sys.exit(1)

    # Don't do unnecessary processing if speech is practically 1x
    if abs(speed_factor - 1.0) < 0.01:
        print("Speed is essentially 1x. No change.")
        return

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        ext = os.path.splitext(file_path)[1]
        temp_path = file_path + ".temp" + ext
        
        atempo = speed_factor
        filters = []
        while atempo > 2.0:
            filters.append("atempo=2.0")
            atempo /= 2.0
        while atempo < 0.5:
            filters.append("atempo=0.5")
            atempo /= 0.5
        filters.append(f"atempo={atempo}")
        
        filter_str = ",".join(filters)
        
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", file_path,
            "-filter:a", filter_str
        ]
        if ext.lower() == '.mp3':
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100", "-write_xing", "0"])
        cmd.append(temp_path)
        
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Replace original file
        if os.path.exists(file_path):
            os.remove(file_path)
        shutil.move(temp_path, file_path)
        print(f"Success: Audio speed adjusted and saved to {file_path}")
        
    except Exception as e:
        print(f"Critical Error changing speed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python change_speed.py <file_path> <speed_factor>")
        sys.exit(1)
        
    path = sys.argv[1]
    factor = sys.argv[2]
        
    change_speed(path, factor)
