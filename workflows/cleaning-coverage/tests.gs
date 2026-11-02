function runAllTests() {
  const tests = [
    test_isCoveredByWindow_exact_date,
    test_isCoveredByWindow_one_day_before,
    test_isCoveredByWindow_one_day_after,
    test_isCoveredByWindow_two_days_before,
    test_isCoveredByWindow_two_days_after,
    test_isCoveredByWindow_empty_set,
    test_isCoveredByWindow_window_zero,

    test_matchCleaningCoverage_one_cleaning_cannot_cover_two_back_to_back_checkouts,
    test_matchCleaningCoverage_one_day_shift_still_counts,
    test_matchCleaningCoverage_duplicate_events_on_one_day_do_not_cover_next_checkout,

    test_uniqueCheckoutIndexes_duplicate_booking_events_share_one_turnover,

    test_checkout_after_owned_window_is_not_processed,
    test_coverage_scan_expands_one_day_beyond_both_edges,
    test_addCalendarDays_stays_at_midnight_across_dst,

    test_findMidStayCleanings_checkout_day_not_flagged,
    test_findMidStayCleanings_checkin_day_not_flagged,
    test_findMidStayCleanings_between_is_flagged,
    test_findMidStayCleanings_no_overlap_empty,
    test_findMidStayCleanings_multi_booking,
    test_findMidStayCleanings_returns_booking_metadata,

    test_parseBookingTitle_airbnb,
    test_parseBookingTitle_vrbo,
    test_parseBookingTitle_non_booking_returns_null,

    test_cascadeChainFor_sunday,
    test_cascadeChainFor_tuesday,
    test_findCleanerByEmail_match,
    test_findCleanerByEmail_no_match,
    test_isManualOverride_firstCleaner_on_tuesday,
    test_isManualOverride_secondCleaner_on_tuesday,
    test_isManualOverride_reliefCleaner_on_tuesday_is_manual,
    test_isManualOverride_owner_alone_is_manual,
    test_isManualOverride_sundayCleaner_on_tuesday,
    test_isManualOverride_secondCleaner_on_sunday,
    test_isManualOverride_sundayCleaner_on_sunday,
    test_isManualOverride_no_cleaner_attendee,
    test_isManualOverride_inspector_only,

    test_cascade_firstCleaner_accepted_noop,
    test_cascade_firstCleaner_declined_reassign_to_secondCleaner,
    test_cascade_firstCleaner_declined_secondCleaner_accepted_noop,
    test_cascade_firstCleaner_secondCleaner_declined_reassign_to_owner,
    test_cascade_full_chain_declined_exhausted,
    test_cascade_firstCleaner_needs_action_noop,
    test_cascade_nobody_invited_noop,
    test_cascade_sunday_sundayCleaner_no_email_noop,
    test_cascade_firstCleaner_stale_no_response_noop,
    test_cascade_firstCleaner_fresh_no_response_noop,
    test_cascade_far_future_stale_does_not_cascade,
    test_cascade_stale_invite_fresh_window_at_horizon_entry,
    test_cascade_stale_invite_remains_covered_after_48h,
    test_cascade_real_decline_reports_via_declined,
    test_cascade_needsaction_is_not_exhausted,
    test_cascade_handmade_stale_no_response_noop,
    test_cascade_handmade_real_decline_still_reassigns,
    test_cascade_scriptmade_silence_noop,
    test_cascade_july31_firstCleaner_assigned_without_calendar_response_noop,

    test_declined_firstCleaner_is_removed_when_secondCleaner_accepted,
    test_declined_inspector_is_not_removed_by_cleaner_cascade,

    test_hasManualConfirmation_detects_marker,
    test_shouldSendExhaustedAlert_only_once,
    test_fake_exhausted_prefix_is_cleared_for_pending_firstCleaner,
    test_real_exhausted_prefix_stays_when_all_cleaners_declined,
    test_covered_cleaner_prefers_accepted_secondCleaner_after_firstCleaner_declines,
    test_covered_cleaner_uses_pending_firstCleaner_when_no_acceptance_exists,
    test_covered_cleaner_uses_manual_confirmation,
    test_clearing_false_exhaustion_removes_old_alert_marker,

    test_planNotification_sms_with_phone,
    test_planNotification_slack_with_userid,
    test_planNotification_slack_without_userid_falls_back_to_email,
    test_planNotification_sms_without_phone_falls_back_to_email,
    test_planNotification_email_only,
    test_planNotification_no_channel,
    test_planNotification_null_person,

    test_isCanonicalCleaningTitle_yes,
    test_isCanonicalCleaningTitle_no,
    test_isLegacyCleaningTitle_clean_dash,
    test_isLegacyCleaningTitle_cleaner_dash,
    test_isLegacyCleaningTitle_canonical_returns_false,
    test_findLegacyDuplicates_simple_pair,
    test_findLegacyDuplicates_no_canonical_no_action,
    test_findLegacyDuplicates_two_canonical_no_action,
    test_findLegacyDuplicates_unrelated_dates,
  ];

  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      t();
      passed++;
    } catch (e) {
      failures.push(t.name + ': ' + (e && e.message ? e.message : e));
    }
  }

  const summary = '✓ ' + passed + ' passed, ✗ ' + failures.length + ' failed';
  console.log(summary);
  failures.forEach(f => console.log('  ' + f));
  if (failures.length > 0) throw new Error(summary);
  return summary;
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEq') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertArrayLength(actual, expectedLen, msg) {
  if (!Array.isArray(actual) || actual.length !== expectedLen) {
    const got = Array.isArray(actual) ? ('length ' + actual.length) : typeof actual;
    throw new Error((msg || 'assertArrayLength') + ': expected length ' + expectedLen + ', got ' + got);
  }
}

function ymd(y, m, d) {
  return new Date(y, m - 1, d); // month is 1-indexed for readability
}

function test_isCoveredByWindow_exact_date() {
  const set = new Set(['2026-05-18']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 1), true, 'exact date');
}

function test_isCoveredByWindow_one_day_before() {
  const set = new Set(['2026-05-17']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 1), true, '1 day before counts');
}

function test_isCoveredByWindow_one_day_after() {
  const set = new Set(['2026-05-19']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 1), true, '1 day after counts');
}

function test_isCoveredByWindow_two_days_before() {
  const set = new Set(['2026-05-16']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 1), false, '2 days before is outside ±1');
}

function test_isCoveredByWindow_two_days_after() {
  const set = new Set(['2026-05-20']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 1), false, '2 days after is outside ±1');
}

function test_isCoveredByWindow_empty_set() {
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), new Set(), 1), false, 'empty set');
}

function test_isCoveredByWindow_window_zero() {
  const set = new Set(['2026-05-17']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), set, 0), false, 'window 0 = exact only');
  const exact = new Set(['2026-05-18']);
  assertEq(isCoveredByWindow(ymd(2026, 5, 18), exact, 0), true, 'window 0 with exact match');
}

function test_matchCleaningCoverage_one_cleaning_cannot_cover_two_back_to_back_checkouts() {
  const matches = matchCleaningCoverage(
    [ymd(2026, 8, 11), ymd(2026, 8, 12)],
    [ymd(2026, 8, 11)],
    1
  );
  assertEq(
    JSON.stringify(matches),
    JSON.stringify([0, -1]),
    'one cleaning event can cover only one checkout'
  );
}

function test_matchCleaningCoverage_one_day_shift_still_counts() {
  const matches = matchCleaningCoverage(
    [ymd(2026, 8, 11)],
    [ymd(2026, 8, 12)],
    1
  );
  assertEq(
    JSON.stringify(matches),
    JSON.stringify([0]),
    'one cleaning moved by one day still covers one checkout'
  );
}

function test_matchCleaningCoverage_duplicate_events_on_one_day_do_not_cover_next_checkout() {
  const matches = matchCleaningCoverage(
    [ymd(2026, 8, 11), ymd(2026, 8, 12)],
    [ymd(2026, 8, 11), ymd(2026, 8, 11)],
    1
  );
  assertEq(
    JSON.stringify(matches),
    JSON.stringify([0, -1]),
    'duplicate events on one date do not count as a second day of coverage'
  );
}

function test_uniqueCheckoutIndexes_duplicate_booking_events_share_one_turnover() {
  const indexes = uniqueCheckoutIndexes([
    ymd(2026, 8, 2),
    ymd(2026, 8, 2),
    ymd(2026, 8, 3),
  ]);
  assertEq(
    JSON.stringify(indexes),
    JSON.stringify([0, 2]),
    'one property needs one turnover per checkout date'
  );
}

function test_checkout_after_owned_window_is_not_processed() {
  const start = ymd(2026, 7, 27);
  const end = ymd(2026, 10, 25);
  const checkout = ymd(2026, 10, 26);
  assertEq(
    isCheckoutInOwnedWindow(checkout, start, end),
    false,
    'booking overlaps the search but checkout is beyond the owned window'
  );
}

function test_coverage_scan_expands_one_day_beyond_both_edges() {
  const window = coverageScanWindow(
    ymd(2026, 7, 27),
    ymd(2026, 10, 25),
    1
  );
  assertEq(isoDate(window.start), '2026-07-26', 'includes prior-day coverage for today');
  assertEq(isoDate(window.end), '2026-10-26', 'includes next-day coverage at the far edge');
}

function test_addCalendarDays_stays_at_midnight_across_dst() {
  const result = addCalendarDays(ymd(2026, 10, 31), 2);
  assertEq(isoDate(result), '2026-11-02', 'adds calendar dates across DST end');
  assertEq(result.getHours(), 0, 'result stays at local midnight');
}

function test_findMidStayCleanings_checkout_day_not_flagged() {
  const bookings = [{ guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) }];
  const cleanings = [{ id: 'c1', date: ymd(2026, 5, 17) }];
  assertArrayLength(findMidStayCleanings(bookings, cleanings), 0, 'checkout day is allowed');
}

function test_findMidStayCleanings_checkin_day_not_flagged() {
  const bookings = [{ guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) }];
  const cleanings = [{ id: 'c1', date: ymd(2026, 5, 14) }];
  assertArrayLength(findMidStayCleanings(bookings, cleanings), 0, 'checkin day is allowed');
}

function test_findMidStayCleanings_between_is_flagged() {
  const bookings = [{ guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) }];
  const cleanings = [{ id: 'c1', date: ymd(2026, 5, 15) }];
  const result = findMidStayCleanings(bookings, cleanings);
  assertArrayLength(result, 1, 'cleaning strictly between');
  assertEq(result[0].cleaningId, 'c1', 'returns cleaning id');
}

function test_findMidStayCleanings_no_overlap_empty() {
  const bookings = [{ guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) }];
  const cleanings = [{ id: 'c1', date: ymd(2026, 5, 18) }];
  assertArrayLength(findMidStayCleanings(bookings, cleanings), 0, 'cleaning after checkout');
}

function test_findMidStayCleanings_multi_booking() {
  const bookings = [
    { guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) },
    { guest: 'B', checkIn: ymd(2026, 5, 20), checkOut: ymd(2026, 5, 24) },
  ];
  const cleanings = [
    { id: 'c1', date: ymd(2026, 5, 15) }, // mid-A
    { id: 'c2', date: ymd(2026, 5, 18) }, // gap (not mid-anything)
    { id: 'c3', date: ymd(2026, 5, 22) }, // mid-B
  ];
  const result = findMidStayCleanings(bookings, cleanings);
  assertArrayLength(result, 2, 'two mid-stays');
  const ids = result.map(r => r.cleaningId).sort();
  assertEq(JSON.stringify(ids), JSON.stringify(['c1', 'c3']), 'correct IDs');
}

function test_findMidStayCleanings_returns_booking_metadata() {
  const bookings = [{ guest: 'A', checkIn: ymd(2026, 5, 14), checkOut: ymd(2026, 5, 17) }];
  const cleanings = [{ id: 'c1', date: ymd(2026, 5, 15), title: 'Cleaner: CleanerTwo / Guest: X' }];
  const result = findMidStayCleanings(bookings, cleanings);
  assertEq(result[0].bookingGuest, 'A', 'bookingGuest preserved');
  assertEq(result[0].cleaningTitle, 'Cleaner: CleanerTwo / Guest: X', 'cleaningTitle preserved');
}

function test_parseBookingTitle_airbnb() {
  const parsed = parseBookingTitle('Airbnb: Caroline Chocholak');
  assertEq(parsed.source, 'Airbnb', 'source');
  assertEq(parsed.guest, 'Caroline', 'guest first name');
}

function test_parseBookingTitle_vrbo() {
  const parsed = parseBookingTitle('VRBO: Betsy Fitzpatrick');
  assertEq(parsed.source, 'VRBO', 'source');
  assertEq(parsed.guest, 'Betsy', 'guest first name');
}

function test_parseBookingTitle_non_booking_returns_null() {
  assertEq(parseBookingTitle('Inspector Inspection'), null, 'non-booking title returns null');
  assertEq(parseBookingTitle('Cleaner: CleanerTwo / Guest: X'), null, 'cleaning title returns null');
}

function test_cascadeChainFor_sunday() {
  const sunday = ymd(2026, 8, 23); // Sun Aug 23 2026
  const chain = cascadeChainFor(sunday);
  assertEq(chain.length, 2, 'Sunday has 2 cleaners: SundayCleaner + Owner fallback');
  assertEq(chain[0].name, 'SundayCleaner', 'Sunday first → SundayCleaner');
  assertEq(chain[1].name, 'Owner', 'Sunday fallback → Owner');
}

function test_cascadeChainFor_tuesday() {
  const tuesday = ymd(2026, 6, 2); // Tue Jun 2 2026
  const chain = cascadeChainFor(tuesday);
  assertEq(chain.length, 3, 'Mon-Sat has 3 cleaners');
  assertEq(chain[0].name, 'CleanerOne', 'first = CleanerOne');
  assertEq(chain[1].name, 'CleanerTwo', 'second = CleanerTwo');
  assertEq(chain[2].name, 'Owner', 'third = Owner');
}

function test_findCleanerByEmail_match() {
  const c = findCleanerByEmail('cleaner-two@example.invalid');
  assertEq(c && c.name, 'CleanerTwo', 'finds CleanerTwo by email');
}

function test_findCleanerByEmail_no_match() {
  assertEq(findCleanerByEmail('person@example.invalid'), null, 'no match returns null');
  assertEq(findCleanerByEmail(null), null, 'null input returns null');
  assertEq(findCleanerByEmail(''), null, 'empty string returns null');
}

function test_isManualOverride_firstCleaner_on_tuesday() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride(['cleaner-one@example.invalid'], tuesday), false, 'CleanerOne on Tue = default first, not override');
}

function test_isManualOverride_secondCleaner_on_tuesday() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride(['cleaner-two@example.invalid'], tuesday), false, 'CleanerTwo in Mon-Sat cascade chain');
}

function test_isManualOverride_reliefCleaner_on_tuesday_is_manual() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride(['relief@example.invalid'], tuesday), true,
    'ReliefCleaner removed from default Mon-Sat cascade 2026-06-24 → invite is manual override');
}

function test_isManualOverride_owner_alone_is_manual() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride(['owner@example.invalid'], tuesday), true,
    'Owner-only invite = manual override');
}

function test_isManualOverride_sundayCleaner_on_tuesday() {
  const tuesday = ymd(2026, 6, 2);
  const fakeSundayCleanerEmail = 'person@example.invalid'; // unknown email → returns null in findCleanerByEmail → not flagged
  assertEq(isManualOverride([fakeSundayCleanerEmail], tuesday), false, 'unknown email is not flagged');
}

function test_isManualOverride_secondCleaner_on_sunday() {
  const sunday = ymd(2026, 8, 23);
  assertEq(isManualOverride(['cleaner-two@example.invalid'], sunday), true, 'CleanerTwo on Sun = manual override (Sunday chain = [SundayCleaner])');
}

function test_isManualOverride_sundayCleaner_on_sunday() {
  const sunday = ymd(2026, 8, 23);
  assertEq(isManualOverride([], sunday), false, 'no attendees = not override');
}

function test_isManualOverride_no_cleaner_attendee() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride([], tuesday), false, 'empty attendee list');
  assertEq(isManualOverride(['person@example.invalid'], tuesday), false, 'unknown attendee');
}

function test_isManualOverride_inspector_only() {
  const tuesday = ymd(2026, 6, 2);
  assertEq(isManualOverride(['person@example.invalid'], tuesday), false, 'inspector attendance does not signal override');
}

function attendees() {
  const out = [];
  for (let i = 0; i < arguments.length; i += 2) {
    out.push({ email: arguments[i], responseStatus: arguments[i + 1] });
  }
  return out;
}

function test_cascade_firstCleaner_accepted_noop() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees('cleaner-one@example.invalid', 'accepted');
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'noop', 'CleanerOne accepted = noop');
}

function test_cascade_firstCleaner_declined_reassign_to_secondCleaner() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees('cleaner-one@example.invalid', 'declined');
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'reassign', 'CleanerOne declined → reassign');
  assertEq(d.from.name, 'CleanerOne', 'from = CleanerOne');
  assertEq(d.to.name, 'CleanerTwo', 'to = CleanerTwo');
}

function test_cascade_firstCleaner_declined_secondCleaner_accepted_noop() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'accepted'
  );
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'noop', 'CleanerTwo accepted after CleanerOne declined = noop');
}

function test_cascade_firstCleaner_secondCleaner_declined_reassign_to_owner() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'declined'
  );
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'reassign', 'CleanerOne + CleanerTwo declined → reassign');
  assertEq(d.from.name, 'CleanerTwo', 'from = CleanerTwo');
  assertEq(d.to.name, 'Owner', 'to = Owner');
}

function test_cascade_full_chain_declined_exhausted() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'declined',
    'owner@example.invalid', 'declined'
  );
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'exhausted', 'all three declined → exhausted');
  assertEq(d.from.name, 'Owner', 'last declined = Owner');
}

function test_cascade_firstCleaner_needs_action_noop() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees('cleaner-one@example.invalid', 'needsAction');
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'noop', 'CleanerOne needsAction = still pending = noop');
}

function test_cascade_nobody_invited_noop() {
  const tuesday = ymd(2026, 6, 2);
  const d = decideCascadeAction([], tuesday);
  assertEq(d.action, 'noop', 'no attendees = noop');
}

function test_cascade_sunday_sundayCleaner_no_email_noop() {
  const sunday = ymd(2026, 8, 23);
  const d = decideCascadeAction([], sunday);
  assertEq(d.action, 'noop', 'Sunday with no attendees = noop (SundayCleaner has no email)');
}

function test_cascade_firstCleaner_stale_no_response_noop() {
  const tuesday = ymd(2026, 6, 2);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: new Date(2026, 4, 27),
  }];
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'noop', '49h stale needsAction is not a decline');
}

function test_cascade_firstCleaner_fresh_no_response_noop() {
  const tuesday = ymd(2026, 6, 2);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: new Date(2026, 4, 29),
  }];
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'noop', 'fresh needsAction is not a decline');
}

function test_cascade_far_future_stale_does_not_cascade() {
  const cleaning = ymd(2026, 12, 1); // ~6 months out
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: ymd(2026, 4, 25),
  }];
  const d = decideCascadeAction(states, cleaning);
  assertEq(d.action, 'noop', 'far-future cleaning ignores stale needsAction');
}

function test_cascade_stale_invite_fresh_window_at_horizon_entry() {
  const eventDate = new Date(2026, 6, 15);          // July 15
  const invitedAt = new Date(2026, 4, 10);          // invited at event creation, May 10
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: invitedAt,
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', 'stale invite remains covered at the old horizon entry');
}

function test_cascade_stale_invite_remains_covered_after_48h() {
  const eventDate = new Date(2026, 6, 15);
  const invitedAt = new Date(2026, 4, 10);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: invitedAt,
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', 'needsAction remains covered regardless of age');
}

function test_cascade_real_decline_reports_via_declined() {
  const tuesday = ymd(2026, 6, 2);
  const states = attendees('cleaner-one@example.invalid', 'declined');
  const d = decideCascadeAction(states, tuesday);
  assertEq(d.action, 'reassign', 'real decline → reassign');
  assertEq(d.via, 'declined', 'via = declined for a real decline');
}

function test_cascade_needsaction_is_not_exhausted() {
  const eventDate = new Date(2026, 6, 16);          // July 16
  const states = [
    { email: 'cleaner-one@example.invalid',           responseStatus: 'needsAction', invitedAt: new Date(2026, 4, 10) },
    { email: 'cleaner-two@example.invalid', responseStatus: 'declined',    invitedAt: new Date(2026, 6, 2) },
    { email: 'owner@example.invalid',     responseStatus: 'needsAction', invitedAt: new Date(2026, 6, 4) },
  ];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', 'needsAction attendees do not exhaust the cascade');
}

function test_cascade_handmade_stale_no_response_noop() {
  const eventDate = new Date(2026, 6, 15);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: new Date(2026, 4, 10),
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', 'hand-made event: silence is not a decline');
}

function test_cascade_handmade_real_decline_still_reassigns() {
  const eventDate = new Date(2026, 6, 15);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'declined',
    invitedAt: new Date(2026, 4, 10),
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'reassign', 'hand-made event: a real decline still cascades');
  assertEq(d.to.name, 'CleanerTwo', 'cascades to CleanerTwo');
  assertEq(d.via, 'declined', 'via = declined');
}

function test_cascade_scriptmade_silence_noop() {
  const eventDate = new Date(2026, 6, 15);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: new Date(2026, 4, 10),
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', 'script-made event: stale silence remains covered');
}

function test_cascade_july31_firstCleaner_assigned_without_calendar_response_noop() {
  const eventDate = new Date(2026, 6, 31, 11, 0, 0);
  const states = [{
    email: 'cleaner-one@example.invalid',
    responseStatus: 'needsAction',
    invitedAt: new Date(2026, 6, 1),
  }];
  const d = decideCascadeAction(states, eventDate);
  assertEq(d.action, 'noop', '7/31: CleanerOne assigned + no explicit decline remains covered');
}

function test_declined_firstCleaner_is_removed_when_secondCleaner_accepted() {
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'accepted'
  );
  const removals = declinedCleanerEmailsToRemove(states);
  assertArrayLength(removals, 1, 'only the declined cleaner is removed');
  assertEq(removals[0], 'cleaner-one@example.invalid', 'CleanerOne is removed after declining');
}

function test_declined_inspector_is_not_removed_by_cleaner_cascade() {
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'person@example.invalid', 'declined'
  );
  const removals = declinedCleanerEmailsToRemove(states);
  assertArrayLength(removals, 1, 'inspector responses are outside the cleaner cascade');
  assertEq(removals[0], 'cleaner-one@example.invalid', 'only known cleaner CleanerOne is removed');
}

function test_hasManualConfirmation_detects_marker() {
  assertEq(hasManualConfirmation('Cleaner: CleanerOne\n\n[CONFIRMED 2026-07-10 CleanerOne]'), true, 'marker present');
  assertEq(hasManualConfirmation('Cleaner: CleanerOne'), false, 'no marker');
  assertEq(hasManualConfirmation(''), false, 'empty description');
  assertEq(hasManualConfirmation(null), false, 'null description');
}

function test_shouldSendExhaustedAlert_only_once() {
  assertEq(shouldSendExhaustedAlert('Cleaner: Owner'), true, 'no marker → send');
  assertEq(shouldSendExhaustedAlert('Cleaner: Owner\n\n[EXHAUSTED-ALERTED 2026-07-08]'), false, 'marker → already sent');
  assertEq(shouldSendExhaustedAlert(null), true, 'null description → send');
}

function test_fake_exhausted_prefix_is_cleared_for_pending_firstCleaner() {
  const title = '[CASCADE EXHAUSTED] Cleaner: CleanerOne / Guest: Eric';
  const states = attendees('cleaner-one@example.invalid', 'needsAction');
  assertEq(
    shouldClearExhaustedPrefix(title, states, ''),
    true,
    'pending CleanerOne is coverage, not an exhausted cascade'
  );
}

function test_real_exhausted_prefix_stays_when_all_cleaners_declined() {
  const title = '[CASCADE EXHAUSTED] Cleaner: Owner / Guest: Eric';
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'declined',
    'owner@example.invalid', 'declined'
  );
  assertEq(
    shouldClearExhaustedPrefix(title, states, ''),
    false,
    'a real all-declined exhaustion remains flagged'
  );
}

function test_covered_cleaner_prefers_accepted_secondCleaner_after_firstCleaner_declines() {
  const states = attendees(
    'cleaner-one@example.invalid', 'declined',
    'cleaner-two@example.invalid', 'accepted'
  );
  assertEq(
    coveredCleanerName(states, ''),
    'CleanerTwo',
    'accepted cleaner is the visible owner after the prior cleaner declines'
  );
}

function test_covered_cleaner_uses_pending_firstCleaner_when_no_acceptance_exists() {
  const states = attendees('cleaner-one@example.invalid', 'needsAction');
  assertEq(
    coveredCleanerName(states, ''),
    'CleanerOne',
    'pending invite remains coverage when no cleaner has accepted'
  );
}

function test_covered_cleaner_uses_manual_confirmation() {
  assertEq(
    coveredCleanerName([], '[CONFIRMED 2026-07-10 CleanerOne]'),
    'CleanerOne',
    'manual confirmation is authoritative even without a Calendar response'
  );
}

function test_clearing_false_exhaustion_removes_old_alert_marker() {
  const repaired = clearFalseExhaustionState(
    '[CASCADE EXHAUSTED] Cleaner: Owner / Guest: Eric',
    'Cleaner: Owner\n\n[EXHAUSTED-ALERTED 2026-07-26]',
    'CleanerOne'
  );
  assertEq(repaired.title, 'Cleaner: CleanerOne / Guest: Eric', 'title repaired to covered cleaner');
  assertEq(repaired.description, 'Cleaner: CleanerOne', 'description repaired and old alert marker removed');
}

function test_planNotification_sms_with_phone() {
  const p = { name: 'X', preferredChannel: 'sms', phone: '+12025550123', email: 'person@example.invalid' };
  const plan = planNotification(p);
  assertEq(plan.channel, 'sms', 'preferred sms with phone → sms');
  assertEq(plan.target, '+12025550123', 'sms target');
}

function test_planNotification_slack_with_userid() {
  const p = { name: 'X', preferredChannel: 'slack', slackUserId: 'U01ABC', email: 'person@example.invalid' };
  const plan = planNotification(p);
  assertEq(plan.channel, 'slack', 'preferred slack with userId → slack');
  assertEq(plan.target, 'U01ABC', 'slack target');
}

function test_planNotification_slack_without_userid_falls_back_to_email() {
  const p = { name: 'X', preferredChannel: 'slack', slackUserId: null, email: 'person@example.invalid' };
  const plan = planNotification(p);
  assertEq(plan.channel, 'email', 'no slackUserId → falls back to email');
  assertEq(plan.target, 'person@example.invalid', 'email target');
}

function test_planNotification_sms_without_phone_falls_back_to_email() {
  const p = { name: 'X', preferredChannel: 'sms', phone: null, email: 'person@example.invalid' };
  const plan = planNotification(p);
  assertEq(plan.channel, 'email', 'no phone → falls back to email');
}

function test_planNotification_email_only() {
  const p = { name: 'X', preferredChannel: 'email', email: 'person@example.invalid' };
  const plan = planNotification(p);
  assertEq(plan.channel, 'email', 'email channel');
}

function test_planNotification_no_channel() {
  const p = { name: 'X', preferredChannel: 'email', email: null };
  const plan = planNotification(p);
  assertEq(plan.channel, 'none', 'no email + no fallback = none');
}

function test_planNotification_null_person() {
  assertEq(planNotification(null).channel, 'none', 'null person = none');
}

function test_isCanonicalCleaningTitle_yes() {
  assertEq(isCanonicalCleaningTitle('Cleaner: CleanerTwo / Guest: Guest'), true, 'plain canonical');
  assertEq(isCanonicalCleaningTitle('Cleaner: CleanerTwo / Guest: Guest / Property Inspector: Inspector'), true, 'canonical with inspector');
}

function test_isCanonicalCleaningTitle_no() {
  assertEq(isCanonicalCleaningTitle('CleanerTwo Clean- Guest'), false, 'legacy is not canonical');
  assertEq(isCanonicalCleaningTitle('Cleaner CleanerTwo - Guest'), false, 'space-dash variant is not canonical');
  assertEq(isCanonicalCleaningTitle(''), false, 'empty');
}

function test_isLegacyCleaningTitle_clean_dash() {
  assertEq(isLegacyCleaningTitle('CleanerTwo Clean- Guest'), true);
  assertEq(isLegacyCleaningTitle('CleanerOne Clean- Maria'), true);
}

function test_isLegacyCleaningTitle_cleaner_dash() {
  assertEq(isLegacyCleaningTitle('Cleaner CleanerTwo - Guest'), true);
  assertEq(isLegacyCleaningTitle('Cleaner SundayCleaner - Betsy / Property Inspector Inspector'), true);
}

function test_isLegacyCleaningTitle_canonical_returns_false() {
  assertEq(isLegacyCleaningTitle('Cleaner: CleanerTwo / Guest: Guest'), false, 'canonical is not legacy');
}

function test_findLegacyDuplicates_simple_pair() {
  const cleanings = [
    { id: 'c1', date: ymd(2026, 5, 1), title: 'CleanerTwo Clean- CleanerTwonifer' },
    { id: 'c2', date: ymd(2026, 5, 1), title: 'Cleaner: CleanerTwo / Guest: CleanerTwonifer' },
  ];
  const r = findLegacyDuplicates(cleanings);
  assertArrayLength(r, 1, 'one legacy to delete');
  assertEq(r[0].cleaningId, 'c1', 'deletes the legacy one');
  assertEq(r[0].canonicalTitle, 'Cleaner: CleanerTwo / Guest: CleanerTwonifer', 'records kept title');
}

function test_findLegacyDuplicates_no_canonical_no_action() {
  const cleanings = [
    { id: 'c1', date: ymd(2026, 5, 1), title: 'CleanerTwo Clean- CleanerTwonifer' },
    { id: 'c2', date: ymd(2026, 5, 1), title: 'Cleaner CleanerTwo - CleanerTwonifer' },
  ];
  assertArrayLength(findLegacyDuplicates(cleanings), 0, 'no canonical = no action');
}

function test_findLegacyDuplicates_two_canonical_no_action() {
  const cleanings = [
    { id: 'c1', date: ymd(2026, 5, 1), title: 'Cleaner: CleanerTwo / Guest: CleanerTwonifer' },
    { id: 'c2', date: ymd(2026, 5, 1), title: 'Cleaner: CleanerOne / Guest: CleanerTwonifer' },
  ];
  assertArrayLength(findLegacyDuplicates(cleanings), 0, 'two canonical = no action');
}

function test_findLegacyDuplicates_unrelated_dates() {
  const cleanings = [
    { id: 'c1', date: ymd(2026, 5, 1), title: 'CleanerTwo Clean- CleanerTwonifer' },
    { id: 'c2', date: ymd(2026, 5, 19), title: 'Cleaner: CleanerTwo / Guest: Guest' },
  ];
  assertArrayLength(findLegacyDuplicates(cleanings), 0, 'different dates = no duplicate');
}
