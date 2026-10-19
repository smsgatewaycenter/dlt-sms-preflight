const assert = require('node:assert');
const { render, matches, segments, parseTemplate } = require('./dltPreflight');

const otp = '{#numeric#} is your OTP for login to ACME. Valid for 10 minutes. Do not share it. - ACME';

// 1. Good OTP renders.
const msg = render(otp, ['482913']);
assert.strictEqual(msg, '482913 is your OTP for login to ACME. Valid for 10 minutes. Do not share it. - ACME');

// 2. A formatted amount in a numeric slot is caught.
const debit = 'Rs {#numeric#} debited from your ACME wallet. Ref {#alphanumeric#}. - ACME';
assert.throws(() => render(debit, ['5,000.00', 'TXN88231']), /needs digits only/);
assert.strictEqual(render(debit, ['5000', 'TXN88231']), 'Rs 5000 debited from your ACME wallet. Ref TXN88231. - ACME');

// 3. Wrong number of values.
assert.throws(() => render(debit, ['5000']), /2 variables, got 1/);

// 4. URL host not whitelisted.
const track = 'Your order {#alphanumeric#} has shipped. Track: {#url#} - ACME';
assert.throws(() => render(track, ['ORD123', 'https://bit.ly/x'], { allowedHosts: ['acme.in'] }), /not on your whitelist/);
assert.ok(render(track, ['ORD123', 'https://acme.in/t/ORD123'], { allowedHosts: ['acme.in'] }));

// 5. Untyped legacy slot flagged.
assert.strictEqual(parseTemplate('Hi {#var#}, welcome').problems.length, 1);

// 6. Someone "improved" the copy after approval: mismatch detected.
assert.strictEqual(matches(otp, msg), true);
assert.strictEqual(matches(otp, msg.replace('Do not share it.', 'Please do not share it.')), false);
assert.strictEqual(matches(otp, msg.replace('10 minutes', '10 mins')), false);

// 7. Segment counting.
assert.deepStrictEqual(segments('a'.repeat(160)), { encoding: 'GSM-7', units: 160, segments: 1 });
assert.deepStrictEqual(segments('a'.repeat(161)), { encoding: 'GSM-7', units: 161, segments: 2 });
assert.strictEqual(segments('Price: €10').units, 11); // € costs two units
assert.strictEqual(segments('Your OTP is 1234 ✅').encoding, 'UCS-2');
assert.strictEqual(segments('नमस्ते '.repeat(10)).segments, 1); // 70 UTF-16 units
assert.strictEqual(segments('नमस्ते '.repeat(10) + 'a').segments, 2);

// 8. The smart quote trap: a curly apostrophe forces UCS-2.
assert.strictEqual(segments("Don't share").encoding, 'GSM-7');
assert.strictEqual(segments('Don’t share').encoding, 'UCS-2');

console.log('all tests passed');
