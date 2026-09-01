@echo off
setlocal

set DIR=%~dp0
if "%DIR:~-1%"=="\" set DIR=%DIR:~0,-1%

set APP_HOME=%DIR%
set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

if not exist "%CLASSPATH%" (
  echo Gradle Wrapper JAR not found at %CLASSPATH%
  echo Please run: gradle wrapper
  exit /b 1
)

java -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
