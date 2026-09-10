# Design QA — Sale Invoice Configuration Lines

## Reference

The supplied invoice reference shows one service/configuration row containing
multiple device serial numbers, with returned billing displayed per serial.

## Implemented comparison

- One line is created per make, model, configuration, and price.
- The preview prints the configuration once, then `S/N:` entries below it.
- Returned serials retain their own date range and part-billing amount.

## Verification status

final result: blocked

The frontend and backend builds pass and the grouping test passes. Visual
browser verification is blocked because no browser surface is available in
this session.
