'use strict';

const pr = require('./pull-request-reminders.js');
const conf = require('./conf');

module.exports.remind = async () => {
  const prInfo = await pr.getAllPRs(conf.defaultOwner, conf.repos);
  const message = pr.formatSlackMessage(conf.slackChannel, prInfo);
  const postInfo = await pr.postMessage(message);

  if (prInfo.botPrs.length){
    const reply = pr.formatSlackMessage(conf.slackChannel, {
      ignoreCount: 0,
      prs: prInfo.botPrs,
      thread_ts: postInfo.ts,
    });
    await pr.postMessage(reply);
  }

  return postInfo
};
