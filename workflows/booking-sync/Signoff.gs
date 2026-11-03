/**
 * Shared sign-off block that closes every run's log or report.
 * Order: platform, automation name, purpose, cadence, this run's time in PT, link.
 */
function formatPacific_(date) {
  var d = date || new Date();
  var parts = Utilities.formatDate(d, 'America/Los_Angeles', 'MMM d, yyyy h:mm a');
  return parts + ' PT';
}

function automationSignoff_(cfg, date) {
  ['platform', 'name', 'purpose', 'cadence', 'link'].forEach(function (key) {
    if (!cfg || !cfg[key] || !String(cfg[key]).trim()) {
      throw new Error('sign-off ' + key + ' is required');
    }
  });
  return [
    '--',
    'Platform: ' + cfg.platform,
    'Automation: ' + cfg.name,
    'Purpose: ' + cfg.purpose,
    'Cadence: ' + cfg.cadence,
    'Last run: ' + formatPacific_(date),
    'Link: ' + cfg.link
  ].join('\n');
}
