#!/usr/bin/env bash

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_HOME="$DIR"
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
JAR_PATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

if [ ! -f "$JAR_PATH" ]; then
  echo "Gradle Wrapper JAR not found at $JAR_PATH" >&2
  echo "Please run: gradle wrapper" >&2
  exit 1
fi

exec java -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
