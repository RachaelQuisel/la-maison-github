// Example roster only. Real contact information belongs in your private project.
const RUN_ENABLED = false;
const CALENDAR_ID = 'ADD_YOUR_CALENDAR_ID';
const OWNER_EMAIL = 'owner@example.invalid';
const LOOKAHEAD_DAYS = 90;
const CLEANING_START_HOUR = 11;
const CLEANING_END_HOUR = 16;
const COVERAGE_WINDOW_DAYS = 1;
const TIMEZONE = 'America/Los_Angeles';
const CLEANERS = {
  secondCleaner: {name: 'CleanerTwo', email: 'cleaner-two@example.invalid', phone: null, slackUserId: null, preferredChannel: 'email'},
  firstCleaner: {name: 'CleanerOne', email: 'cleaner-one@example.invalid', phone: null, slackUserId: null, preferredChannel: 'email'},
  sundayCleaner: {name: 'SundayCleaner', email: null, phone: null, slackUserId: null, preferredChannel: 'sms'},
  reliefCleaner: {name: 'ReliefCleaner', email: 'relief@example.invalid', phone: null, slackUserId: null, preferredChannel: 'email'},
  owner: {name: 'Owner', email: OWNER_EMAIL, phone: null, slackUserId: null, preferredChannel: 'email'}
};
const OWNER = {name: 'Owner', email: OWNER_EMAIL, phone: null, slackUserId: null, preferredChannel: 'email'};
