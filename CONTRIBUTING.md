# Contributing

This page outlines the steps to build from source, or to get started with local development.


## Building from source

### 1. Install submodules and dependencies

```shell
git submodule update --init
yarn install
```


### 2. Prepare your environment

Building requires more heap memory than the default node instance allocates due to the use of some custom inline requires to generate nested bundles when targetting the various browser extensions.

You will need to manually increase the amount of heap memory allocated to node before building. 4 GB should be enough, but 8 GB may improve build time:
```shell
export NODE_OPTIONS='--max_old_space_size=8192'
```

### 3. Run the build command

For Chrome:
```shell
yarn build:chrome
```

For Firefox:
```shell
yarn build:firefox
```

For iOS/Safari:
```shell
yarn build:safari
```

**That's it! The built extension will be available under `dist/`**

------------

This section below is only intended for development

### Testing in Firefox for Android

In a new shell session, run the following command to continually build on save:
```shell
yarn watch:firefox
```

#### Deploying to Android Requirements

Android system requirements:
1. Android 11 or above
2. 4 GB of RAM minimum, 8 GB or more recommended

Emulator requirements:
1. [Android Virtual Device Manager](https://developer.android.com/studio/run/managing-avds)
2. AVD with Google Play Store in order to install Firefox

Physical device requirements:
1. [Enable adb debugging](https://developer.android.com/studio/command-line/adb#Enabling)

Setup device:
1. Install Firefox Beta from the Google Play Store
2. Go to and enable **Settings > Advanced > Remote debugging via USB**

Setup host:
1. Open Firefox on your desktop
2. Navigate to `about:debugging#/setup`
3. Run the `yarn serve:firefox-android` command below that applies to your setup
4. Under **Network Location** enter `localhost:{PORT_FROM_PREVIOUS_STEP}` and click **Add**
5. Click **Connect** next to the newly created remote debugging session in the left panel


#### Deploying to Android Commands

```shell
yarn serve:android-firefox [ PACKAGE_ID [ ADB_DEVICE_NAME ] ]
```

In a separate shell, run the following command to continually deploy the built web extension to the default emulated device:
```shell
yarn serve:android-firefox
```

The debugging port will print to the console, and it will look something like this:
```
You can connect to this Android device on TCP port 63302
```

If you want to deploy to a connected Android device instead, provide the device name given from `adb devices` as an argument:
```shell
yarn serve:android-firefox org.mozilla.firefox DEVICE_NAME
```

If you want to deploy to Firefox beta or nightly:
```shell
yarn serve:android-firefox org.mozilla.firefox_beta
```

```shell
yarn serve:android-firefox org.mozilla.fenix
```

