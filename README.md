# WOOP Goals (Expo / React Native)

Goal app based on WOOP: Wish, Outcome, Obstacle, Plan. Data stays on the device.

## Get an APK with GitHub Actions (no Expo account needed)
1. Create a new GitHub repo and push this folder to the `main` branch.
2. Open the repo's **Actions** tab. The "Build Android APK" workflow runs on every push (or run it manually via "Run workflow").
3. When it finishes (about 10 minutes), open the run and download the **woop-goals-apk** artifact (a zip containing the .apk).
4. Copy the .apk to your phone and install it (allow "install unknown apps").

The APK is signed with the default debug key from Expo's template. It is fine for personal use, not for the Play Store.

## Run locally instead
1. Node 18+ and the Expo Go app on your phone.
2. `npm install`
3. `npx expo start`, then scan the QR code.
