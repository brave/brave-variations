# Brave Variations (Griffin)

Griffin is Brave's version of Google's Finch - A backend for Chromium's variation service. This repository contains resources to compile, publish and inspect the so called _seed_ file, which contains definitions for all variations.

See the [Wiki](<https://github.com/brave/brave-browser/wiki/Brave-Variations-(Griffin)>) to learn more about what variations are and how to use them for (1) staged rollouts, (2) parameter updates and (3) experiments.

## Overview

A continuous integration server (CI) serializes and signs the updated seed file before publishing it to a CDN endpoint at https://variations.brave.com/seed. To browse the contents of the seed file a dashboard is hosted at https://griffin.brave.com. The repo is organized as follows:

- `/crypto` contains a util to create key pairs and sign the seed file.
- `/seed` contains a deprecated JSON seed definition and serialisation code.
- `/src` contains the web dashboard to browse the seed contents, the tracker code to track seed changes and the current seed generator. See [src/README.md](src/README.md) for details.
- `/studies` contains the studies used to generate the seed.

## Git flow for `studies`

1. Run `npm install` after checking out the repository.
2. Create or modify a study file in `studies` directory, following the protobuf
   schema in [`src/proto/study.proto`](/src/proto/study.proto).
3. Run `npm run seed_tools lint -- --fix` and address found issues.
4. Create a Pull Request targeting the `main` branch.
5. Follow the PR instructions to verify that everything works as intended.

## Key Generation and Exchange

On initial deployment and subsequent key rotations a new key pair has to be generated. The public key is exchanged by patching the hard-coded public key bytes in [variations_seed_store.cc](https://source.chromium.org/chromium/chromium/src/+/main:components/variations/variations_seed_store.cc;l=54;drc=5e751800f8e981ee6a18db8a8fa00883a851ecf7):

1. Generate a key pair with `$ go run ./crypto/crypto_util.go keygen`.
2. Update the [patched public key](https://github.com/brave/brave-core/blob/e2ded454bd2153e8e1a46be7ae13bbd540cf0d6d/chromium_src/components/variations/variations_seed_store.cc#L44-L53) in brave-core.
3. Store the private key in a secure vault and ensure it is accessible by CI.

## Seed Serialization, Signing and Serving

The following steps are performed by CI to publish the updated seed file:

1. Run `$ npm run seed_tools create` to compile the protobuf.
2. Sign the seed file with `$ go run /crypto/crypto_util.go sign`.
3. Update the `X-Seed-Signature` response header.
4. Update the ETAG header with the contents of `serialnumber`.
5. Gzip the seed and set `Content-Encoding: gzip` response header.

Constraints:

- All studies are [one time randomized](https://source.chromium.org/chromium/chromium/src/+/main:base/metrics/field_trial.h;l=43;drc=60a72b0afdb415164c8f72cb0cada4317e4464a1).
- Platform and channel filters must be applied.
- Brave Ads studies must contain the substring "BraveAds" in their study name. Only one ads study with page visible side effects is allowed to run. Multiple studies without visible side effects can run simultanesouly.

## Some Notes on using variations in the Browser

- Studies only take effect after restarting the browser.
- Pull from staging endpoint with `--variations-server-url=https://variations.bravesoftware.com/seed`.
- Precedence rules for feature overrides (starting with highest precedence):
  - Flags via `brave://flags`
  - CLI overrides with `--disable-features="..." --enable-features="..."`, e.g. enable feature `FooBar` with parameters `param1=2` and `param3=4` via `--enable-features=FooBar:param1/2/param3/4`
  - Variations overrides as defined in the `seed`
  - hard-coded `base::feature` defaults
- Filter rules might include
  - Countries: The ISO country code is set in the `X-Country` response header and is inferred from the source IP by the CDN but can be faked with e.g. `--variations-override-country=US`
  - Channels: Use e.g. `--fake-variations-channel=beta` to override the channel of your build.
- To verify if the browser signed up for any studies eight augment logs with `--vmodule="*/variations/*"=1` or inspect `brave://version/?show-variations-cmd` under the "Variations" section.
- for logging add `--vmodule="*/variations/*"=1` or higher

## Dashboard

To build the dashboard:

1. Install dependencies `$ npm install`
2. Bundle resources `$ npm run build`
