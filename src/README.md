# Griffin & Finch Tracker

## Directory structure

`core` is common Typescript code used by both Tracker and griffin.brave.com.

`finch_tracker` - NodeJS/TS console app to track seed changes. See https://github.com/brave/finch-data-private/#finch-tracker

`web` WebUI hosted on griffin.brave.com. It parses raw seed data and shows them in human readable format. Doesn't use any sophisticated backend, 100% code runs on the client side.

`test` is supporting code/data to use in tests

`proto` chromium protobuf files describing seed data format.

## Commands and actions

`npm run build` to build everything
`npm run lint -- --fix` run lint and try to fix all the problems
`npm run test` to run tests (also used in CI)

[deploy-to-production](https://github.com/brave/brave-variations/actions/workflows/deploy-to-production.yml) GH action to deploy a new version of griffin.brave.com

`npm run tracker -- <finch-data-private-checkout>` to run tracker app
