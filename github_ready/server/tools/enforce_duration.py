import sys
import os
import shutil
import subprocess
import imageio_ffmpeg
from PIL import Image

if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import AudioFileClip

def enforce_duration(file_path, max_duration):
    print(f"Checking duration for: {file_path}")
    print(f"Max duration limit: {max_duration}s")
    
    if not os.path.exists(file_path):
        print(f"Error: File not found {file_path}")
        sys.exit(1)

    try:
        audio = AudioFileClip(file_path)
        original_duration = audio.duration
        audio.close()
        
        # Checking with a small epsilon
        if original_duration <= max_duration + 0.1:
            print(f"Duration {original_duration:.2f}s is within limit. No change.")
            return

        # Calculate speed factor
        # Add slight buffer (1.01) to ensure we are safely under
        factor = (original_duration / max_duration) * 1.01
        new_duration = original_duration / factor
        
        print(f"Over limit ({original_duration:.2f}s). Speeding up by {factor:.2f}x to ~{new_duration:.2f}s")
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        ext = os.path.splitext(file_path)[1]
        temp_path = file_path + ".temp" + ext
        
        # atempo can only do 0.5 to 2.0 at a time, chaining is needed
        atempo = factor
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
            "-filter:a", filter_str,
            temp_path
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Replace original
        if os.path.exists(file_path):
            os.remove(file_path)
        shutil.move(temp_path, file_path)
        print(f"Success: Audio adjusted and saved to {file_path}")
        
    except Exception as e:
        print(f"Critical Error enforcing duration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python enforce_duration.py <file_path> <max_duration_seconds>")
        sys.exit(1)
        
    path = sys.argv[1]
    try:
        max_dur = float(sys.argv[2])
    except ValueError:
        print("Error: max_duration must be a number")
        sys.exit(1)
        
    enforce_duration(path, max_dur)
