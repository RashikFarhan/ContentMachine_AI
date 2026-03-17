@echo off
REM ============================================================
REM Build all Python scripts into standalone .exe files
REM Run this ONCE before packaging with electron-builder
REM ============================================================

echo.
echo ===== Building Python Executables =====
echo.

REM Create output directory
if not exist "python-dist" mkdir python-dist

echo [1/3] Building build_video.exe ...
pyinstaller --noconfirm --onefile --console ^
    --name build_video ^
    --distpath python-dist ^
    --workpath build_py_temp ^
    --specpath build_py_temp ^
    --hidden-import=moviepy ^
    --hidden-import=moviepy.editor ^
    --hidden-import=moviepy.video.fx.all ^
    --hidden-import=moviepy.audio.fx.all ^
    --hidden-import=imageio ^
    --hidden-import=imageio_ffmpeg ^
    --hidden-import=imageio_ffmpeg.binaries ^
    --hidden-import=numpy ^
    --hidden-import=PIL ^
    --hidden-import=PIL.Image ^
    --hidden-import=proglog ^
    --hidden-import=requests ^
    --hidden-import=tqdm ^
    --hidden-import=decorator ^
    --collect-all imageio_ffmpeg ^
    server/video_builder/build_video.py
if %errorlevel% neq 0 (
    echo FAILED to build build_video.exe
    pause
    exit /b 1
)

echo [2/3] Building change_speed.exe ...
pyinstaller --noconfirm --onefile --console ^
    --name change_speed ^
    --distpath python-dist ^
    --workpath build_py_temp ^
    --specpath build_py_temp ^
    --hidden-import=moviepy ^
    --hidden-import=moviepy.editor ^
    --hidden-import=imageio ^
    --hidden-import=imageio_ffmpeg ^
    --hidden-import=imageio_ffmpeg.binaries ^
    --hidden-import=PIL ^
    --hidden-import=PIL.Image ^
    --collect-all imageio_ffmpeg ^
    server/tools/change_speed.py
if %errorlevel% neq 0 (
    echo FAILED to build change_speed.exe
    pause
    exit /b 1
)

echo [3/3] Building enforce_duration.exe ...
pyinstaller --noconfirm --onefile --console ^
    --name enforce_duration ^
    --distpath python-dist ^
    --workpath build_py_temp ^
    --specpath build_py_temp ^
    --hidden-import=moviepy ^
    --hidden-import=moviepy.editor ^
    --hidden-import=imageio ^
    --hidden-import=imageio_ffmpeg ^
    --hidden-import=imageio_ffmpeg.binaries ^
    --hidden-import=PIL ^
    --hidden-import=PIL.Image ^
    --collect-all imageio_ffmpeg ^
    server/tools/enforce_duration.py
if %errorlevel% neq 0 (
    echo FAILED to build enforce_duration.exe
    pause
    exit /b 1
)

echo.
echo ===== All Python Executables Built Successfully! =====
echo Output: python-dist/
echo   - build_video.exe
echo   - change_speed.exe
echo   - enforce_duration.exe
echo.

REM Cleanup temp build artifacts
if exist build_py_temp rmdir /s /q build_py_temp

pause
