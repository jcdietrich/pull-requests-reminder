'use strict';

const pr = require('./pull-request-reminders.js');
const conf = require('./conf');

module.exports.remind = async () => {
  const prInfo = await pr.getAllPRs(conf.defaultOwner, conf.repos);
  const message = pr.formatSlackMessage(conf.slackChannel, prInfo);
  return pr.postMessage(conf.slackHook, message);
};
