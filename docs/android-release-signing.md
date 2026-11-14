# Android release signing

Builds you give to other people must be **release builds**, signed with your own key. Debug builds
are debuggable: anyone with the phone and a USB cable can copy the app's data. Debug builds also
use a key every Android developer has (security audit M4).

| Build | Command | Output | Use |
|---|---|---|---|
| WebView app, debug | `npm run build:android` | `life-os-debug.apk` | Your own phone |
| WebView app, release | `npm run build:android:release` | `life-os-release.apk` | Anyone else |
| WebView app, Full, release | `npm run build:android:full:release` | `life-os-full-release.apk` | Anyone else, installed from a computer |
| Native app | `npm run build:native` | `life-os-native.apk` | Signed with your key when the variables below are set |

The key and its passwords never go in the repository. The build reads them from environment
variables, and refuses a keystore stored inside the repository folder.

## 1. Create the key (once)

In PowerShell, outside the repository folder:

```powershell
mkdir $env:USERPROFILE\lifeos-keys
cd $env:USERPROFILE\lifeos-keys
keytool -genkeypair -v -keystore lifeos-release.jks -alias lifeos -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` comes with Android Studio, in `C:\Program Files\Android\Android Studio\jbr\bin`. It asks
for a password and for a name. Use a long password and store it in a password manager.

## 2. Back it up

Copy `lifeos-release.jks` and its password to two places you control, for example an encrypted
USB stick and your password manager.

If you lose the key, no installed copy of the app can ever be updated again. Everyone would have to
uninstall it and install a new one.

## 3. Build with it

Set the variables in the PowerShell window you build from:

```powershell
$env:LIFEOS_KEYSTORE = "$env:USERPROFILE\lifeos-keys\lifeos-release.jks"
$env:LIFEOS_KEYSTORE_PASSWORD = Read-Host "Keystore password"
npm run build:android:release
```

Two variables are optional:
- `LIFEOS_KEY_ALIAS`, if you didn't use `lifeos`.
- `LIFEOS_KEY_PASSWORD`, if the key has its own password.

## 4. Certificate fingerprints

Print the fingerprint of your key:

```powershell
keytool -list -v -keystore $env:LIFEOS_KEYSTORE -alias lifeos
```

| Where the app comes from | Fingerprint to use (for example in `assetlinks.json`) |
|---|---|
| Installed from an APK file | The SHA-256 of **your key**, from the command above |
| Installed from Google Play with Play App Signing | The SHA-256 of **Google's app signing key**: Play Console, then Test and release, then App integrity. Your key is then only the upload key. |

## 5. The one-time switch for existing installs

Android refuses to update an app with a new key. Anyone who installed a debug build has to switch
once:

1. Open the old app online, so everything has synced.
2. Uninstall it.
3. Install the release build and sign in.

Data kept only on the phone is lost in step 2. That includes Life Connect pairing, the SMS log and
local settings. Pair Life Connect again after installing.
