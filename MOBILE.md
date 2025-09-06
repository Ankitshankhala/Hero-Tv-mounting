# Mobile App Setup

This app is now configured to run as a native iOS and Android app using Capacitor.

## Running on Device/Emulator

### Prerequisites
- **For iOS**: Mac with Xcode installed
- **For Android**: Android Studio installed

### Setup Steps

1. **Export and clone locally**
   - Use the "Export to Github" button in Lovable
   - Clone your GitHub repository locally
   ```bash
   git clone [your-repo-url]
   cd hero-tv-mounting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the app**
   ```bash
   npm run build
   ```

4. **Add native platforms** (first time only)
   ```bash
   # For iOS
   npx cap add ios
   
   # For Android  
   npx cap add android
   
   # Or both
   npm run cap:add:ios
   npm run cap:add:android
   ```

5. **Sync changes to native platforms**
   ```bash
   npx cap sync
   # or
   npm run cap:sync
   ```

6. **Run on device/emulator**
   ```bash
   # iOS (requires Xcode)
   npx cap run ios
   # or
   npm run cap:run:ios
   
   # Android (requires Android Studio)
   npx cap run android  
   # or
   npm run cap:run:android
   ```

### Important Notes

- **After git pull**: Always run `npx cap sync` before running the app again
- **Live reload**: The app is configured to use live reload from the Lovable sandbox URL, so changes in Lovable will reflect in the mobile app automatically
- **Native features**: All existing features work in mobile:
  - Supabase Auth (WebView compatible)
  - Phone calls (uses `tel:` links)
  - Maps integration (deep links to native apps)
  - Stripe payments (opens in system browser)

### Troubleshooting

- If the app shows a blank screen, ensure you've run `npm run build` and `npx cap sync`
- For iOS simulator issues, try cleaning the build in Xcode
- For Android issues, try invalidating caches in Android Studio

### Optional Native Enhancements

Future enhancements could include:
- Native browser plugin for in-app external links
- Custom app icons and splash screens
- Push notifications
- Deep linking for email verification flows