import json
import os
import sys
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

# Strict MoviePy 1.x imports
from moviepy.editor import VideoFileClip, AudioFileClip, ImageClip, ColorClip, concatenate_videoclips, CompositeVideoClip
import moviepy.video.fx.all as vfx

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
            
            # 5. Generate Styled Subtitles (Safe & Fast)
            subtitle_clips = self.generate_subtitles(transcript_words)
            
            # 6. Render
            self.render(visual_clips, subtitle_clips)
            
        except Exception as e:
            print(f"!!! CRITICAL FAIL: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def validate_assets(self):
        print("... Validating Media Assets")
        if not os.path.exists(self.audio_path):
            raise FileNotFoundError(f"Audio file missing: {self.audio_path}")
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
            response = requests.post("https://api.assemblyai.com/v2/transcript", headers=headers, json={"audio_url": audio_url, "language_code": "en", "expected_layout": "default"})
            response.raise_for_status()
            tx_id = response.json()['id']

            # Poll
            while True:
                res = requests.get(f"https://api.assemblyai.com/v2/transcript/{tx_id}", headers=headers).json()
                if res['status'] == 'completed':
                    words = res.get('words', [])
                    # Add positive offset to perfectly sync delayed TTS playback with early subtitles
                    return [{'text':w['text'], 'start':(w['start']/1000.0) + 0.20, 'end':(w['end']/1000.0) + 0.20} for w in words]
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
        print("... Building Timeline")
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

        # Clean up timeline: Remove gaps, enforce MIN and MAX durations
        MIN_CLIP_DURATION = 3.0
        MAX_CLIP_DURATION = 5.0
        
        merged_segments = []
        for seg in segments:
            dur = seg['end'] - seg['start']
            if dur < 0.1:
                continue
            if not merged_segments:
                merged_segments.append(seg)
                continue
            
            prev_seg = merged_segments[-1]
            prev_dur = prev_seg['end'] - prev_seg['start']
            
            # Extend previous if current is very short
            if dur < MIN_CLIP_DURATION:
                prev_seg['end'] = seg['end']
            # Conversely extend previous if IT was too short
            elif prev_dur < MIN_CLIP_DURATION:
                prev_seg['end'] = seg['end']
                prev_seg['keyword'] = seg['keyword'] # Take the newer keyword
            else:
                seg['start'] = prev_seg['end']
                merged_segments.append(seg)
                
        # Split long segments into chunks using different media
        split_segments = []
        for seg in merged_segments:
            start = seg['start']
            end = seg['end']
            kw = seg['keyword']
            dur = end - start
            
            while dur > MAX_CLIP_DURATION:
                chunk_end = start + 4.0 # Target ~4s chunks
                split_segments.append({'start': start, 'end': chunk_end, 'keyword': kw})
                start = chunk_end
                dur = end - start
            
            if dur > 0.1:
                # If remaining is too short, fold it into the previous chunk if same keyword
                if dur < MIN_CLIP_DURATION and split_segments and split_segments[-1]['keyword'] == kw:
                    split_segments[-1]['end'] = end
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
            img = img.resize(lambda t: 1 + 0.02 * t)
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

    def generate_subtitles(self, words):
        print("... Generating Safe Subtitles (Shorts Style)")
        if not words: return []
        
        chunks = []
        current = []
        current_char_count = 0
        
        chunk_start = 0
        for w in words:
            if not current: chunk_start = w['start']
            current.append(w)
            current_char_count += len(w['text'])
            
            dur = w['end'] - chunk_start
            is_new_sentence = w['text'].strip()[-1] in ['.','!','?']
            
            # Stricter Rules: Max 3-4 words for faster pace
            if len(current) >= 3 or current_char_count > 20 or dur > 1.5 or is_new_sentence:
                chunks.append({'words':current, 'start':chunk_start, 'end':w['end'], 'text': " ".join([x['text'] for x in current])})
                current = []
                current_char_count = 0

        if current:
            chunks.append({'words':current, 'start':chunk_start, 'end':current[-1]['end'], 'text': " ".join([x['text'] for x in current])})

        subtitle_clips = []
        
        for chunk in chunks:
            txt = chunk['text']
            start = chunk['start']
            dur = chunk['end'] - chunk['start']
            if dur < 0.1: continue

            try:
                img_clip = self.create_safe_subtitle_image(txt)
                img_clip = img_clip.set_start(start).set_duration(dur)
                
                # Part C: Trending Style Pop-in (Lightweight)
                # Slight fadein/pop (0.1s)
                img_clip = img_clip.crossfadein(0.1)
                
                subtitle_clips.append(img_clip)
            except Exception as e:
                print(f"Sub error: {e}")
                
        return subtitle_clips

    def create_safe_subtitle_image(self, text):
        w, h = SCREEN_SIZE
        img = Image.new('RGBA', (w, h), (0,0,0,0))
        draw = ImageDraw.Draw(img)
        
        # Bigger, Bolder Font
        fontsize = 90 # Increased from 80
        font = self.get_font(fontsize)
        
        # Wrap Text (Hard Limit 2 lines)
        max_width = w - (SAFE_MARGIN * 2)
        lines = self.wrap_text(text, font, max_width)
        
        # Shrink if needed
        if len(lines) > 2:
            fontsize = 70
            font = self.get_font(fontsize)
            lines = self.wrap_text(text, font, max_width)
            
        line_height = fontsize * 1.2
        total_text_h = len(lines) * line_height
        
        current_y = SUBTITLE_Y_POS - (total_text_h / 2)
        
        for line in lines:
            lw = draw.textlength(line, font=font)
            lx = (w - lw) / 2
            
            # Use Thicker Stroke for High Contrast
            stroke_width = 8 # Increased from 4
            for ox in range(-stroke_width, stroke_width+1):
                for oy in range(-stroke_width, stroke_width+1):
                    draw.text((lx+ox, current_y+oy), line, font=font, fill='black')
            
            # Maybe Shadow too?
            shadow_off = 6
            draw.text((lx+shadow_off, current_y+shadow_off), line, font=font, fill=(0,0,0,180))
            
            draw.text((lx, current_y), line, font=font, fill='white')
            current_y += line_height
            
        return ImageClip(np.array(img))

    def get_font(self, size):
        try:
            # Try to load Arial Black or Impact for that "Shorts" look
            return ImageFont.truetype("arialbd.ttf", size)
        except:
            return ImageFont.load_default()

    def wrap_text(self, text, font, max_width):
        lines = []
        words = text.split()
        curr_line = []
        
        draw = ImageDraw.Draw(Image.new('RGBA', (1,1)))
        
        for word in words:
            test_line = " ".join(curr_line + [word])
            w = draw.textlength(test_line, font=font)
            if w <= max_width:
                curr_line.append(word)
            else:
                if curr_line:
                    lines.append(" ".join(curr_line))
                    curr_line = [word]
                else:
                    lines.append(word)
                    curr_line = []
        
        if curr_line:
            lines.append(" ".join(curr_line))
            
        return lines

    def render(self, visuals, subtitles):
        print("... Rendering")
        
        # Transition Logic: Overlap clips by 0.5s (matching crossfadein duration)
        # padding=-0.5 means start next clip 0.5s before current ends.
        visual_track = concatenate_videoclips(visuals, method="compose", padding=-0.5)
        
        audio = AudioFileClip(self.audio_path)
        final_dur = audio.duration
        
        # Ensure visual track is long enough (Part B: Ending Fix)
        if visual_track.duration < final_dur:
            # If still short (unlikely given timeline fix), loop the last frame?
            # Concatenated clip is hard to extend.
            # But we added padding to timeline segments, so visual_track should be >= final_dur + overlaps.
            # We subclip to exact audio length.
            pass
            
        # Final trim
        if visual_track.duration > final_dur:
            visual_track = visual_track.subclip(0, final_dur)
        else:
            visual_track = visual_track.set_duration(final_dur)
            
        final = CompositeVideoClip([visual_track] + subtitles)
        final = final.set_audio(audio)
        final = final.set_duration(final_dur)
        
        final.write_videofile(
            self.output_path,
            fps=30,
            codec="libx264",
            audio_codec="aac",
            preset="medium", 
            threads=4,
            logger='bar'
        )
        print(">>> DONE")

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    with open(sys.argv[1], 'r') as f: config = json.load(f)
    VideoBuilder(config).run()
