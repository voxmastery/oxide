// Expo config plugin for Oxide's on-device Rust toolchain (modules/oxide-toolchain).
//
// Android 10+ (targetSdk ≥ 29) only lets an app execute files from its native library dir, so
// rustc, cargo, rust-lld… are packaged as lib<name>.so "native libraries". This plugin:
//
//   1. sets android:extractNativeLibs="true" and expo.useLegacyPackaging=true, so the
//      libraries are extracted to nativeLibraryDir on install (instead of being mmapped from
//      the APK, where they cannot be exec'd);
//   2. restricts the build to arm64-v8a (the only ABI the toolchain is built for) and raises
//      minSdk to 29;
//   3. keeps AGP from stripping the toolchain binaries (they are already stripped, and stripping
//      a 100 MB librustc_driver on every build is slow);
//   4. copies toolchain/dist/jniLibs/** (made by toolchain/build-android-host.sh or
//      toolchain/fetch-termux.sh) into android/app/src/main/jniLibs/.
//
// Options: { jniLibsDir?: string (default "toolchain/dist/jniLibs"), minSdkVersion?: number }

const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
} = require('expo/config-plugins');

const ABI = 'arm64-v8a';

function setProperty(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing) existing.value = value;
  else props.push({ type: 'property', key, value });
}

function listToolchainLibs(dir) {
  const abiDir = path.join(dir, ABI);
  if (!fs.existsSync(abiDir)) return [];
  return fs.readdirSync(abiDir).filter((f) => f.endsWith('.so'));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

const withOxideToolchain = (config, options = {}) => {
  const jniLibsDir = options.jniLibsDir ?? 'toolchain/dist/jniLibs';
  const minSdk = options.minSdkVersion ?? 29;

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:extractNativeLibs'] = 'true';
    }
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    const libs = listToolchainLibs(path.resolve(cfg.modRequest.projectRoot, jniLibsDir));
    setProperty(cfg.modResults, 'expo.useLegacyPackaging', 'true');
    setProperty(cfg.modResults, 'reactNativeArchitectures', ABI);
    setProperty(cfg.modResults, 'android.minSdkVersion', String(minSdk));
    if (libs.length) {
      setProperty(cfg.modResults, 'android.packagingOptions.doNotStrip', libs.map((l) => `**/${ABI}/${l}`).join(','));
    }
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    const marker = '// oxide-toolchain: abiFilters';
    if (!src.includes(marker)) {
      src = src.replace(
        /defaultConfig\s*\{/,
        (m) => `${m}\n        ${marker}\n        ndk { abiFilters "${ABI}" }`,
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = path.resolve(root, jniLibsDir);
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'jniLibs');
      if (fs.existsSync(path.join(src, ABI))) {
        copyDir(src, dest);
        const n = listToolchainLibs(src).length;
        console.log(`[oxide-toolchain] copied ${n} toolchain libraries from ${jniLibsDir} to android/app/src/main/jniLibs`);
      } else {
        console.warn(
          `[oxide-toolchain] ${jniLibsDir}/${ABI} not found: building without the Rust toolchain. ` +
            'The app will run, and Compiling will say it is unavailable. See toolchain/README.md.',
        );
      }
      return cfg;
    },
  ]);

  return config;
};

module.exports = withOxideToolchain;
