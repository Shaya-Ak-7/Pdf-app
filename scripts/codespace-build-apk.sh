#!/usr/bin/env bash
set -euxo pipefail

REPO_ROOT="${CODESPACE_VSCODE_FOLDER:-/workspaces/Pdf-app}"

echo "=== [1/4] Android SDK ==="
export ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd /tmp
curl -fSL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
rm -rf "$ANDROID_HOME/cmdline-tools/latest"
unzip -q cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "build-tools;35.0.0"

echo "=== [2/4] JS deps ==="
cd "$REPO_ROOT"
node --version
java -version
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npm ci

echo "=== [3/4] Gradle assembleDebug ==="
cd "$REPO_ROOT/android"
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon --stacktrace

APK=$(ls app/build/outputs/apk/debug/*.apk | head -n 1)
echo "Built APK: $APK"
ls -la "$APK"

echo "=== [4/4] Publish APK as release asset ==="
TAG="apk-$(date +%Y%m%d-%H%M%S)"
cd "$REPO_ROOT"
gh release create "$TAG" "$APK" \
  --repo Shaya-Ak-7/Pdf-app \
  --title "APK build $TAG" \
  --notes "Automated debug APK from GitHub Codespaces, branch arena/01a101d2-pdf-app" \
  --prerelease

echo "APK_READY tag=$TAG"
