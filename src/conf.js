module.exports = {
  slackChannel: process.env.SLACK_CHANNEL,
  slackHook: process.env.SLACK_HOOK,
  defaultOwner: process.env.DEFAULT_OWNER,
  repos: process.env.REPOSITORIES !== 'undefined' && process.env.REPOSITORIES !== undefined ? process.env.REPOSITORIES.split(',') : [],
  gitPersonalAccessToken: process.env.GIT_PERSONAL_ACCESS_TOKEN,
}
