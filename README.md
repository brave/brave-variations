# ray-variations
Based on [brave-variations](https://github.com/brave/brave-variations)

# Basic concepts

The variations service consists of Chromium’s browser component and a server, which hosts a configuration file - also called seed file - containing definitions for all variations. Variations break down into studies, each containing a list of experiments. Each experiment can be thought of as a set of enabled and/or disabled features with parameters.

The browser pulls a new version of the seed file, once on startup and subsequently every 30 minutes. The seed file is then parsed internally by Chromium’s [variation service](https://source.chromium.org/chromium/chromium/src/+/master:components/variations/service/variations_service.h).

## Studies

A study is a set of experiments conducted on clients according to filter rules concerning country, platform and version. In the case of an A/B test the experiment can be thought of as the group that the browser signs-up to with a defined probability, e.g. "Group A" and "Group B" with both a 50% chance of being selected. All studies are located in the studies directory within this repository. Each study should have its own file and the file name should match the name of the study. 

Studies can contain a filter section that allows you to apply a filter to only a subset of users.
The filters allows you to set the following:
- min_version - Minimum chromium version
- max_version - Maximum chromium version
- channel - A list of release channels the study should be applied for
- platform - A list of platforms the study should applied for
- country - List of lowercase ISO 3166-1 alpha-2 country codes that will receive this study. The browser determines it country by the X-Country header that get's set by the Ray-Variations server hosted on Heim.

A full list of filters can be found [here](https://github.com/raybrowser/ray-variations/blob/380b933de05811efe3d22a8d88c364be479ec0a7/src/proto/study.proto#L298).

## Experiments

An experiment (think “group”) is a set of features and parameters that is enabled or disabled with a given sign-up probability. Each client independently “flips a biased coin” to determine whether it is eligible for an experiment. “Coin flips” are implemented via Chromium’s [field trials](https://source.chromium.org/chromium/chromium/src/+/master:base/metrics/field_trial.h). The probability is based on the assigned weight each experiment. Meaning if one experiment has a weight of 30 and another experiment a weight of 70 then there will be 30% chance of the first experiment being selected and 70% chance the other experiment is selected. Only one experiment will be enabled per study. These weights can be anything, meaning you can have two experiment one with the weight of 2 and another with a weight of 5 this means the probability of the first experiment to be enabled would be 2/7 or ~28.57% and 5/7 or ~71.43% for the second experiment. It is however recommended that all the weight of a study adds up to 100 just to make it easier to reason about.

## Features

A feature is the underlying abstraction that links code on the client to studies from the variations service. It is Chromium’s implementation of [feature flags](https://en.wikipedia.org/wiki/Feature_toggle). A feature can have an arbitrary number of associated parameters in the form of key/value pairs.

# Deploying new variations

- Deploying new variations should first be done with a filter on the channel to allow nightly builds to be the only affected release channel. 
- If the change is tied to a minimum or maximum version then this filter should be applied in order to not effect other versions of the browser. 
- This is in order to make sure the variation works as expected and doesn't unexpectedly break other release channels such as RC or Shipping. 
- Once the variation has been determined to work then it should have the channel in the filter section changed and be re-deployed. 
- Once this is done the variation should be verified to be active by faking the channel.

Deploying a variation that should only be applied to a new version of the browser can be achieved by setting the minimum version equal to the new version of the browser. This way it can be tested in dev, nightly and RC before it's released to shipping.

## Some Notes on using variations in the Browser

- Studies only take effect after restarting the browser.
- Pull from staging endpoint with `--variations-server-url=https://dev.ray.nor2.io/v1/variations/seed`.
- Precedence rules for feature overrides (starting with highest precedence):
    - Flags via `brave://flags`
    - CLI overrides with `--disable-features="..." --enable-features="..."`, e.g. enable feature `FooBar` with parameters `param1=2` and `param3=4` via `--enable-features=FooBar:param1/2/param3/4`
    - Variations overrides as defined in the `seed`
    - hard-coded `base::feature` defaults
- Filter rules might include
    - Countries: The ISO country code is set in the `X-Country` response header and is inferred from the source IP by the CDN but can be faked with e.g. `--variations-override-country=SE
    - Channels: Use e.g. `--fake-variations-channel=shipping` to override the channel of your build.
- To verify if the browser signed up for any studies eight augment logs with `--vmodule="*/variations/*"=1` or inspect `chrome://version/?show-variations-cmd` under the "Variations" section.
- for logging add `--vmodule="*/variations/*"=1` or higher

## Overview

A continuous integration server (CI) serializes and signs the updated seed file before publishing it to a CDN endpoint at [https://dev.ray.nor2.io/v1/variations/seed](https://dev.ray.nor2.io/v1/variations/seed). The repo is organized as follows:

- `/crypto` contains a util to create key pairs and sign the seed file.
- `/seed` contains a deprecated JSON seed definition and serialisation code.
- `/src` contains the web dashboard to browse the seed contents, the tracker code to track seed changes and the current seed generator. See [src/README.md](https://github.com/brave/brave-variations/blob/main/src/README.md) for details. - NOTE: This is currently not used for Ray.
- `/studies` contains the studies used to generate the seed.

## Git flow for `studies`

1. Run `npm install` after checking out the repository.
2. Create or modify a study file in `studies` directory, following the protobuf schema in [`src/proto/study.proto`](https://github.com/raybrowser/ray-variations/blob/main/src/proto/study.proto).
3. Run `npm run seed_tools lint -- --fix` and address found issues.
4. Create a Pull Request targeting the `main` branch.
5. Follow the PR instructions to verify that everything works as intended.

# Below steps are already done in CI and handled in the ray-variations backend
## Key Generation and Exchange

On initial deployment and subsequent key rotations a new key pair has to be generated. The public key is exchanged by patching the hard-coded public key bytes in [variations_seed_store.cc](https://source.chromium.org/chromium/chromium/src/+/main:components/variations/variations_seed_store.cc;l=54;drc=5e751800f8e981ee6a18db8a8fa00883a851ecf7):

1. Generate a key pair with `$ go run ./crypto/crypto_util.go keygen`.
2. Update the [patched public key](https://github.com/raybrowser/chromium-ray-poc/blob/2aa87f3efb6aab9bcd02e7e7a68391ff393ad843/components/variations/variations_seed_store.cc#L54) in the ray repository.
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
