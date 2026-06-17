@echo off
setlocal EnableDelayedExpansion
title Harth Launcher

:: ASCII-only content to avoid Windows CMD codepage corruption.

cd /d "%~dp0"

echo.
echo ================================================================
echo                   HARTH - Starting up
echo ================================================================
echo.

:: ---- Find PostgreSQL bin ----
set "PGBIN="
for %%V in (18 17 16 15 14) do (
    if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" (
        set "PGBIN=C:\Program Files\PostgreSQL\%%V\bin"
        goto pg_found
    )
)
:pg_found
if "!PGBIN!"=="" (
    echo [WARN] PostgreSQL bin directory not found in standard locations.
    echo        If errors occur, install PostgreSQL or adjust this script.
) else (
    echo [INFO] Using PostgreSQL at: !PGBIN!
)
echo.

:: ---- 1. Node.js ----
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo Install from https://nodejs.org and restart your computer.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [1/7] Node.js %%i found
echo.

:: ---- 2. Go to server dir ----
cd server
if not exist package.json (
    echo [ERROR] server\package.json not found. Did you unzip correctly?
    pause
    exit /b 1
)
echo [2/7] Found server directory
echo.

:: ---- 3. Create .env (always overwrite to ensure correct content) ----
echo [3/7] Creating .env with working defaults...

:: Ask user for PostgreSQL password (only if .env doesn't exist yet)
if not exist .env (
    echo.
    echo Please enter your PostgreSQL password ^(the one you set when installing^):
    set /p "PG_PASSWORD="
    if "!PG_PASSWORD!"=="" (
        echo [ERROR] Password is required.
        pause
        exit /b 1
    )
) else (
    :: Read existing password
    for /f "tokens=1,* delims==" %%a in ('findstr /b "DB_PASSWORD=" .env') do set "PG_PASSWORD=%%b"
)

:: Generate a long JWT_SECRET using Node.js
for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do set "JWT=%%s"

:: Write .env using multi-line redirect. Single > creates, >> appends.
> .env echo NODE_ENV=development
>> .env echo PORT=3000
>> .env echo DB_HOST=localhost
>> .env echo DB_PORT=5432
>> .env echo DB_USER=postgres
>> .env echo DB_PASSWORD=!PG_PASSWORD!
>> .env echo DB_NAME=harth
>> .env echo JWT_SECRET=!JWT!
>> .env echo JWT_EXPIRES_IN=7d
>> .env echo BCRYPT_ROUNDS=12
>> .env echo ADMIN_EMAIL=admin@harth.com
>> .env echo ADMIN_PASSWORD=admin123
>> .env echo UPLOAD_MAX_BYTES=5242880
>> .env echo STRIPE_CURRENCY=omr
>> .env echo SMTP_PORT=587
>> .env echo SMTP_FROM=no-reply@harth.com

echo       .env written with DB_PASSWORD and a 96-char JWT_SECRET.
echo.

:: ---- 4. Create database if needed ----
echo [4/7] Ensuring database 'harth' exists...
if not "!PGBIN!"=="" (
    set "PGPASSWORD=!PG_PASSWORD!"
    "!PGBIN!\psql.exe" -U postgres -h localhost -d postgres -c "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Cannot connect to PostgreSQL with that password.
        echo         Double-check your PostgreSQL password and try again.
        pause
        exit /b 1
    )
    "!PGBIN!\psql.exe" -U postgres -h localhost -d harth -c "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        echo       Database does not exist. Creating 'harth'...
        "!PGBIN!\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE harth;" >nul
        echo       Created.
    ) else (
        echo       Database 'harth' exists.
    )
) else (
    echo       Skipping DB check ^(psql not found^). Assuming it exists.
)
echo.

:: ---- 5. npm install ----
if not exist node_modules (
    echo [5/7] Installing Node packages ^(2-3 min first time^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo       Installed.
) else (
    echo [5/7] Packages already installed.
)
echo.

:: ---- 6. Run migrations ----
echo [6/7] Running database migrations...
call npx knex migrate:latest
if errorlevel 1 (
    echo [ERROR] Migrations failed. Check the error above.
    pause
    exit /b 1
)
echo       Migrations done.
echo.

:: ---- 6b. Offer to seed demo data ----
echo Seed demo data? ^(creates test farmers, renters, couriers, and sample orders^)
echo    This is idempotent - safe to skip, safe to re-run.
set /p "SEED_CHOICE=Type Y to seed, anything else to skip: "
if /i "!SEED_CHOICE!"=="Y" (
    call npm run seed
    echo.
)

:: ---- 7. Start the server ----
echo [7/7] Starting server...
echo.
echo ================================================================
echo   Server will open in your browser in 3 seconds at:
echo.
echo   http://localhost:3000
echo.
echo ================================================================
echo   Admin login:  admin@harth.com  /  admin123
echo.
echo   To stop:  Press Ctrl+C or close this window
echo ================================================================
echo.

start /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

call npm start
echo.
echo Server stopped. Press any key to close.
pause >nul
