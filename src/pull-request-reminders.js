const _ = require('lodash');
const Git = require('@octokit/rest');
const logger = require('pino')();
const moment = require('moment');
const request = require('request-promise-native');
const color = require('color-convert');

const conf = require('./conf');

const git = new Git({
  auth: conf.gitPersonalAccessToken,
});

const _getPRs = async (owner, repo) => {
  if (repo === undefined){
    return [];
  }

  logger.info({owner, repo}, 'fetching PRs')

  const rawList = await git.pulls.list({
    owner,
    repo,
  });
  const usefulList = rawList.data.map(pr => ({
    url: pr._links.html.href,
    title: pr.title,
    user: pr.user.login,
    created_at: pr.created_at,
    repo: pr.base.repo.full_name,
    labels: pr.labels.map(label => label.name),
  }));

  return usefulList;
}

const getAllPRs = async (defaultOwner, repos) => {
  const allPRs = await Promise.all(_.uniq(repos).map(async repoFull => {
    let repo;
    let owner;
    const parts = repoFull.split('/');

    switch (parts.length) {
      case 1:
        owner = defaultOwner;
        repo = parts[0];
        break;
      case 2:
        owner = parts[0];
        repo = parts[1];
        break;
      default:
        logger.error(`invalid repo name: ${repoFull}`);
    }

    return  module.exports._getPRs(owner, repo);
  }));
  return  _.filter(_.flatten(allPRs), x => x !== undefined);
};

const _getColour = (createDate, daysToRed = conf.daysToRed) => {
  const now = new moment();
  const days = now.diff(moment(createDate), 'days');
  const diff = Math.round(256 / daysToRed);
  var r = daysToRed === days ? 255 : Math.min(days * diff, 255);
  var g = 255 - (r);
  const b = 0;

  return `#${color.rgb.hex(r, g, b)}`;
};

const formatSlackMessage = (slackChannel, prs) => {
  const text = '*This is a reminder that the following PRs are OPEN:*';
  const attachments = prs.map(pr => {
    const attachment = {
      color: _getColour(pr.created_at),
      title: pr.title,
      title_link: pr.url,
      text: `in *${pr.repo}* by ${pr.user} created ${moment(pr.created_at).fromNow()}`,
      mrkdwn_in: ['text'],
    }

    if (pr.labels.length > 0) {
      const labels = ` [${pr.labels.join('][')}]`;
      attachment.title += labels;
    }

    return attachment;
  });

  if(attachments.length > 0) {
    return {
      channel: slackChannel,
      text,
      attachments,
    };
  }
  return;
}

const postMessage = async (slackHook, message) => {
  if (message === undefined) {
    logger.info('No open PRs');
    return;
  }
  var options = {
    uri: slackHook,
    method: 'POST',
    json: true,
    body: message,
    retry : 2
  };
  try {
    const response = await request(options);
    logger.info({ response }, 'Received Slack API response');
    return;
  } catch(err) {
    logger.error({ options }, 'Error posting message');
    throw err;
  }
}

module.exports = {
  getAllPRs,
  postMessage,
  formatSlackMessage,
  _getPRs,
  _getColour,
}
