/* Local, rule-based observations. Speaker labels are user supplied, not identity checks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScamShieldConversation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const credential = /\b(?:send|share|give|provide|forward|enter|type|reply with|tell me|confirm|verify|submit)\b[^.!?;]{0,95}\b(?:password|passcode|one[- ]time code|otp|security code|verification code|login details|sign[- ]in details)\b|\b(?:password|passcode|one[- ]time code|otp|security code|verification code|login details|sign[- ]in details)\b[^.!?;]{0,60}\b(?:required|needed)\b/i;
  const payment = /\b(?:send|pay|transfer|wire|settle|authori[sz]e|confirm)\b[^.!?;]{0,90}(?:£\s?\d[\d,.]*|\$\s?\d[\d,.]*|€\s?\d[\d,.]*|payment|money|bank details|card details|account number|fee|charge)\b|\b(?:payment|bank details|card details|fee|charge)\b[^.!?;]{0,55}\b(?:required|needed)\b/i;
  const approval = /\b(?:approve|authori[sz]e|allow|confirm)\b[^.!?;]{0,75}\b(?:login|sign[- ]?in|account|payment|request)\b|\b(?:login|sign[- ]?in|account|payment)\b[^.!?;]{0,75}\b(?:approval|approve|authori[sz]ation)\b/i;
  const denial = /\b(?:i|we)\s+(?:did\s+not|didn't|didnt|never|have not|haven't)\s+(?:request|ask for|approve|authori[sz]e|send|share|click|open|make|recognise|recognize)\b|\b(?:not|no)\s+(?:requested|authori[sz]ed|approved)\b/i;
  const protective = /\b(?:never|do not|don't|dont|avoid)\s+(?:ever\s+)?(?:share|send|give|enter|type|provide|click|open|follow|reply to)\b[^.!?;]{0,90}\b(?:password|passcode|code|otp|link|bank|account|payment|details|message)\b/i;
  const noVerification = /\b(?:do not|don't|dont|never)\s+(?:call|contact|check with|verify with|speak to)\s+(?:your|the|an?)?\s*(?:bank|organisation|organization|support|university|nhs|police|provider)\b/i;
  const quoteIntro = /\b(?:security[- ]awareness|security advice|training example|example (?:of a )?scam|quoted scam|scammers? (?:say|said|ask|asked|may|might))\b/i;
  const urgency = /\b(?:urgent(?:ly)?|immediately|act now|final warning|within\s+\d+|today|tonight|before\s+\d+|expires?|suspend|close)\b/i;

  function parseLine(raw, index) {
    const trimmed = raw.trim();
    const explicitQuote = /^>/.test(trimmed) || /^(?:quote|quoted|example)\s*:/i.test(trimmed);
    const content = trimmed.replace(/^>\s*/, '').replace(/^(?:quote|quoted|example)\s*:\s*/i, '');
    const match = content.match(/^([^:]{1,40}):\s*(.+)$/);
    return { index: index + 1, speaker: match ? match[1].trim() : 'Unlabelled', content: match ? match[2].trim() : content, explicitQuote };
  }

  function analyse(rawLines) {
    const observations = [];
    rawLines.forEach((raw, index) => {
      const { speaker, content, explicitQuote } = parseLine(raw, index);
      const clauses = content.split(/(?<=[.!?;])\s+|\s+but\s+/i).map(x => x.trim()).filter(Boolean);
      const lineIsAwareness = explicitQuote || quoteIntro.test(content);
      for (const excerpt of clauses) {
        const base = { index: index + 1, speaker, excerpt };
        const add = (name, explanation) => observations.push({ ...base, name, explanation });
        const clauseIsQuoted = lineIsAwareness || /^\s*[“"‘']/.test(excerpt) || /^\s*(?:this is|that is)\s+(?:an?\s+)?(?:example|scam|phishing)\b/i.test(excerpt);
        if (clauseIsQuoted) {
          if (credential.test(excerpt) || payment.test(excerpt) || approval.test(excerpt))
            add('Quoted or educational content', 'This excerpt is presented as a quotation or example, rather than a request to act.');
          continue;
        }
        if (denial.test(excerpt)) { add('Denial or refusal', 'This excerpt denies requesting or approving an action.'); continue; }
        if (noVerification.test(excerpt)) { add('Discourages independent verification', 'This excerpt tells the reader not to check with a trusted organisation.'); continue; }
        if (protective.test(excerpt)) { add('Protective advice', 'This excerpt tells the reader to avoid sharing information or following a link.'); continue; }
        let hasRequest = false;
        if (credential.test(excerpt)) {
          add('Credential disclosure request', 'This excerpt asks for a password, passcode or verification code.'); hasRequest = true;
        }
        if (payment.test(excerpt)) {
          add('Payment request', 'This excerpt asks for money or payment details.'); hasRequest = true;
        }
        if (approval.test(excerpt) && !credential.test(excerpt) && !payment.test(excerpt)) {
          add('Approval request', 'This excerpt asks for a login, account or payment approval.'); hasRequest = true;
        }
        if (hasRequest && urgency.test(excerpt))
          add('Pressure or deadline', 'This excerpt adds a time limit or pressure cue to the request.');
      }
    });
    return observations;
  }
  return { analyse };
});
