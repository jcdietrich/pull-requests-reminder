module.exports = {
  slackChannel: process.env.SLACK_CHANNEL,
  slackToken: process.env.SLACK_TOKEN,
  slackHook: process.env.SLACK_HOOK,
  defaultOwner: process.env.DEFAULT_OWNER,
  repos: process.env.REPOSITORIES !== 'undefined' && process.env.REPOSITORIES !== undefined ? process.env.REPOSITORIES.split(',') : [],
  gitPersonalAccessToken: process.env.GIT_PERSONAL_ACCESS_TOKEN,
  daysToRed: process.env.DAYS_TO_RED || 14,
  ignoreWords: process.env.IGNORE_WORDS !== 'undefined' && process.env.IGNORE_WORDS !== undefined ? process.env.IGNORE_WORDS.split(',') : [],
  ignoreLabels: process.env.IGNORE_LABELS !== 'undefined' && process.env.IGNORE_LABELS !== undefined ? process.env.IGNORE_LABELS.split(',') : [],
  alwaysAppendedText: process.env.ALWAYS_APPENDED_TEXT
}
