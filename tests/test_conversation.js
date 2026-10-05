const assert = require('node:assert/strict');
const { analyse } = require('../web/static/conversation.js');

function names(lines) { return analyse(lines).map(item => item.name); }

assert.deepEqual(names(['Me: I did not request a login.']), ['Denial or refusal']);
assert.deepEqual(
  names(['Bank: Do not call your bank. Send your verification code here.']),
  ['Discourages independent verification', 'Credential disclosure request']
);
assert.deepEqual(names(['Friend: We discussed the rent payment yesterday.']), []);
assert.deepEqual(names(['Security awareness: Scammers may say “Send your verification code”.']), ['Quoted or educational content']);
assert.deepEqual(names(['Trainer: Never share your verification code with anyone.']), ['Protective advice']);
assert.deepEqual(names(['Support: Approve this login immediately.']), ['Approval request', 'Pressure or deadline']);
assert.deepEqual(names(['Agent: Transfer £250 today.']), ['Payment request', 'Pressure or deadline']);

const exact = analyse(['Bank: Do not call your bank. Send your verification code here.']);
assert.equal(exact[0].excerpt, 'Do not call your bank.');
assert.equal(exact[1].excerpt, 'Send your verification code here.');
assert.equal(exact[1].speaker, 'Bank');
console.log('conversation tests passed');
