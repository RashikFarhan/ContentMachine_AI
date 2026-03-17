import json
import os
import sys
import random
import numpy as np
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageOps

# Strict MoviePy 1.x imports
from moviepy.editor import VideoFileClip, AudioFileClip, ImageClip, ColorClip, concatenate_videoclips, CompositeVideoClip
import moviepy.video.fx.all as vfx
from proglog import ProgressBarLogger

class CustomVideoLogger(ProgressBarLogger):
    def __init__(self):
        super().__init__()
        self.last_perc = -1

    def bars_callback(self, bar, attr, value, old_value=None):
        total = self.bars[bar]['total']
        if total:
            perc = int((value / total) * 100)
            if perc != self.last_perc and perc % 2 == 0: # Print every 2% to avoid flooding
                # Print clean, flushable line out
                print(f"[PROGRESS] {perc}%", flush=True)
                self.last_perc = perc

    # Disable the default carriage-return spam that breaks node stdout
    def print_callback(self, *args, **kwargs):
        pass


# Monkey patch for Pillow 10+ incompatibility with MoviePy 1.x
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.LANCZOS

# Screen Settings
SCREEN_SIZE = (1080, 1920)
SAFE_MARGIN = 60 # pixels from edges
SUBTITLE_Y_POS = 1450 # Approx 75% down

class VideoBuilder:
    def __init__(self, job_config):
        self.config = job_config
        self.job_id = job_config.get('job_id')
        self.script = job_config.get('script', '')
        self.keywords = job_config.get('keywords', [])
        self.media_map = job_config.get('media_map', {}) 
        self.audio_path = job_config.get('audio_path')
        self.output_path = job_config.get('output_file', 'output.mp4')
        self.settings = job_config.get('settings', {})
        self.assembly_api_key = job_config.get('assembly_api_key')
        self.job_dir = job_config.get('job_dir', os.path.dirname(self.audio_path))
        self.media_source = job_config.get('media_source', 'pexels')
        
        # Determine fallback pool
        self.fallback_pool = []
        for paths in self.media_map.values():
            for p in paths:
                if os.path.exists(p):
                    self.fallback_pool.append(p)
        self.fallback_pool = list(set(self.fallback_pool))
        self.used_file_counts = {}

        if not self.assembly_api_key:
            print("WARNING: No AssemblyAI API Key provided. Timeline will be inaccurate.")

    def run(self):
        print(f">>> STARTING SIMPLIFIED VIDEO BUILDER (Job: {self.job_id})")
        try:
            # 1. Validate Assets
            self.validate_assets()
            
            # 2. Transcribe (Audio is ALREADY Duration-Capped by TTS Manager)
            transcript_words = self.get_transcription_timestamps()
            
            # 3. Build Timeline
            timeline = self.build_timeline(transcript_words)
            
            # 4. Generate Visual Clips
            visual_clips = self.generate_clips(timeline)
            
            # 5. Render Base Video & Burn Perfect Subtitles via FFmpeg
            self.render(visual_clips, transcript_words)
            
        except Exception as e:
            print(f"!!! CRITICAL FAIL: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def validate_assets(self):
        print("... Validating Media Assets")
        if not os.path.exists(self.audio_path):
            raise FileNotFoundError(f"Audio file missing: {self.audio_path}")
            
        # FIX MOVIEPY MP3 DESYNC: Convert to WAV to guarantee frame-perfect timestamps
        if self.audio_path.lower().endswith('.mp3'):
            wav_path = self.audio_path.rsplit('.', 1)[0] + ".wav"
            if not os.path.exists(wav_path):
                print("... Converting Audio to WAV to prevent sync drift")
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                subprocess.run(
                    [ffmpeg_exe, "-y", "-i", self.audio_path, "-ar", "44100", "-ac", "2", wav_path],
                    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
            self.audio_path = wav_path
            
        if not self.fallback_pool:
            raise RuntimeError("NO MEDIA FILES FOUND.")
            
    def get_transcription_timestamps(self):
        if not self.assembly_api_key:
            return self.fallback_timestamps()

        print("... AssemblyAI: Transcribing")
        try:
            import requests
            import time
            headers = {'authorization': self.assembly_api_key}
            
            # Upload
            with open(self.audio_path, 'rb') as f:
                response = requests.post("https://api.assemblyai.com/v2/upload", headers=headers, data=f)
            response.raise_for_status()
            audio_url = response.json()['upload_url']

            # Transcribe
            response = requests.post("https://api.assemblyai.com/v2/transcript", headers=headers, json={"audio_url": audio_url, "speech_models": ["universal-2"], "language_code": "en"})
            response.raise_for_status()
            tx_id = response.json()['id']

            # Poll
            while True:
                res = requests.get(f"https://api.assemblyai.com/v2/transcript/{tx_id}", headers=headers).json()
                if res['status'] == 'completed':
                    words = res.get('words', [])
                    # Return exact mathematical timestamps directly from Assembly AI without any manual manipulation
                    return [{'text':w['text'], 'start':(w['start']/1000.0), 'end':(w['end']/1000.0)} for w in words]
                elif res['status'] == 'error':
                    return self.fallback_timestamps()
                time.sleep(1)
        except Exception as e:
            print(f"Transcription failed: {e}")
            return self.fallback_timestamps()

    def fallback_timestamps(self):
        print("-> Using Fallback Timestamps")
        try:
            audio = AudioFileClip(self.audio_path)
            duration = audio.duration
            audio.close()
        except:
            duration = 60.0
        words = self.script.split()
        if not words: return []
        avg = duration / len(words)
        return [{'text':w, 'start':i*avg, 'end':(i+1)*avg} for i,w in enumerate(words)]

    def build_timeline(self, words):
        print(f"... Building Timeline [Source: {self.media_source}]")
        try:
            audio = AudioFileClip(self.audio_path)
            total_duration = audio.duration
            audio.close()
        except:
            total_duration = 60.0

        current_keyword = None
        if self.keywords:
            first_kw = self.keywords[0]
            current_keyword = first_kw.get('keyword', first_kw) if isinstance(first_kw, dict) else first_kw

        # If using google AI images, we stretch fewer images evenly across the entire duration instead of fast triggering.
        if self.media_source == 'google_genai':
            print("--> Using GenAI Timeline Mode (Long, Even Segments)")
            num_keys = len(self.keywords) if self.keywords else 1
            if num_keys == 0:
                return [{'start': 0.0, 'end': total_duration, 'keyword': None}]
            
            segment_dur = total_duration / num_keys
            segments = []
            for i, kw_obj in enumerate(self.keywords):
                vis_kw = kw_obj.get('keyword', kw_obj) if isinstance(kw_obj, dict) else kw_obj
                segments.append({
                    'start': i * segment_dur,
                    'end': (i + 1) * segment_dur,
                    'keyword': str(vis_kw)
                })
            # Force the last segment to exactly capture the remaining edge
            segments[-1]['end'] = total_duration
            return segments

        import re
        segments = []
        last_switch = 0.0

        full_text = ""
        word_mapping = []
        if words:
            for i, w in enumerate(words):
                start_idx = len(full_text)
                w_text = w['text'].lower()
                full_text += w_text + " "
                end_idx = len(full_text) - 1 # Exclude the trailing space added above
                word_mapping.append({'idx': i, 'start': start_idx, 'end': end_idx, 'time': w['start']})
                
        # Create a punctuation-free version of the text, keeping the exact same string length
        full_text_clean = "".join(c if c.isalnum() else " " for c in full_text)
        
        switch_points = []
        if words:
            for kw_obj in self.keywords:
                if isinstance(kw_obj, dict):
                    triggers = kw_obj.get('trigger', [])
                    vis_kw = kw_obj.get('keyword', '')
                    if isinstance(triggers, str):
                        triggers = [triggers]
                    elif not isinstance(triggers, list):
                        triggers = [str(triggers)]
                else:
                    triggers = [str(kw_obj)]
                    vis_kw = str(kw_obj)
                    
                for t in triggers:
                    t_clean = t.lower().strip()
                    t_safe = "".join(c if c.isalnum() else " " for c in t_clean)
                    t_safe = " ".join(t_safe.split()) # Collapse multi-spaces explicitly
                    if not t_safe: continue
                    
                    # Pattern strictly binds to word boundaries
                    pattern = r'\b' + t_safe.replace(' ', r'\s+') + r'\b'
                    for match in re.finditer(pattern, full_text_clean):
                        idx = match.start()
                        
                        mapped_time = None
                        for m in word_mapping:
                            if m['start'] <= idx <= m['end'] or abs(m['start'] - idx) <= 3:
                                mapped_time = m['time']
                                break
                        
                        if mapped_time is not None:
                            switch_points.append({'time': mapped_time, 'keyword': vis_kw})

        switch_points.sort(key=lambda x: x['time'])

        last_time = 0.0
        for pt in switch_points:
            # Add a new segment if sufficient time has passed (to avoid micro-segments)
            if pt['time'] > last_time + 0.1:
                segments.append({'start': last_time, 'end': pt['time'], 'keyword': current_keyword})
                current_keyword = pt['keyword']
                last_time = pt['time']
            # If a trigger happens simultaneously but is a different keyword, overwrite
            elif pt['time'] <= last_time + 0.1 and pt['keyword'] != current_keyword:
                current_keyword = pt['keyword']
                if segments: 
                    segments[-1]['keyword'] = current_keyword

        # Final segment
        segments.append({'start': last_time, 'end': total_duration, 'keyword': current_keyword})

        merged_segments = []
        for seg in segments:
            dur = seg['end'] - seg['start']
            if dur < 0.1:
                continue
            merged_segments.append(seg)
                
        # Split long segments into chunks using different media
        split_segments = []
        for seg in merged_segments:
            start = seg['start']
            end = seg['end']
            kw = seg['keyword']
            dur = end - start
            
            if self.media_source == 'local':
                # Split evenly if multiple local media files are provided for one keyword trigger
                cands = self.media_map.get(kw, [])
                num_cands = len(cands)
                if num_cands > 1:
                    chunk_dur = dur / num_cands
                    for i in range(num_cands):
                        split_segments.append({'start': start + (i*chunk_dur), 'end': start + ((i+1)*chunk_dur), 'keyword': kw})
                else:
                    split_segments.append({'start': start, 'end': end, 'keyword': kw})
            else:
                split_segments.append({'start': start, 'end': end, 'keyword': kw})

        # Produce final timeline
        final_timeline = []
        for seg in split_segments:
            dur = seg['end'] - seg['start']
            media = self.pick_media(seg['keyword'])
            final_timeline.append({
                'start': seg['start'],
                'end': seg['end'],
                'duration': dur,
                'media_path': media
            })

        if not final_timeline:
            media_path = self.pick_media(None)
            final_timeline.append({'start': 0, 'end': total_duration, 'duration': total_duration, 'media_path': media_path})
        else:
            # Ensure timeline exactly maps to total_duration
            final_timeline[0]['start'] = 0.0
            for i in range(1, len(final_timeline)):
                final_timeline[i]['start'] = final_timeline[i-1]['end']
                final_timeline[i]['duration'] = final_timeline[i]['end'] - final_timeline[i]['start']
            
            final_timeline[-1]['end'] = max(total_duration, final_timeline[-1]['end'])
            final_timeline[-1]['duration'] = final_timeline[-1]['end'] - final_timeline[-1]['start']

        consolidated = final_timeline
            
        print(f"-> Built timeline with {len(consolidated)} clips.")
        return consolidated

    def pick_media(self, keyword):
        cands = self.media_map.get(keyword, [])
        if not cands: cands = self.fallback_pool
        if not cands: return ""
        
        cands_copy = list(cands)
        if self.media_source != 'local':
            random.shuffle(cands_copy) # Randomize so equally-used files don't always pick the same sequence
            
        cands_copy.sort(key=lambda x: self.used_file_counts.get(x,0))
        
        choice = cands_copy[0]
        self.used_file_counts[choice] = self.used_file_counts.get(choice,0) + 1
        return choice

    def generate_clips(self, timeline):
        print("... Generating Visual Clips")
        clips = []
        for i, item in enumerate(timeline):
            path = item['media_path']
            original_dur = item['duration']
            # Add padding for transition overlap
            # Clip needs to be slightly longer to fade into next clip
            dur = original_dur + 0.6 if i < len(timeline)-1 else original_dur 
            
            try:
                clip = self.create_single_clip(path, dur)
                if clip: 
                    # Set start time relative to timeline BUT
                    # with concatenate_videoclips we don't set absolute start time usually.
                    # We just rely on duration and padding.
                    clips.append(clip)
            except Exception as e:
                print(f"Clip error {path}: {e}")
        return clips

    def create_single_clip(self, path, duration):
        if not path or not os.path.exists(path): return None
        ext = os.path.splitext(path)[1].lower()
        w,h = SCREEN_SIZE
        
        clip = None
        if ext in ['.jpg','.png','.webp']:
            img = ImageClip(path)
            # ResizeToFill
            iw, ih = img.size
            scale = max(w/iw, h/ih) * 1.1 # slight overscale
            img = img.resize(scale)
            img = img.crop(width=w, height=h, x_center=w/2, y_center=h/2)
            
            # Ken Burns / Zoom Effect
            # Scale the zoom rate automatically so it stretches ~8% over the full specific duration of the clip.
            # Prevents dizzying fast zooms if an image remains on screen for large durations.
            zoom_rate = 0.08 / max(duration, 1.0)
            img = img.resize(lambda t: 1 + zoom_rate * t)

            img = img.set_position('center') 
            clip = img.set_duration(duration)
            
        elif ext in ['.mp4','.mov','.webm']:
            vid = VideoFileClip(path)
            # Loop video if too short
            if vid.duration < duration: 
                vid = vfx.loop(vid, duration=duration)
            # Trim if too long (but keep start)
            if vid.duration > duration: 
                vid = vid.subclip(0, duration)
            
            cw, ch = vid.size
            scale = max(w/cw, h/ch)
            vid = vid.resize(scale)
            vid = vid.crop(width=w, height=h, x_center=w/2, y_center=h/2)
            clip = vid.set_duration(duration)

        if clip:
            # Standard Crossfade In (Transition A)
            clip = clip.crossfadein(0.5) 
            
        return clip

    def generate_ass_file(self, words, filepath):
        print("... Generating .ass Subtitles File")
        if not words:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial Black,95,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,10,6,2,60,60,450,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
            return
            
        chunks = []
        i = 0
        while i < len(words):
            w = words[i]
            start = w['start']
            end = w['end']
            text = w['text']
            
            # Group with next word if both are very short and spoken quickly
            if i + 1 < len(words):
                next_w = words[i+1]
                gap = next_w['start'] - end
                # Clean punctuation to check pure word length
                clean_text = ''.join(c for c in text if c.isalnum())
                clean_next = ''.join(c for c in next_w['text'] if c.isalnum())
                
                is_end_of_phrase = text.strip()[-1] in ['.', '!', '?', ',']
                
                # If both are short words, AND less than 0.1s gap
                if len(clean_text) <= 4 and len(clean_next) <= 5 and gap < 0.1 and not is_end_of_phrase:
                    end = next_w['end']
                    text = f"{text} {next_w['text']}"
                    
                    # Smooth gap to the word AFTER the next word
                    if i + 2 < len(words):
                        gap2 = words[i+2]['start'] - end
                        is_next_end = next_w['text'].strip()[-1] in ['.', '!', '?', ',']
                        if 0 <= gap2 <= 0.2 and not is_next_end:
                            end = words[i+2]['start']
                    
                    chunks.append({'start': start, 'end': end, 'text': text})
                    i += 2
                    continue
            
            # If not grouped, output as a single word
            if i + 1 < len(words):
                next_start = words[i+1]['start']
                gap = next_start - end
                is_end_of_phrase = text.strip()[-1] in ['.', '!', '?', ',']
                # Extend the visible end-time to cover tiny gaps and prevent 1-frame flickering
                if 0 <= gap <= 0.2 and not is_end_of_phrase:
                    end = next_start
                    
            chunks.append({'start': start, 'end': end, 'text': text})
            i += 1

        def format_time(seconds):
            h = int(seconds / 3600)
            m = int((seconds % 3600) / 60)
            s = int(seconds % 60)
            cs = int((seconds * 100) % 100)
            return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("[Script Info]\n")
            f.write("ScriptType: v4.00+\n")
            f.write("PlayResX: 1080\n")
            f.write("PlayResY: 1920\n")
            f.write("\n")
            f.write("[V4+ Styles]\n")
            f.write("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
            f.write("Style: Default,Arial Black,95,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,10,6,2,60,60,450,1\n")
            f.write("\n")
            f.write("[Events]\n")
            f.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
            
            for chunk in chunks:
                start_str = format_time(chunk['start'])
                end_str = format_time(chunk['end'])
                text = chunk['text'].replace('\n', '\\N').strip()
                # To make it uppercase (often done for shorts)
                text = text.upper()
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}\n")

    def render(self, visuals, transcript_words):
        print("... Rendering Base Video (Without Subtitles)")
        
        # Transition Logic: Overlap clips by 0.5s (matching crossfadein duration)
        # padding=-0.5 means start next clip 0.5s before current ends.
        visual_track = concatenate_videoclips(visuals, method="compose", padding=-0.5)
        
        audio = AudioFileClip(self.audio_path)
        final_dur = audio.duration
        
        # Final trim
        if visual_track.duration > final_dur:
            visual_track = visual_track.subclip(0, final_dur)
        else:
            visual_track = visual_track.set_duration(final_dur)
            
        final = visual_track
        final = final.set_duration(final_dur)
        
        custom_logger = CustomVideoLogger()
        
        import uuid
        job_hex = uuid.uuid4().hex
        temp_video = os.path.join(self.job_dir, f"temp_vis_{job_hex}.mp4")
        ass_path = os.path.join(self.job_dir, f"subs_{job_hex}.ass")
        
        # Output Subtitles
        self.generate_ass_file(transcript_words, ass_path)
        
        final.write_videofile(
            temp_video,
            fps=30,
            codec="libx264",
            preset="medium", 
            threads=4,
            audio=False, # STRICTLY FORCE NO MOVIEPY AUDIO
            logger=custom_logger
        )
        
        # Free memory and file descriptors
        final.close()
        try:
            audio.close()
        except:
            pass
            
        print("... Multiplexing Frame-Perfect Audio Track & Subtitles via Native FFmpeg")
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        rel_ass_path = os.path.relpath(ass_path, start=os.getcwd()).replace('\\', '/')
        rel_ass_path = rel_ass_path.replace(':', '\\:') # Safety escape for windows paths in ffmpeg filters
        
        subprocess.run([
            ffmpeg_exe, "-y",
            "-i", temp_video,
            "-i", self.audio_path,
            "-vf", f"ass={rel_ass_path}",
            "-c:v", "libx264",
            "-preset", "medium",
            "-c:a", "aac",
            "-b:a", "192k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest", 
            self.output_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if os.path.exists(temp_video):
            os.remove(temp_video)
        if os.path.exists(ass_path):
            os.remove(ass_path)
            
        print(">>> DONE")

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    with open(sys.argv[1], 'r') as f: config = json.load(f)
    VideoBuilder(config).run()
