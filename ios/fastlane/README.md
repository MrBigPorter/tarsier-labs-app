## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios test

```sh
[bundle exec] fastlane ios test
```

Run all tests

### ios build_staging

```sh
[bundle exec] fastlane ios build_staging
```

Build Staging (Test flavor) — TestFlight Internal

### ios build_production

```sh
[bundle exec] fastlane ios build_production
```

Build Production — App Store or TestFlight External

### ios deploy_testflight_internal

```sh
[bundle exec] fastlane ios deploy_testflight_internal
```

Upload to TestFlight Internal (company testers)

### ios deploy_testflight_external

```sh
[bundle exec] fastlane ios deploy_testflight_external
```

Upload to TestFlight External Beta (invited testers)

### ios deploy_app_store

```sh
[bundle exec] fastlane ios deploy_app_store
```

Upload to App Store (human must submit for review manually)

### ios upload_dsyms

```sh
[bundle exec] fastlane ios upload_dsyms
```

Upload dSYMs to Sentry for crash symbolication

### ios production_pipeline

```sh
[bundle exec] fastlane ios production_pipeline
```

Full production pipeline: build → App Store → dSYM → Slack

### ios staging_pipeline

```sh
[bundle exec] fastlane ios staging_pipeline
```

Full staging pipeline: build → TestFlight Internal → dSYM → Slack

---

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
