// Public edition. Copyright (c) 2026 Rachael Quisel.
const BOOKING_TITLE_PREFIXES = ['Airbnb:', 'VRBO:', 'Lodgify:', 'Direct:'];
const CLEANING_TITLE_MARKERS = [
  /^(?:\[CASCADE EXHAUSTED\]\s*)?Cleaner[:\s]/i,
  /\sClean-/i,
  /Clean -/i,
];

function dailyCleaningCheck() {
  if (!RUN_ENABLED || CALENDAR_ID === 'ADD_YOUR_CALENDAR_ID' || OWNER_EMAIL.endsWith('@example.invalid')) {
    throw new Error('Cleaning coverage is disabled until you configure and enable your private test project.');
  }
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) throw new Error('Cannot access calendar ' + CALENDAR_ID);

  const start = stripTime(new Date());
  const end = addCalendarDays(start, LOOKAHEAD_DAYS);

  const events = cal.getEvents(start, end);
  const coverageWindow = coverageScanWindow(start, end, COVERAGE_WINDOW_DAYS);
  const coverageEvents = cal.getEvents(coverageWindow.start, coverageWindow.end);
  const bookings = events.filter(isBookingEvent).sort((a, b) => a.getStartTime() - b.getStartTime());
  const cleaningEvents = events.filter(isCleaningEvent);

  const bookingShapes = bookings.map(b => ({
    guest: extractGuestName(b.getTitle()),
    checkIn: b.getStartTime(),
    checkOut: b.getEndTime(),
  }));
  const cleaningShapes = cleaningEvents.map(e => ({
    id: e.getId(),
    date: e.getStartTime(),
    title: e.getTitle(),
  }));
  const midStays = findMidStayCleanings(bookingShapes, cleaningShapes);
  const deleted = [];
  const preservedOverrides = [];
  const deletedIds = new Set();
  midStays.forEach(m => {
    const event = cleaningEvents.find(e => e.getId() === m.cleaningId);
    if (!event) return;
    const dateIso = isoDate(event.getStartTime());
    const title = event.getTitle();
    const attendeeEmails = event.getGuestList().map(g => g.getEmail());
    if (isManualOverride(attendeeEmails, event.getStartTime())) {
      preservedOverrides.push({ date: dateIso, title: title, reason: 'mid-stay but manual override' });
      return;
    }
    event.deleteEvent();
    deletedIds.add(m.cleaningId);
    deleted.push({
      date: dateIso,
      title: title,
      insideStayOf: m.bookingGuest,
      bookingStart: isoDate(m.bookingStart),
      bookingEnd: isoDate(m.bookingEnd),
    });
  });
  if (deletedIds.size > 0) {
    for (let i = cleaningEvents.length - 1; i >= 0; i--) {
      if (deletedIds.has(cleaningEvents[i].getId())) cleaningEvents.splice(i, 1);
    }
  }

  const dedupCandidates = findLegacyDuplicates(cleaningShapes);
  const dedupedLegacy = [];
  const dedupedIds = new Set();
  dedupCandidates.forEach(d => {
    const event = cleaningEvents.find(e => e.getId() === d.cleaningId);
    if (!event) return;
    event.deleteEvent();
    dedupedIds.add(d.cleaningId);
    dedupedLegacy.push({
      date: isoDate(event.getStartTime()),
      title: d.title,
      keptTitle: d.canonicalTitle,
    });
  });
  const remainingCleaningIds = new Set(dedupedLegacy.length
    ? cleaningEvents.filter(e => !dedupCandidates.find(d => d.cleaningId === e.getId())).map(e => e.getId())
    : cleaningEvents.map(e => e.getId()));
  for (let i = cleaningEvents.length - 1; i >= 0; i--) {
    if (!remainingCleaningIds.has(cleaningEvents[i].getId())) cleaningEvents.splice(i, 1);
  }

  const reassigned = [];
  const exhausted = [];
  const now = new Date();
  cleaningEvents.forEach(e => {
    if (e.getStartTime() < now) return; // skip past events
    const guestList = e.getGuestList();
    const attendeeEmails = guestList.map(g => g.getEmail());
    let description = e.getDescription() || '';
    const attendeeStates = attendeeStatesFromEvent(e);
    if (shouldClearExhaustedPrefix(e.getTitle(), attendeeStates, description)) {
      const repaired = clearFalseExhaustionState(
        e.getTitle(),
        description,
        coveredCleanerName(attendeeStates, description)
      );
      e.setTitle(repaired.title);
      if (repaired.description !== description) e.setDescription(repaired.description);
      description = repaired.description;
    }
    if (hasManualConfirmation(description)) return;

    const decision = decideCascadeAction(attendeeStates, e.getStartTime());
    const declinedEmails = declinedCleanerEmailsToRemove(attendeeStates);
    const removedNames = declinedEmails
      .map(email => findCleanerByEmail(email))
      .filter(cleaner => cleaner !== null)
      .map(cleaner => cleaner.name);
    declinedEmails.forEach(email => e.removeGuest(email));

    let updatedDescription = description;
    if (removedNames.length > 0 && decision.action !== 'reassign') {
      const cleanupNote = '\n\n[DECLINED-REMOVED ' + isoDate(now) + '] ' +
        removedNames.join(', ') + ' declined and ' +
        (removedNames.length === 1 ? 'was' : 'were') + ' removed from the event.';
      updatedDescription += cleanupNote;
      e.setDescription(updatedDescription);
    }

    const hasCascadeHistory = /\[CASCADE \d{4}-\d{2}-\d{2}\]/.test(description);
    if (isManualOverride(attendeeEmails, e.getStartTime()) && !hasCascadeHistory) return;

    if (decision.action === 'reassign') {
      if (decision.to.email) e.addGuest(decision.to.email);
      const cascadeNote = '\n\n[CASCADE ' + isoDate(now) + '] ' + decision.from.name +
        ' declined and was removed — invited ' + decision.to.name + '.';
      updatedDescription += cascadeNote;
      e.setDescription(updatedDescription);
      const oldTitle = e.getTitle();
      const newTitle = oldTitle.replace(
        'Cleaner: ' + decision.from.name,
        'Cleaner: ' + decision.to.name
      );
      if (newTitle !== oldTitle) e.setTitle(newTitle);
      sendNotification(decision.to,
        'Rental cleaning ' + isoDate(e.getStartTime()),
        'You\'ve been invited to clean Rental on ' + isoDate(e.getStartTime()) +
        ' (11am-4pm) — please accept or decline the calendar invite.');
      reassigned.push({
        date: isoDate(e.getStartTime()),
        from: decision.from.name,
        to: decision.to.name,
        title: newTitle,
      });
    } else if (decision.action === 'exhausted') {
      const oldTitle = e.getTitle();
      if (!oldTitle.startsWith('[CASCADE EXHAUSTED]')) {
        e.setTitle('[CASCADE EXHAUSTED] ' + oldTitle);
      }
      if (!shouldSendExhaustedAlert(updatedDescription)) return;
      const isOwnerLast = decision.from && decision.from.name === 'Owner';
      const alertSubject = isOwnerLast
        ? 'Rental cleaning needs coverage: ' + isoDate(e.getStartTime())
        : '⚠ Rental cascade exhausted: ' + isoDate(e.getStartTime());
      const alertBody = isOwnerLast
        ? 'You declined the cleaning on ' + isoDate(e.getStartTime()) + ' ("' + oldTitle +
          '") after the rest of the chain dropped out. The cascade is exhausted. Find a backup or move the date.'
        : 'The full cascade dropped out for ' + isoDate(e.getStartTime()) + ' ("' + oldTitle +
          '"). Last out: ' + decision.from.name + ' (declined)' +
          '. Please assign manually.';
      sendNotification(OWNER, alertSubject, alertBody);
      e.setDescription(updatedDescription + '\n\n[EXHAUSTED-ALERTED ' + isoDate(now) + ']');
      exhausted.push({ date: isoDate(e.getStartTime()), title: oldTitle, lastDeclined: decision.from.name });
    }
  });

  const vrboPings = [];
  bookings.forEach(b => {
    const title = b.getTitle();
    if (!title.startsWith('VRBO:')) return;
    const desc = b.getDescription() || '';
    if (/\[VRBOPINGED/.test(desc)) return; // already pinged
    const ageHours = (now.getTime() - b.getDateCreated().getTime()) / (60 * 60 * 1000);
    if (ageHours >= 24 * 14) return; // booking is older than 2 weeks — skip backfill noise
    const guest = extractGuestName(title);
    const checkin = Utilities.formatDate(b.getStartTime(), TIMEZONE, 'EEE MMM d');
    sendNotification(OWNER,
      'New VRBO booking — access review',
      'New VRBO booking: ' + guest + ' checking in ' + checkin +
      '. Review guest access in your lock application according to your access policy.');
    b.setDescription(desc + '\n\n[VRBOPINGED ' + isoDate(now) + ']');
    vrboPings.push({ guest: guest, checkin: checkin });
  });

  const created = [];
  const skipped = [];
  const flagged = [];

  const eligibleBookings = bookings.filter(b =>
    isCheckoutInOwnedWindow(b.getEndTime(), start, end)
  );
  const eligibleCheckoutDates = eligibleBookings.map(b => stripTime(b.getEndTime()));
  const bookingsToCover = uniqueCheckoutIndexes(eligibleCheckoutDates)
    .map(index => eligibleBookings[index]);
  const availableCleaningDates = coverageEvents
    .filter(isCleaningEvent)
    .filter(e => !deletedIds.has(e.getId()) && !dedupedIds.has(e.getId()))
    .map(e => e.getStartTime());
  const coverageMatches = matchCleaningCoverage(
    bookingsToCover.map(b => stripTime(b.getEndTime())),
    availableCleaningDates,
    COVERAGE_WINDOW_DAYS
  );

  bookingsToCover.forEach((b, bookingIndex) => {
    const departing = extractGuestName(b.getTitle());
    const checkout = stripTime(b.getEndTime());
    const checkoutIso = isoDate(checkout);

    if (coverageMatches[bookingIndex] !== -1) {
      skipped.push({ date: checkoutIso, guest: departing });
      return;
    }

    const cleaner = pickCleaner(checkout);
    const next = findNextCheckIn(bookings, checkout);
    createCleaningEvent(cal, checkout, cleaner, departing, next);

    const entry = { date: checkoutIso, departing: departing, cleaner: cleaner.name, next: next };
    if (!cleaner.email) {
      entry.needsAttention = 'No email on file for ' + cleaner.name + ' — invite not sent';
      flagged.push(entry);
    }
    created.push(entry);
  });

  sendSummary(created, skipped, flagged, deleted, preservedOverrides, reassigned, exhausted, dedupedLegacy);
}

function isCoveredByWindow(checkoutDate, cleaningDateIsoSet, windowDays) {
  for (let offset = -windowDays; offset <= windowDays; offset++) {
    const d = new Date(checkoutDate);
    d.setDate(d.getDate() + offset);
    if (cleaningDateIsoSet.has(isoDate(d))) return true;
  }
  return false;
}

function matchCleaningCoverage(checkoutDates, cleaningDates, windowDays) {
  const matches = checkoutDates.map(() => -1);
  const usedCleaningIndexes = new Set();
  const usedCleaningIsoDates = new Set();

  checkoutDates.forEach((checkoutDate, checkoutIndex) => {
    const checkoutIso = isoDate(checkoutDate);
    const cleaningIndex = cleaningDates.findIndex((cleaningDate, index) =>
      !usedCleaningIndexes.has(index) &&
      !usedCleaningIsoDates.has(isoDate(cleaningDate)) &&
      isoDate(cleaningDate) === checkoutIso
    );
    if (cleaningIndex === -1) return;
    matches[checkoutIndex] = cleaningIndex;
    usedCleaningIndexes.add(cleaningIndex);
    usedCleaningIsoDates.add(checkoutIso);
  });

  checkoutDates.forEach((checkoutDate, checkoutIndex) => {
    if (matches[checkoutIndex] !== -1) return;
    for (let offset = -windowDays; offset <= windowDays; offset++) {
      if (offset === 0) continue;
      const candidateIso = isoDate(addCalendarDays(checkoutDate, offset));
      const cleaningIndex = cleaningDates.findIndex((cleaningDate, index) =>
        !usedCleaningIndexes.has(index) &&
        !usedCleaningIsoDates.has(isoDate(cleaningDate)) &&
        isoDate(cleaningDate) === candidateIso
      );
      if (cleaningIndex === -1) continue;
      matches[checkoutIndex] = cleaningIndex;
      usedCleaningIndexes.add(cleaningIndex);
      usedCleaningIsoDates.add(candidateIso);
      break;
    }
  });

  return matches;
}

function uniqueCheckoutIndexes(checkoutDates) {
  const seenDates = new Set();
  const indexes = [];
  checkoutDates.forEach((checkoutDate, index) => {
    const checkoutIso = isoDate(checkoutDate);
    if (seenDates.has(checkoutIso)) return;
    seenDates.add(checkoutIso);
    indexes.push(index);
  });
  return indexes;
}

function isCheckoutInOwnedWindow(checkoutDate, startInclusive, endExclusive) {
  const checkout = stripTime(checkoutDate).getTime();
  return checkout >= stripTime(startInclusive).getTime() &&
    checkout < stripTime(endExclusive).getTime();
}

function coverageScanWindow(startInclusive, endExclusive, windowDays) {
  const scanStart = addCalendarDays(startInclusive, -windowDays);
  const scanEnd = addCalendarDays(endExclusive, windowDays);
  return { start: scanStart, end: scanEnd };
}

function addCalendarDays(date, days) {
  const result = stripTime(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isCanonicalCleaningTitle(title) {
  return /^Cleaner:\s+\w+\s+\/\s+Guest:/.test(title || '');
}

function isLegacyCleaningTitle(title) {
  if (!title) return false;
  if (isCanonicalCleaningTitle(title)) return false;
  if (/\sClean-/i.test(title)) return true;          // "CleanerTwo Clean- Guest"
  if (/\sClean -/i.test(title)) return true;         // "CleanerTwo Clean - Guest"
  if (/^Cleaner\s+\w+\s+-\s+/i.test(title)) return true; // "Cleaner CleanerTwo - Guest"
  return false;
}

function findLegacyDuplicates(cleanings) {
  const byDate = {};
  cleanings.forEach(c => {
    const key = isoDate(c.date);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(c);
  });
  const out = [];
  for (const date in byDate) {
    const group = byDate[date];
    if (group.length <= 1) continue;
    const canonical = group.find(c => isCanonicalCleaningTitle(c.title));
    if (!canonical) continue; // no canonical to anchor to; leave alone
    group.forEach(c => {
      if (c.id !== canonical.id && isLegacyCleaningTitle(c.title)) {
        out.push({
          cleaningId: c.id,
          cleaningDate: c.date,
          title: c.title,
          canonicalTitle: canonical.title,
        });
      }
    });
  }
  return out;
}

function findMidStayCleanings(bookings, cleanings) {
  const out = [];
  for (const c of cleanings) {
    const cDay = stripTime(c.date);
    for (const b of bookings) {
      const bIn = stripTime(b.checkIn);
      const bOut = stripTime(b.checkOut);
      if (cDay.getTime() > bIn.getTime() && cDay.getTime() < bOut.getTime()) {
        out.push({
          cleaningId: c.id,
          cleaningDate: cDay,
          cleaningTitle: c.title || null,
          bookingGuest: b.guest,
          bookingStart: bIn,
          bookingEnd: bOut,
        });
        break; // one match per cleaning is sufficient
      }
    }
  }
  return out;
}

function decideCascadeAction(attendeeStates, eventDate) {
  const chain = cascadeChainFor(eventDate);
  const stateByEmail = {};
  attendeeStates.forEach(s => {
    if (s.email) stateByEmail[s.email.toLowerCase()] = s;
  });

  let lastDeclined = null;
  let lastVia = null;
  for (let i = 0; i < chain.length; i++) {
    const cleaner = chain[i];
    if (!cleaner.email) continue; // cleaner has no email (e.g., SundayCleaner) — skip in attendee-based logic
    const state = stateByEmail[cleaner.email.toLowerCase()];
    if (!state) {
      if (lastDeclined) return { action: 'reassign', from: lastDeclined, to: cleaner, via: lastVia };
      continue;
    }
    if (state.responseStatus === 'declined') {
      lastDeclined = cleaner;
      lastVia = 'declined';
      continue;
    }
    return { action: 'noop' };
  }

  if (lastDeclined) return { action: 'exhausted', from: lastDeclined, via: lastVia };
  return { action: 'noop' };
}

function declinedCleanerEmailsToRemove(attendeeStates) {
  return attendeeStates
    .filter(s => s.responseStatus === 'declined' && findCleanerByEmail(s.email))
    .map(s => s.email);
}

function hasManualConfirmation(description) {
  return /\[CONFIRMED /.test(description || '');
}

function shouldSendExhaustedAlert(description) {
  return !/\[EXHAUSTED-ALERTED /.test(description || '');
}

function shouldClearExhaustedPrefix(title, attendeeStates, description) {
  if (!(title || '').startsWith('[CASCADE EXHAUSTED]')) return false;
  if (hasManualConfirmation(description)) return true;
  return attendeeStates.some(state =>
    findCleanerByEmail(state.email) && state.responseStatus !== 'declined'
  );
}

function coveredCleanerName(attendeeStates, description) {
  const confirmedMatch = (description || '').match(
    /\[CONFIRMED \d{4}-\d{2}-\d{2}\s+([^\]]+)\]/
  );
  if (confirmedMatch) {
    const confirmedName = confirmedMatch[1].trim().toLowerCase();
    for (const key in CLEANERS) {
      if (CLEANERS[key].name.toLowerCase() === confirmedName) {
        return CLEANERS[key].name;
      }
    }
  }
  const accepted = attendeeStates.find(state =>
    state.responseStatus === 'accepted' && findCleanerByEmail(state.email)
  );
  if (accepted) return findCleanerByEmail(accepted.email).name;
  const active = attendeeStates.find(state =>
    state.responseStatus !== 'declined' && findCleanerByEmail(state.email)
  );
  return active ? findCleanerByEmail(active.email).name : null;
}

function clearFalseExhaustionState(title, description, cleanerName) {
  let repairedDescription = (description || '')
    .split('\n')
    .filter(line => !/^\[EXHAUSTED-ALERTED \d{4}-\d{2}-\d{2}\]$/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  let repairedTitle = (title || '').replace(/^\[CASCADE EXHAUSTED\]\s*/, '');
  if (cleanerName) {
    repairedTitle = repairedTitle.replace(
      /Cleaner:\s*[^/]+(?=\s*\/\s*Guest:)/,
      'Cleaner: ' + cleanerName + ' '
    );
    repairedDescription = repairedDescription.replace(
      /^Cleaner:\s*[^\n]+/m,
      'Cleaner: ' + cleanerName
    );
  }
  return {
    title: repairedTitle,
    description: repairedDescription,
  };
}

function attendeeStatesFromEvent(event) {
  const guestList = event.getGuestList();
  const description = event.getDescription() || '';
  const createdAt = event.getDateCreated();

  const cascadeInvites = {}; // cleanerName → latest Date when they were cascade-invited
  const re = /\[CASCADE (\d{4}-\d{2}-\d{2})\][^—–-]*[—–-]\s*invited\s+(\w+)/g;
  let m;
  while ((m = re.exec(description)) !== null) {
    const d = new Date(m[1] + 'T00:00:00');
    if (!cascadeInvites[m[2]] || d > cascadeInvites[m[2]]) {
      cascadeInvites[m[2]] = d;
    }
  }

  return guestList.map(g => {
    let status = 'needsAction';
    try {
      const gs = g.getGuestStatus();
      if (gs === CalendarApp.GuestStatus.YES) status = 'accepted';
      else if (gs === CalendarApp.GuestStatus.NO) status = 'declined';
      else if (gs === CalendarApp.GuestStatus.MAYBE) status = 'tentative';
    } catch (e) {
    }
    const email = g.getEmail();
    const cleaner = findCleanerByEmail(email);
    const invitedAt = cleaner && cascadeInvites[cleaner.name]
      ? cascadeInvites[cleaner.name]
      : createdAt;
    return { email: email, responseStatus: status, invitedAt: invitedAt };
  });
}

function cascadeChainFor(date) {
  return date.getDay() === 0
    ? [CLEANERS.sundayCleaner, CLEANERS.owner]
    : [CLEANERS.firstCleaner, CLEANERS.secondCleaner, CLEANERS.owner];
}

function findCleanerByEmail(email) {
  if (!email) return null;
  const e = email.toLowerCase();
  for (const key in CLEANERS) {
    const c = CLEANERS[key];
    if (c.email && c.email.toLowerCase() === e) return c;
  }
  return null;
}

function isManualOverride(attendeeEmails, eventDate) {
  const chain = cascadeChainFor(eventDate);
  const chainEmails = new Set(chain.filter(c => c.email).map(c => c.email.toLowerCase()));
  const invitedCleaners = attendeeEmails
    .map(e => findCleanerByEmail(e))
    .filter(c => c !== null && c.email);

  for (const c of invitedCleaners) {
    if (!chainEmails.has(c.email.toLowerCase())) return true;
  }

  if (invitedCleaners.length === 1 && invitedCleaners[0].name === 'Owner') {
    return true;
  }

  return false;
}

function parseBookingTitle(title) {
  const t = (title || '').trim();
  for (const prefix of BOOKING_TITLE_PREFIXES) {
    if (t.startsWith(prefix)) {
      const source = prefix.replace(':', '');
      const rest = t.slice(prefix.length).trim();
      const firstWord = rest.split(/\s+/)[0];
      return { source: source, guest: firstWord || rest };
    }
  }
  return null;
}

function isBookingEvent(e) {
  return parseBookingTitle(e.getTitle()) !== null;
}

function isCleaningEvent(e) {
  const t = e.getTitle() || '';
  return CLEANING_TITLE_MARKERS.some(rx => rx.test(t));
}

function extractGuestName(bookingTitle) {
  const parsed = parseBookingTitle(bookingTitle);
  return parsed ? parsed.guest : bookingTitle;
}

function pickCleaner(checkoutDate) {
  return cascadeChainFor(checkoutDate)[0];
}

function findNextCheckIn(bookings, cleaningDate) {
  const cleaningTs = cleaningDate.getTime();
  for (const b of bookings) {
    const start = b.getStartTime();
    const startDay = stripTime(start);
    if (startDay.getTime() < cleaningTs) continue;
    const guest = extractGuestName(b.getTitle());
    const gapDays = Math.round((startDay.getTime() - cleaningTs) / (24 * 60 * 60 * 1000));
    return { guest: guest, startTime: start, gapDays: gapDays };
  }
  return null;
}

function arrivingGuestLine(next) {
  if (next === null) return 'Guest checking in: TBD — no booking currently scheduled after this date.';
  const arriveTime = Utilities.formatDate(next.startTime, TIMEZONE, 'h:mm a');
  if (next.gapDays === 0) {
    return 'Guest checking in: ' + next.guest + ' — TODAY at ' + arriveTime + '\n' +
           'SAME-DAY TURNOVER: must be done by 4:00 PM.';
  }
  if (next.gapDays === 1) {
    return 'Guest checking in: ' + next.guest + ' — TOMORROW at ' + arriveTime + '.';
  }
  const dateStr = Utilities.formatDate(next.startTime, TIMEZONE, 'EEE MMM d');
  return 'Guest checking in: ' + next.guest + ' — ' + dateStr + ' at ' + arriveTime + ' (' + next.gapDays + ' days after cleaning).';
}

function createCleaningEvent(cal, checkoutDate, cleaner, departingGuest, next) {
  const start = new Date(checkoutDate);
  start.setHours(CLEANING_START_HOUR, 0, 0, 0);
  const end = new Date(checkoutDate);
  end.setHours(CLEANING_END_HOUR, 0, 0, 0);

  const titleGuest = next ? next.guest : 'TBD';
  const title = 'Cleaner: ' + cleaner.name + ' / Guest: ' + titleGuest;

  const lines = [
    'Cleaner: ' + cleaner.name,
    arrivingGuestLine(next),
    '',
    'Departing today: ' + departingGuest + ' (11:00 AM checkout).',
  ];
  if (!cleaner.email) {
    lines.push('');
    lines.push('No email on file for ' + cleaner.name + ' — please confirm manually.');
  }

  const options = { description: lines.join('\n'), sendInvites: true };
  if (cleaner.email) options.guests = cleaner.email;

  return cal.createEvent(title, start, end, options);
}

function planNotification(person) {
  if (!person) return { channel: 'none' };
  const pref = person.preferredChannel || 'email';
  if (pref === 'sms' && person.phone) return { channel: 'sms', target: person.phone };
  if (pref === 'slack' && person.slackUserId) return { channel: 'slack', target: person.slackUserId };
  if (person.email) return { channel: 'email', target: person.email };
  return { channel: 'none' };
}

function sendNotification(person, subject, body) {
  const plan = planNotification(person);
  if (plan.channel === 'sms') return sendSmsAdapter(plan.target, body);
  if (plan.channel === 'slack') return sendSlackAdapter(plan.target, body);
  if (plan.channel === 'email') return sendEmailAdapter(plan.target, subject, body);
  console.log('sendNotification: no channel available for ' + (person && person.name));
}

function sendSmsAdapter(toPhone, body) {
  const props = PropertiesService.getScriptProperties();
  const sid = props.getProperty('TWILIO_SID');
  const token = props.getProperty('TWILIO_TOKEN');
  const from = props.getProperty('TWILIO_FROM');
  if (!sid || !token || !from) {
    console.log('Twilio not configured — SMS skipped (' + toPhone + ')');
    return;
  }
  UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'post',
    payload: { To: toPhone, From: from, Body: body },
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    muteHttpExceptions: true,
  });
}

function sendSlackAdapter(channelOrUserId, body) {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) {
    console.log('Slack not configured — message skipped (' + channelOrUserId + ')');
    return;
  }
  UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ channel: channelOrUserId, text: body }),
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
}

function sendEmailAdapter(toEmail, subject, body) {
  GmailApp.sendEmail(toEmail, subject, body);
}

function sendSummary(created, skipped, flagged, deleted, preservedOverrides, reassigned, exhausted, dedupedLegacy) {
  const anyDeleted = deleted && deleted.length > 0;
  const anyOverride = preservedOverrides && preservedOverrides.length > 0;
  const anyReassigned = reassigned && reassigned.length > 0;
  const anyExhausted = exhausted && exhausted.length > 0;
  const anyDeduped = dedupedLegacy && dedupedLegacy.length > 0;
  if (created.length === 0 && flagged.length === 0 && !anyDeleted && !anyOverride && !anyReassigned && !anyExhausted && !anyDeduped) return;

  const lines = [];
  lines.push('Rental — daily cleaning coverage check');
  lines.push('Ran: ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm zzz'));
  lines.push('');

  if (anyDeleted) {
    lines.push('Deleted ' + deleted.length + ' mid-stay cleaning(s) — orphans from cancel/rebook:');
    deleted.forEach(d => {
      lines.push('  ' + d.date + '  "' + d.title + '" — was inside ' + d.insideStayOf +
        '\'s stay (' + d.bookingStart + ' to ' + d.bookingEnd + ')');
    });
    lines.push('');
  }

  if (anyDeduped) {
    lines.push('Deleted ' + dedupedLegacy.length + ' legacy-format duplicate(s):');
    dedupedLegacy.forEach(d => {
      lines.push('  ' + d.date + '  "' + d.title + '" (kept: "' + d.keptTitle + '")');
    });
    lines.push('');
  }

  if (anyOverride) {
    lines.push('Preserved ' + preservedOverrides.length + ' event(s) — manual override (you assigned a non-default cleaner):');
    preservedOverrides.forEach(p => {
      lines.push('  ' + p.date + '  "' + p.title + '" — ' + p.reason);
    });
    lines.push('');
  }

  if (anyReassigned) {
    lines.push('Cascaded ' + reassigned.length + ' event(s) after declines:');
    reassigned.forEach(r => {
      lines.push('  ' + r.date + '  ' + r.from + ' declined → invited ' + r.to);
    });
    lines.push('');
  }

  if (anyExhausted) {
    lines.push('⚠ ' + exhausted.length + ' event(s) NEED ATTENTION — cascade exhausted, all cleaners declined:');
    exhausted.forEach(x => {
      lines.push('  ' + x.date + '  "' + x.title + '" (last declined: ' + x.lastDeclined + ')');
    });
    lines.push('');
  }

  if (created.length > 0) {
    lines.push('Created ' + created.length + ' cleaning event(s):');
    created.forEach(c => {
      const arriving = c.next === null
        ? 'TBD (no upcoming booking)'
        : c.next.gapDays === 0 ? c.next.guest + ' arrives SAME-DAY (4 PM deadline)'
        : c.next.gapDays === 1 ? c.next.guest + ' arrives tomorrow'
        : c.next.guest + ' arrives in ' + c.next.gapDays + ' days';
      const note = c.needsAttention ? '  ⚠ ' + c.needsAttention : '';
      lines.push('  ' + c.date + '  ' + c.cleaner + ' — for ' + arriving + note);
    });
    lines.push('');
  }

  if (flagged.length > 0) {
    lines.push('Needs attention (' + flagged.length + '):');
    flagged.forEach(f => lines.push('  ' + f.date + '  ' + f.needsAttention));
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push(
      'Skipped (each matched to its own cleaning within ±' +
      COVERAGE_WINDOW_DAYS + ' day(s)): ' + skipped.length
    );
  }

  const subjectParts = [];
  if (created.length > 0) subjectParts.push(created.length + ' created');
  if (anyReassigned) subjectParts.push(reassigned.length + ' cascaded');
  if (anyExhausted) subjectParts.push('⚠ ' + exhausted.length + ' exhausted');
  if (anyDeleted) subjectParts.push(deleted.length + ' mid-stay deleted');
  if (anyDeduped) subjectParts.push(dedupedLegacy.length + ' legacy deduped');
  if (flagged.length > 0) subjectParts.push(flagged.length + ' need attention');
  const subject = 'Rental cleanings — ' + (subjectParts.length ? subjectParts.join(', ') : 'no changes');
  sendNotification(OWNER, subject, lines.join('\n'));
}

function stripTime(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d) {
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}
