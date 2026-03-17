@echo off
echo Installing Python dependencies...
python -m pip install -r requirements.txt

echo.
echo Installing node dependencies for server...
cd server
call npm install
cd ..

echo.
echo Installing node dependencies for client...
cd client
call npm install
cd ..

echo.
echo Setup Complete. You can now run start-dev.bat!
pause
