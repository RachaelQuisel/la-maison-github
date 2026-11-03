// Public edition. Copyright (c) 2026 Rachael Quisel.
function getReservationIndex_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var index = {};
  for (var key in all) {
    if (key.indexOf('res_') === 0) {
      var resId = key.substring(4);
      try { index[resId] = JSON.parse(all[key]); }
      catch (e) { props.deleteProperty(key); }
    }
  }
  return index;
}

function saveReservationMapping_(reservationId, eventId, lastSeen, hash) {
  PropertiesService.getScriptProperties().setProperty(
    'res_' + reservationId,
    JSON.stringify({ eventId: eventId, lastSeen: lastSeen, hash: hash || null })
  );
}

function bookingHash_(b) {
  return [
    b.source,
    b.guestName,
    b.checkIn.toISOString(),
    b.checkOut.toISOString()
  ].join('|');
}

function removeReservationMapping_(reservationId) {
  PropertiesService.getScriptProperties().deleteProperty('res_' + reservationId);
}

function pruneStaleMappings_(now) {
  var cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var pruned = 0;
  for (var key in all) {
    if (key.indexOf('res_') !== 0) continue;
    try {
      var m = JSON.parse(all[key]);
      if (m.lastSeen && new Date(m.lastSeen) < cutoff) {
        props.deleteProperty(key);
        pruned++;
      }
    } catch (e) {
      props.deleteProperty(key);
      pruned++;
    }
  }
  if (pruned > 0) Logger.log('Pruned ' + pruned + ' stale mappings (>60 days)');
  return pruned;
}

function syncReservations() {
  requireBookingConfiguration_();
  var now = new Date();
  var bookings = collectBookingsFromGmail_(CONFIG.GMAIL_LOOKBACK_DAYS);
  var index = getReservationIndex_();

  var created = 0, updated = 0, skipped = 0, deleted = 0, errors = 0;

  for (var i = 0; i < bookings.confirmed.length; i++) {
    var b = bookings.confirmed[i];
    var hash = bookingHash_(b);
    try {
      var mapping = index[b.reservationId];
      if (!mapping) {
        var existingId = findEventByReservationId_(b.reservationId);
        if (existingId) {
          updateReservationEvent_(existingId, b);
          saveReservationMapping_(b.reservationId, existingId, now.toISOString(), hash);
          updated++;
        } else {
          var newId = createReservationEvent_(b);
          saveReservationMapping_(b.reservationId, newId, now.toISOString(), hash);
          created++;
        }
      } else if (mapping.hash === hash) {
        saveReservationMapping_(b.reservationId, mapping.eventId, now.toISOString(), hash);
        skipped++;
      } else {
        try {
          updateReservationEvent_(mapping.eventId, b);
          saveReservationMapping_(b.reservationId, mapping.eventId, now.toISOString(), hash);
          updated++;
        } catch (e) {
          if (e.message.indexOf('Not Found') !== -1 || e.message.indexOf('404') !== -1) {
            var recreatedId = createReservationEvent_(b);
            saveReservationMapping_(b.reservationId, recreatedId, now.toISOString(), hash);
            created++;
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      Logger.log('Error syncing booking ' + b.reservationId + ': ' + e.message);
      errors++;
    }
  }

  for (var j = 0; j < bookings.canceled.length; j++) {
    var resId = bookings.canceled[j];
    var m = index[resId];
    var eventId = m ? m.eventId : findEventByReservationId_(resId);
    var foundVia = m ? 'mapping' : (eventId ? 'tag' : null);

    if (eventId) {
      try {
        Calendar.Events.remove(CONFIG.CALENDAR_ID, eventId, { sendUpdates: 'none' });
        Logger.log('Deleted canceled reservation: ' + resId + ' (found via ' + foundVia + ')');
        deleted++;
      } catch (e) {
        if (e.message.indexOf('Not Found') === -1 && e.message.indexOf('404') === -1) {
          Logger.log('Error deleting ' + resId + ': ' + e.message);
        }
      }
    } else {
      Logger.log('Cancellation no-op: no calendar event found for ' + resId +
        ' (either already deleted, or the event was created manually without ' +
        'the reservationId tag — check the calendar by hand for lingering events).');
    }
    removeReservationMapping_(resId);
  }

  var pruned = pruneStaleMappings_(now);

  Logger.log('Sync complete. Confirmed: ' + bookings.confirmed.length +
    ', Canceled: ' + bookings.canceled.length +
    ' | Created: ' + created + ', Updated: ' + updated +
    ', Deleted: ' + deleted + ', Skipped: ' + skipped +
    ', Errors: ' + errors + ', Pruned: ' + pruned);
  Logger.log(automationSignoff_(BOOKING_SYNC_SIGNOFF));
}

var BOOKING_SYNC_SIGNOFF = {
  platform: 'Google Apps Script',
  name: 'Booking Sync',
  purpose: 'Reads Airbnb and VRBO booking emails and keeps the reservations calendar in step with them.',
  cadence: 'Every 15 minutes (time-based trigger)',
  link: 'https://github.com/RachaelQuisel/la-maison-github/tree/main/workflows/booking-sync'
};

function backfillReservations() {
  var savedDays = CONFIG.GMAIL_LOOKBACK_DAYS;
  CONFIG.GMAIL_LOOKBACK_DAYS = CONFIG.BACKFILL_LOOKBACK_DAYS;
  try {
    syncReservations();
  } finally {
    CONFIG.GMAIL_LOOKBACK_DAYS = savedDays;
  }
}

function collectBookingsFromGmail_(lookbackDays) {
  var query = 'newer_than:' + lookbackDays + 'd ' +
    '(from:messages.homeaway.com OR from:airbnb.com)';

  var threads;
  try {
    threads = GmailApp.search(query, 0, 500);
  } catch (e) {
    Logger.log('GmailApp.search failed: ' + e.message + ' — skipping this run.');
    return { confirmed: [], canceled: [] };
  }

  var confirmedById = {}; // reservationId → booking, latest by message date
  var canceledIds = {};

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var msg = msgs[j];
      var from = msg.getFrom().toLowerCase();
      var subject = msg.getSubject() || '';
      var plain = msg.getPlainBody() || '';
      var htmlStripped = '';
      try {
        htmlStripped = (msg.getBody() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      } catch (_) {  }
      var body = plain + '\n' + htmlStripped;
      var date = msg.getDate();

      var booking = null;
      if (from.indexOf('homeaway.com') !== -1) {
        booking = parseVrboMessage_(subject, body, date);
      } else if (from.indexOf('airbnb.com') !== -1) {
        booking = parseAirbnbMessage_(subject, body, date);
      }
      if (!booking) continue;

      if (booking.canceled) {
        canceledIds[booking.reservationId] = true;
        continue;
      }

      var existing = confirmedById[booking.reservationId];
      if (!existing || date > existing._messageDate) {
        booking._messageDate = date;
        confirmedById[booking.reservationId] = booking;
      }
    }
  }

  var minCheckIn = CONFIG.MIN_CHECKIN_DATE ? new Date(CONFIG.MIN_CHECKIN_DATE + 'T00:00:00Z') : null;
  var confirmed = [];
  for (var resId in confirmedById) {
    if (canceledIds[resId]) continue;
    var b = confirmedById[resId];
    if (minCheckIn && b.checkIn < minCheckIn) continue;
    delete b._messageDate;
    confirmed.push(b);
  }
  var canceled = [];
  for (var cid in canceledIds) canceled.push(cid);

  return { confirmed: confirmed, canceled: canceled };
}

function parseVrboMessage_(subject, body, date) {
  var mCancel = subject.match(/^Booking canceled.*?Reservation\s+(HA-[A-Z0-9]+)/i);
  if (mCancel) {
    return { reservationId: mCancel[1], canceled: true, source: 'VRBO' };
  }

  if (subject.indexOf('Reservation from') !== 0) return null;

  var mSub = subject.match(
    /^Reservation from\s+(.+?):\s+([A-Z][a-z]{2}\s+\d{1,2})(?:,\s*(\d{4}))?\s*-\s*([A-Z][a-z]{2}\s+\d{1,2}),\s*(\d{4})\s*-\s*Vrbo/
  );
  if (!mSub) return null;
  var guest = mSub[1].trim();
  var startStr = mSub[2];
  var startYear = mSub[3] ? parseInt(mSub[3], 10) : null;
  var endStr = mSub[4];
  var endYear = parseInt(mSub[5], 10);

  var mResId = body.match(/Reservation ID\s+(HA-[A-Z0-9]+)/) ||
               body.match(/\b(HA-[A-Z0-9]{6,})\b/);
  if (!mResId) return null;
  var reservationId = mResId[1];

  var checkIn = parseDateAtTime_(startStr + ' ' + (startYear || endYear), CONFIG.CHECKIN_HOUR, CONFIG.CHECKIN_MIN);
  var checkOut = parseDateAtTime_(endStr + ' ' + endYear, CONFIG.CHECKOUT_HOUR, CONFIG.CHECKOUT_MIN);
  if (!checkIn || !checkOut) return null;
  if (checkOut <= checkIn) {
    checkOut = parseDateAtTime_(endStr + ' ' + (endYear + 1), CONFIG.CHECKOUT_HOUR, CONFIG.CHECKOUT_MIN);
  }

  var displayGuest = titleCase_(guest);

  return {
    source: 'VRBO',
    reservationId: reservationId,
    guestName: displayGuest,
    checkIn: checkIn,
    checkOut: checkOut,
    canceled: false
  };
}

function parseAirbnbMessage_(subject, body, date) {
  var isCancel =
    /^(?:Canceled|Cancelled|Cancellation)\s*:/i.test(subject) ||
    (/\bcancell?ed\b/i.test(subject) &&
     /\b(?:reservation|booking|stay|HM[A-Z0-9]{6,})\b/i.test(subject));

  var reservationId = null;
  if (isCancel) {
    var subjMatchC = subject.match(/\b(HM[A-Z0-9]{6,12})\b/);
    if (subjMatchC) reservationId = subjMatchC[1];
  }
  if (!reservationId) {
    var confMatch = body.match(/CONFIRMATION CODE\s*\n\s*([A-Z0-9]{6,})/i);
    if (confMatch) {
      reservationId = confMatch[1];
    } else {
      var urlMatch = body.match(/\/reservations\/details\/([A-Z0-9]{6,})/);
      if (urlMatch) {
        reservationId = urlMatch[1];
      } else {
        var subjMatch = subject.match(/\b(HM[A-Z0-9]{6,12})\b/);
        if (subjMatch) reservationId = subjMatch[1];
      }
    }
  }
  if (!reservationId) return null;

  if (isCancel) {
    return { reservationId: reservationId, canceled: true, source: 'Airbnb' };
  }

  if (!/booking confirmed|reservation confirmed/i.test(subject)) return null;

  var subjectGuest = null;
  var mSub1 = subject.match(/-\s*([A-Z][a-zA-Z.''’-]+(?:\s+[A-Z][a-zA-Z.''’-]+)*)\s+arrives/i);
  if (mSub1) subjectGuest = mSub1[1].trim();
  if (!subjectGuest) {
    var mSub2 = subject.match(/!\s*([A-Z][a-zA-Z.''’-]+(?:\s+[A-Z][a-zA-Z.''’-]+)*)\s+arrives/i);
    if (mSub2) subjectGuest = mSub2[1].trim();
  }

  var candidates = [];
  if (subjectGuest) candidates.push(subjectGuest);
  var mBodyFull = body.match(/New booking confirmed![\s\S]*?\n\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n/);
  if (mBodyFull) candidates.push(mBodyFull[1].trim());
  var mBodyOld = body.match(/NEW BOOKING CONFIRMED!\s+([A-Za-z][A-Za-z .'-]+?)\s+ARRIVES/i);
  if (mBodyOld) candidates.push(titleCase_(mBodyOld[1]));

  var guest = null;
  for (var ci = 0; ci < candidates.length; ci++) {
    if (guest === null || candidates[ci].length > guest.length) {
      guest = candidates[ci];
    }
  }
  if (guest === null) guest = '(unknown guest)';

  var stay = body.match(
    /Check-in\s+([A-Z][a-z]{2},\s*[A-Z][a-z]{2}\s+\d{1,2})(?:,\s*(\d{4}))?\s+(\d{1,2}:\d{2}\s*[AP]M)\s+Checkout\s+([A-Z][a-z]{2},\s*[A-Z][a-z]{2}\s+\d{1,2})(?:,\s*(\d{4}))?\s+(\d{1,2}:\d{2}\s*[AP]M)/
  );
  var checkInYearCaptured = null;
  var checkOutYearCaptured = null;
  if (stay) {
    checkInYearCaptured = stay[2] || null;
    checkOutYearCaptured = stay[5] || null;
    stay = [stay[0], stay[1], stay[4], stay[3], stay[6]];
  } else {
    stay = body.match(
      /Check-in\s+Checkout\s*\n\s*([A-Z][a-z]{2},\s*[A-Z][a-z]{2}\s+\d{1,2})\s+([A-Z][a-z]{2},\s*[A-Z][a-z]{2}\s+\d{1,2})\s*\n\s*(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)/
    );
  }

  var checkIn, checkOut;
  if (stay) {
    var emailYear = date.getFullYear();
    var inYear = checkInYearCaptured || emailYear;
    var outYear = checkOutYearCaptured || checkInYearCaptured || emailYear;
    checkIn = parseDateTimeWithDay_(stay[1] + ', ' + inYear, stay[3]);
    checkOut = parseDateTimeWithDay_(stay[2] + ', ' + outYear, stay[4]);

    if (!checkInYearCaptured && checkIn && checkIn < date) {
      var bumped = emailYear + 1;
      checkIn = parseDateTimeWithDay_(stay[1] + ', ' + bumped, stay[3]);
      checkOut = parseDateTimeWithDay_(stay[2] + ', ' + bumped, stay[4]);
    }
    if (checkOut && checkIn && checkOut <= checkIn) {
      checkOut = parseDateTimeWithDay_(stay[2] + ', ' + (checkIn.getFullYear() + 1), stay[4]);
    }
  }

  if (!checkIn || !checkOut) {
    var mArr = subject.match(/arrives\s+([A-Z][a-z]{2}\s+\d{1,2})/i);
    if (mArr) {
      var fallbackYear = date.getFullYear();
      checkIn = parseDateAtTime_(mArr[1] + ' ' + fallbackYear, CONFIG.CHECKIN_HOUR, CONFIG.CHECKIN_MIN);
      if (checkIn && checkIn < date) {
        checkIn = parseDateAtTime_(mArr[1] + ' ' + (fallbackYear + 1), CONFIG.CHECKIN_HOUR, CONFIG.CHECKIN_MIN);
      }
      if (checkIn) {
        var nightsMatch = body.match(/\$[\d,]+\.\d{2}\s*x\s*(\d+)\s+nights?\b/i);
        if (!nightsMatch) return null;
        var nights = parseInt(nightsMatch[1], 10);
        checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
        checkOut.setHours(CONFIG.CHECKOUT_HOUR, CONFIG.CHECKOUT_MIN, 0, 0);
      }
    }
  }
  if (!checkIn || !checkOut) return null;

  return {
    source: 'Airbnb',
    reservationId: reservationId,
    guestName: guest,
    checkIn: checkIn,
    checkOut: checkOut,
    canceled: false
  };
}

function buildEventResource_(booking) {
  return {
    summary: booking.source + ': ' + booking.guestName,
    description: 'Source: ' + booking.source +
      '\nReservation: ' + booking.reservationId +
      '\nGuest: ' + booking.guestName +
      '\nCheck-in: ' + Utilities.formatDate(booking.checkIn, CONFIG.TIMEZONE, 'EEE MMM d, h:mm a') +
      '\nCheck-out: ' + Utilities.formatDate(booking.checkOut, CONFIG.TIMEZONE, 'EEE MMM d, h:mm a'),
    location: CONFIG.LOCATION,
    start: { dateTime: booking.checkIn.toISOString(), timeZone: CONFIG.TIMEZONE },
    end:   { dateTime: booking.checkOut.toISOString(), timeZone: CONFIG.TIMEZONE },
    extendedProperties: {
      private: {
        reservationId: booking.reservationId,
        source: booking.source
      }
    }
  };
}

function createReservationEvent_(booking) {
  var resource = buildEventResource_(booking);
  var created = Calendar.Events.insert(resource, CONFIG.CALENDAR_ID, { sendUpdates: 'none' });
  Logger.log('Created: ' + resource.summary + ' (' + booking.reservationId + ')');
  return created.id;
}

function updateReservationEvent_(eventId, booking) {
  var patchResource = {
    summary: booking.source + ': ' + booking.guestName,
    location: CONFIG.LOCATION,
    start: { dateTime: booking.checkIn.toISOString(), timeZone: CONFIG.TIMEZONE },
    end:   { dateTime: booking.checkOut.toISOString(), timeZone: CONFIG.TIMEZONE },
    extendedProperties: {
      private: {
        reservationId: booking.reservationId,
        source: booking.source
      }
    }
  };
  Calendar.Events.patch(patchResource, CONFIG.CALENDAR_ID, eventId, { sendUpdates: 'none' });
}

function findEventByReservationId_(reservationId) {
  try {
    var resp = Calendar.Events.list(CONFIG.CALENDAR_ID, {
      privateExtendedProperty: 'reservationId=' + reservationId,
      maxResults: 5,
      singleEvents: true
    });
    var items = resp.items || [];
    if (items.length === 0) return null;
    if (items.length > 1) {
      items.sort(function(a, b) { return new Date(a.created) - new Date(b.created); });
      for (var i = 1; i < items.length; i++) {
        try { Calendar.Events.remove(CONFIG.CALENDAR_ID, items[i].id, { sendUpdates: 'none' }); }
        catch (e) {  }
      }
    }
    return items[0].id;
  } catch (e) {
    Logger.log('findEventByReservationId_ error: ' + e.message);
    return null;
  }
}

function parseDateAtTime_(monthDayYear, hour, minute) {
  var parts = monthDayYear.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  var month = MONTHS_[parts[0].slice(0, 3)];
  var day = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (month == null || isNaN(day) || isNaN(year)) return null;
  var iso = year + '-' + pad2_(month + 1) + '-' + pad2_(day) + 'T' +
    pad2_(hour) + ':' + pad2_(minute) + ':00';
  return parseInTimezone_(iso, CONFIG.TIMEZONE);
}

function parseDateTimeWithDay_(dayDateYear, timeStr) {
  var m = dayDateYear.match(/^[A-Z][a-z]{2},\s*([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  var month = MONTHS_[m[1].slice(0, 3)];
  var day = parseInt(m[2], 10);
  var year = parseInt(m[3], 10);
  var t = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!t || month == null || isNaN(day) || isNaN(year)) return null;
  var hour = parseInt(t[1], 10) % 12 + (t[3].toUpperCase() === 'PM' ? 12 : 0);
  var min = parseInt(t[2], 10);
  var iso = year + '-' + pad2_(month + 1) + '-' + pad2_(day) + 'T' +
    pad2_(hour) + ':' + pad2_(min) + ':00';
  return parseInTimezone_(iso, CONFIG.TIMEZONE);
}

function parseInTimezone_(localIso, tz) {
  return Utilities.parseDate(localIso, tz, "yyyy-MM-dd'T'HH:mm:ss");
}

var MONTHS_ = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

function pad2_(n) { return n < 10 ? '0' + n : '' + n; }

function titleCase_(s) {
  return s.replace(/\w\S*/g, function(w) {
    return w.charAt(0).toUpperCase() + w.substr(1).toLowerCase();
  });
}

function setupTrigger() {
  requireBookingConfiguration_();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncReservations') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncReservations')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger created — syncReservations every 15 minutes.');
}

function deleteTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncReservations') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log('All syncReservations triggers removed.');
}

function requireBookingConfiguration_() {
  if (!CONFIG.ENABLED || !CONFIG.CALENDAR_ID || CONFIG.CALENDAR_ID === 'ADD_YOUR_CALENDAR_ID') {
    throw new Error('Booking sync is disabled. Configure a test calendar and explicitly enable it before use.');
  }
}
