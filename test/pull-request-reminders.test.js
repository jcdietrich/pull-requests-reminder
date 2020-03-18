const nock = require('nock');
const SlackMock = require('slack-mock');
const sandbox = require('sinon').createSandbox();
const test = require('ava');
const moment = require('moment');

const pr = require('../src/pull-request-reminders');
const slackMock = new SlackMock();

test.beforeEach(() => {
  sandbox.restore();
  nock.cleanAll();
  nock.enableNetConnect();
});

test.afterEach(() => {
  sandbox.restore();
  nock.cleanAll();
  nock.enableNetConnect();
});

test.serial('getAllPRs should call _getPRs n times', async t => {
  const repos = ['one', 'two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs')
    .resolves({ ignoreCount:0, usefulList: [] });

  await pr.getAllPRs(defaultOwner, repos);
  t.is(stub.callCount, repos.length);
});

test.serial('getAllPRs should call _getPRs n times, but no repeats', async t => {
  const repos = ['one', 'two', 'one'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs')
    .resolves({ ignoreCount:0, usefulList: [] });

  await pr.getAllPRs(defaultOwner, repos);
  t.is(stub.callCount, repos.length - 1);
});

test.serial('getAllPRs should use the given or default owner', async t => {
  const repos = ['one', 'otherOwner/two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs')
    .resolves({ ignoreCount:0, usefulList: [] });

  await pr.getAllPRs(defaultOwner, repos);
  t.true(stub.firstCall.calledWithExactly(defaultOwner, repos[0]));
  t.true(stub.secondCall.calledWithExactly('otherOwner', 'two'));
});

test.serial('getAllPRs calls with undefineds if repo name has more than one /', async t => {
  const repos = ['other/Owner/two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs')
    .resolves({ ignoreCount:0, usefulList: [], botList: [] });

  const result = await pr.getAllPRs(defaultOwner, repos);
  t.true(stub.firstCall.calledWithExactly(undefined, undefined));
  t.deepEqual(result, { ignoreCount: 0, prs: [], botPrs: [] });
});

test.serial('getAllPRs should flatten the arrays', async t => {
  const repos = ['one', 'two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs');
  stub.resolves({ usefulList: [1], ignoreCount: 0, botList: [] });

  const result = await pr.getAllPRs(defaultOwner, repos);
  t.deepEqual(result, { prs: [1,1], ignoreCount: 0, botPrs: [] });
});

test.serial('_getPRs calls github correctly', async t => {

  const repo = 'one';
  const owner = 'OwnER';

  const call1 = nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls`)
    .reply(200, []);

  await pr._getPRs(owner, repo);
  t.true(call1.isDone());
});

test.serial('_getPRs rejects if github call fails', async t => {

  const repo = 'one';
  const owner = 'OwnER';

  const call1 = nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls`)
    .reply(400, []);

  await t.throwsAsync(pr._getPRs(owner, repo));
  t.true(call1.isDone());
});

test.serial('_getPRs returns correctly if repo is undefined', async t => {

  const repo = undefined;
  const owner = 'OwnER';

  const result = await pr._getPRs(owner, repo);
  t.deepEqual(result, { ignoreCount: 0, usefulList: [] });
});

test.serial('formatSlackMessage should return undefined if there is no prs and non ignored', t => {
  const slackChannel = '#dummy';
  const prs = { ignoreCount: 0, prs: [] };

  const result = pr.formatSlackMessage(slackChannel, prs);
  t.is(result, undefined)
});

test.serial('formatSlackMessage should return no attachements if no prs but at least one ignored', t => {
  const slackChannel = '#dummy';
  const prs = { ignoreCount: 1, prs: [] };

  const result = pr.formatSlackMessage(slackChannel, prs);
  t.is(result.text, 'There are no open PRs, _1 ignored_');
  t.deepEqual(result.attachments, [])
});

test.serial('formatSlackMessage should a formatted slack message', t => {
  const slackChannel = '#dummy';
  const prs = [
    {
      title: 'title1',
      url: 'url1',
      repo: 'repo1',
      user: 'user1',
      created_at: Date.now(),
      labels: ['WIP'],
    },
    {
      title: 'title2',
      url: 'url2',
      repo: 'repo2',
      user: 'user2',
      created_at: Date.now(),
      labels: [],
    },
  ];

  const result = pr.formatSlackMessage(slackChannel, { ignoreCount: 0, prs });
  t.is(result.channel, slackChannel);
  t.is(result.text, '*This is a reminder that the following PRs are OPEN:*');
  t.is(result.attachments.length, prs.length);
  t.is(result.attachments[0].title, prs[0].title + ' [WIP]');
  t.is(result.attachments[1].title, prs[1].title);
});

test.serial('postMessage should return undefined if the message is undefined', async t => {
  const message = undefined;

  const result = await pr.postMessage(message);
  t.is(result, undefined);
});

test.serial('postMessage should call Slack correctly', async t => {
  const message = { channel: '#none', text: 'a message' };

  slackMock.reset();
  slackMock.web.addResponse({
    url: 'https://slack.com/api/chat.postMessage',
    statusCode: 200
  })

  const result = await pr.postMessage(message);
  t.is(slackMock.web.calls.length, 1);
  t.deepEqual(result, { ok: true, response_metadata: {} });
  slackMock.reset();
});

test.serial('_getColour should return green for a new PR', t => {
  const green = '#00FF00';
  const prDate = new moment();
  const returnValue = pr._getColour(prDate);

  t.is(returnValue, green);
});

test.serial('_getColour should return red for a PR x days old', t => {
  const red = '#FF0000';
  const x = 14;
  const prDate = new moment().subtract(x, 'days');
  const returnValue = pr._getColour(prDate, x);

  t.is(returnValue, red);
});

test.serial('_getColour should return red for a PR more than x days old', t => {
  const red = '#FF0000';
  const x = 14;
  const prDate = new moment().subtract(86, 'days');
  const returnValue = pr._getColour(prDate, x);

  t.is(returnValue, red);
});


test.serial('_getColour should return neither red nor green for a PR less than x days', t => {
  const red = '#FF0000';
  const green = '#00FF00';
  const x = 14;
  const prDate = new moment().subtract(x/2, 'days');
  const returnValue = pr._getColour(prDate, x);

  t.not(returnValue, red);
  t.not(returnValue, green);
});
