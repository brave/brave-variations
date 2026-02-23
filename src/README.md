# Griffin & Finch Tracker & Seed Tools

## Directory structure

`core` is common Typescript code used by both Tracker and griffin.brave.com.

`finch_tracker` - NodeJS/TS console app to track seed changes. See https://github.com/brave/finch-data-private/#finch-tracker

`proto` chromium protobuf files describing seed data format.

`seed_tools` seed generator and related tools to create the seed from `/studies` directory.

`test` is supporting code/data to use in tests.

`web` WebUI hosted on griffin.brave.com. It parses raw seed data and shows them in human readable format. Doesn't use any sophisticated backend, 100% code runs on the client side.

## Commands and actions

`pnpm build` to build everything
`pnpm lint -- --fix` run lint and try to fix all the problems
`pnpm test` to run tests (also used in CI)

[deploy-to-production](https://github.com/brave/brave-variations/actions/workflows/deploy-to-production.yml) GH action to deploy a new version of griffin.brave.com

`pnpm tracker -- <finch-data-private-checkout>` to run tracker app
