# dlt-sms-preflight

Check an SMS against its registered DLT template **before** you send it to an Indian number.

Indian operators drop any SMS that doesn't match its registered DLT template. Since TRAI's
[direction of 18 Nov 2025](https://trai.gov.in/sites/default/files/2025-11/PR_No.133_of_2025.PDF),
each variable must also be tagged with the type of value it holds. This module catches most
mismatches in your own code, so you can run it in CI.

No dependencies. Node 18+.

## What it checks

- Each value fits its tag: `{#numeric#}`, `{#alphanumeric#}`, `{#url#}`, `{#urlott#}`, `{#cbn#}`, `{#email#}`
- Untyped legacy `{#var#}` slots, which need re-registering
- URL hosts against your whitelist
- The fixed text of an already-built message, character for character
- GSM-7 vs UCS-2 encoding and segment count (one curly apostrophe can double your cost)

## Usage

```js
const { render, matches, segments } = require('./dltPreflight');

const tpl = 'Rs {#numeric#} debited from your ACME wallet. Ref {#alphanumeric#}. - ACME';

render(tpl, ['5000', 'TXN88231']);      // returns the message
render(tpl, ['5,000.00', 'TXN88231']);  // throws: Slot 1 {#numeric#} needs digits only

matches(tpl, someMessageFromYourCRM);   // true or false
segments('Don’t share');                // { encoding: 'UCS-2', units: 11, segments: 1 }
```

## Run the tests

```sh
node test.js
```

## Limits

This is a pre-flight check, not the operator's scrubbing algorithm. The value patterns in
`TAG_RULES` and `MAX_VAR_LENGTH` are approximations, so set them to what your DLT portal enforces.
It can't see your DLT registration, so it won't catch a wrong header, a wrong category or an
unapproved template.

More on the tagging change: [SMS Gateway Center's notes on mandatory variable tagging](https://www.smsgatewaycenter.com/blog/trai-dlt-mandatory-variable-tagging-sms-templates/).

## License

MIT
