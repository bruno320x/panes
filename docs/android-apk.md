# Android APK build

Date: 2026-05-09

Panes is a Tauri 2 app. Tauri supports Android from the same Rust + web frontend codebase, but Android builds require a configured local Android toolchain and generated Android project files.

Official references:

- Prerequisites: https://v2.tauri.app/start/prerequisites/
- Distribution commands: https://v2.tauri.app/distribute/
- Android signing: https://v2.tauri.app/distribute/sign/android/

## Required Tooling

- Android Studio.
- `JAVA_HOME` pointing to Android Studio JBR.
- `ANDROID_HOME` pointing to the Android SDK.
- `NDK_HOME` pointing to an installed Android NDK.
- Android SDK Platform, Platform Tools, Build Tools, Command-line Tools, and NDK installed through SDK Manager.
- Rust Android targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## Repo Scripts

```bash
npm run android:init
npm run android:dev
npm run android:build
```

## First-Time Build Flow

1. Install and configure Android Studio/SDK/NDK.
2. Confirm environment:

```bash
echo "$JAVA_HOME"
echo "$ANDROID_HOME"
echo "$NDK_HOME"
rustup target list --installed | grep android
```

3. Generate the Tauri Android project:

```bash
npm run android:init
```

4. Build the APK:

```bash
npm run android:build
```

5. For Play Store distribution, create a keystore and configure signing in `src-tauri/gen/android/app/build.gradle.kts`.

## Current Status

The repo now exposes the Android scripts.

Attempted in this environment:

```bash
npm run android:build
```

Result:

```text
Android Studio project directory src-tauri/gen/android doesn't exist.
Please run `tauri android init` and try again.
```

Then:

```bash
npm run android:init
```

Result:

```text
ANDROID_HOME not set, trying to locate Android SDK...
Android SDK not found at /home/bruninho/Android/Sdk
```

No APK was generated because the local Android SDK/NDK toolchain is not installed/configured. Install the prerequisites above, rerun `npm run android:init`, review generated `src-tauri/gen/android`, then run `npm run android:build`.

Generated Android project files should be committed only after a successful `android:init` and a clean review of the generated Gradle files.
