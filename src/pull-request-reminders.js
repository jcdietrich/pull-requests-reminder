const _ = require('lodash');
const Git = require('@octokit/rest');
const logger = require('pino')();
const moment = require('moment');
const color = require('color-convert');
const { WebClient } = require('@slack/web-api');

const conf = require('./conf');

const slack = new WebClient(conf.slackToken);
const alwaysAppendedText = conf.alwaysAppendedText;

const git = new Git({
  auth: conf.gitPersonalAccessToken,
});

const isBot = pr => pr.user.match(/\[bot\]/);

const _getPRs = async (owner, repo) => {
  if (repo === undefined){
    return { ignoreCount:0, usefulList:[] };
  }

  logger.info({owner, repo}, 'fetching PRs')
  let page = 0;
  let data = [];
  let rawList;

  do {
    page = page + 1;
    rawList = await git.pulls.list({
      owner,
      repo,
      per_page: 100,
      page,
    });
    data = data.concat(rawList.data)
  } while (rawList.headers.link && rawList.headers.link.includes('next'))

  const numberBeforeFilter = data.length;

  data = data.filter(pr => {
    const reviewers = _.flatten(pr.requested_reviewers.map(reviewer => reviewer.login));
    return conf.logins.filter(login => reviewers.includes(login)).length;
  });

logger.info({ repo, owner, numberAfterFilter: data.length, numberBeforeFilter});

  let usefulList = await Promise.all(data.map(pr =>
    module.exports._getUsefulList(owner, repo, pr)));

  const fullCount = usefulList.length;

  usefulList = _.filter(usefulList, pr => {
    return conf.ignoreWords.reduce((memo, ignoreWord) => {
      const noIgnoreWords = !pr.title.match(ignoreWord);
      return noIgnoreWords && memo;
    }, true)
      && conf.ignoreLabels.reduce((memo, ignoreLabel) => {
        const noIgnoreLabels = pr.labels.reduce((memo, label) => {
          return !label.match(ignoreLabel) && memo;
        }, true);
        return noIgnoreLabels && memo;
      }, true)
  })

  const ignoreCount = fullCount - usefulList.length;
  const botList = usefulList.filter(isBot);
  usefulList = usefulList.filter(pr => !isBot(pr));

  return {
    usefulList,
    botList,
    ignoreCount,
  };
}

const _getUsefulList = async (owner, repo, pr) => {
  const approvalFull = await git.pulls.listReviews({
    owner,
    repo,
    pull_number: pr.number
  });

  let commitsFull;
  let page = 0;

  do {
    page = page + 1;
    commitsFull = await git.pulls.listCommits({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
      page
    });

  } while (commitsFull.headers.link && commitsFull.headers.link.includes('next'))

  const approvals = approvalFull.data.filter(r => r.state === 'APPROVED').length;
  const commitDates = commitsFull.data.map(x => x.commit.committer.date).sort();
  const lastCommitDate = commitDates[commitDates.length - 1]

  return {
    url: pr._links.html.href,
    title: pr.title,
    user: pr.user.login,
    created_at: pr.created_at,
    repo: pr.base.repo.full_name,
    labels: pr.labels.map(label => label.name),
    approvals,
    lastCommitDate
  };
};

const getAllPRs = async (defaultOwner, repos) => {
  let allPRs = await Promise.all(_.uniq(repos)
    .map(async repoFull => {
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

      const prInfo = await module.exports._getPRs(owner, repo);
      return prInfo
    }));

    allPRs = allPRs.reduce((memo, result) => {
      if (result === undefined) {
        return memo;
      }
      memo.ignoreCount += result.ignoreCount;
      memo.prs = memo.prs.concat(result.usefulList);
      memo.botPrs = memo.botPrs.concat(result.botList);
      return memo;
    }, {
      ignoreCount: 0,
      prs: [],
      botPrs: [],
    });

  allPRs.prs = _.flatten(allPRs.prs);
  allPRs.botPrs = _.flatten(allPRs.botPrs);

  return allPRs;
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

const formatSlackMessage = (slackChannel, {
  ignoreCount,
  prs,
  thread_ts,
}) => {
  let text = '*This is a reminder that the following PRs are OPEN:*';
  const attachments = prs.map(pr => {
    const attachment = {
      color: _getColour(pr.created_at),
      title: pr.title,
      title_link: pr.url,
      text: `in *${pr.repo}* by ${pr.user}\ncreated ${moment(pr.created_at).fromNow()}, last commit ${moment(pr.lastCommitDate).fromNow()} (approvals: ${pr.approvals})`,
      mrkdwn_in: ['text'],
    }

    if (pr.labels.length > 0) {
      const labels = ` [${pr.labels.join('][')}]`;
      attachment.title += labels;
    }

    return attachment;
  });

  if (ignoreCount > 0) {
    if (attachments.length === 0) {
      text = `There are no open PRs,`
    }
      text += ` _${ignoreCount} ignored_`;
  }

  if (alwaysAppendedText !== ''){
    const alwaysAppendedAttachment = {
      text: alwaysAppendedText,
      mrkdwn_in: ['text'],
    };
    attachments.push(alwaysAppendedAttachment);
  }

  if(attachments.length > 0 || ignoreCount > 0) {
    return {
      channel: slackChannel,
      text,
      attachments,
      thread_ts,
    };
  }
  return;
}

const postMessage = async (message) => {
  if (message === undefined) {
    logger.info('No open PRs');
    return undefined;
  }
  return slack.chat.postMessage(message);
}

module.exports = {
  getAllPRs,
  postMessage,
  formatSlackMessage,
  _getUsefulList,
  _getPRs,
  _getColour,
}
