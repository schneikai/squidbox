# Squidbox - A React Native app for managing photos and videos in the cloud

This is a React Native app with a Rails API backend. It is a personal project and I use it to manage my photos and videos in the cloud. It works pretty much like Apple Photos but the files are not stored on the device but rather in he cloud. I have a lot of very big photo and video shoots and want to have them accessible on my phone without using up all the storage.

# Prerequisites

For local development you need to have the squidbox-api Rails project checked out with the Rails server running on localhost:3000.

If you want to try the app on your photo in development, you can use the Expo Go app. For this to work though, the Rails server must be accessible for your phone on the local wifi. To do this:

- Find the IP address of your development computer. On macOS, you can go to System Preferences > Network and select your active network connection to find your IP address.
- Set the API URL in the `.env.local` file to `http://<your-ip>:3000/api/v1`
- Start the Rails server and have it accessible for all local connections via `rails server -b 0.0.0.0`
- Open the Expo Go app on your phone and run the app

## Environment Variables and Secrets

For your local development environment, create a `.env.local` file in the root of the project and add the following environment variables:

      EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
      EXPO_PUBLIC_LOGIN_FORM_EMAIL=user@example.com
      EXPO_PUBLIC_LOGIN_FORM_PASSWORD=password
      EXPO_PUBLIC_SENTRY_DEBUG=true

Environment variables for Preview and Production builds must be added to `eas.json`.
https://docs.expo.dev/build-reference/variables/#setting-plaintext-environment-variables-in-easjson

### Secrets

Secrets must be added to the Expo project on the Expo website. I use a `.secrets` file in the root of the project and then upload it to Expo to create the secrets on their servers. The file looks like this:

      EXPO_PUBLIC_API_URL=the-secret-production-api-url
      SENTRY_AUTH_TOKEN=the-secret-token

Heads-up: The EXPO_PUBLIC_API_URL is a secret and not a environment variable just because I don't want to have it fly around on Github. We could have also just added it to `eas.json`.

Now, to create the secrets in your Expo project run:

      eas secret:push --scope project --env-file .secrets

If you want to update existing secrets you need to add `--force` to the command.

If you want to list all available secrets you can run:

      eas secret:list

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

The credentials for EAS are the same as for Expo.

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

# Sentry

We use Sentry for error tracking. You need to set the required config and secrets for your own Sentry account though.

- app.json: Specify organization and project in the Sentry Plugin section
- SENTRY_AUTH_TOKEN: This is a secret you need to add to your project on the Expo website
- App.js: Set the DSN in the Sentry.init call

# Ideas

Use SQLite to store data locally
https://blog.stackademic.com/offline-react-native-app-with-typeorm-expo-sqlite-and-react-query-37e5b8a05abb
SQLite is now also supported native in Expo 50
https://docs.expo.dev/versions/v50.0.0/sdk/sqlite-next/

# Notes

## React-Navigation-Native vs Expo Router

Expo 50 introduced a native Expo router. We should try this out. Maybe we can remove the react-navigation-native dependency.
