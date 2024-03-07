# Squidbox - A React Native app for managing photos and videos in the cloud

This is a React Native app with a Rails API backend. It is a personal project and I use it to manage my photos and videos in the cloud. It works pretty much like Apple Photos but the files are not stored on the device but rather in he cloud. I have a lot of very big photo and video shoots and want to have them accessible on my phone without using up all the storage.

# Prerequisites

For local development you need to have the squidbox-api Rails project checkout with the Rails server running on localhost:3000.

# Credentials

Before you build for production you need to create a `.env.production` file in the root of the project and specify the API URL in the `EXPO_PUBLIC_API_URL` variable.

# To run the project

    nvm use
    npx expo start

Clear cache and start Expo (useful when you get errors or installed/upgraded packages)

    npx expo start -c

# Build the project

You can use Internal Distribution to get the app on your device without having to go through App Store
https://docs.expo.dev/build/internal-distribution/

Setup your app.json:

- set name, slug and version
- add and configure icons and splash screen (assets/adaptive-icon.png, icon.png, splash.png)

Install eas-cli and login (you can check if you are already logged in with `eas whoami`)

      nvm use
      npm install -g eas-cli
      eas login

Create a build profile for preview builds

      eas build:configure

If you have not used your device with Internal Distribution yet you need to run:

      eas device:create

If you need to remove devices or get a list of registered devices checkout https://docs.expo.dev/build/internal-distribution/#managing-devices

And finally create a preview build

      eas build --profile preview --platform ios

## Expiring preview builds

When creating preview builds they get signed with a certificate that expires after a year. When the cert has expired you cannot use the preview app anymore and need to create a new build.

## Help articles on Expo.dev

- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build/internal-distribution/

## Ideas

Use SQLite to store data locally
https://blog.stackademic.com/offline-react-native-app-with-typeorm-expo-sqlite-and-react-query-37e5b8a05abb
SQLite is now also supported native in Expo 50
https://docs.expo.dev/versions/v50.0.0/sdk/sqlite-next/

# Notes

## Uploading large files in chunks.

I removed that because my implementation crashes with files > 2GB because of a integer bug in Expo
You could try this instead:
https://medium.com/@mohitrohilla2696/chunk-upload-in-react-native-using-file-read-and-write-from-storage-8554607e2bf9
Chunk Uploader (they are doing it with React Native FS. maybe this doesn't crash with > 2GB files?)
