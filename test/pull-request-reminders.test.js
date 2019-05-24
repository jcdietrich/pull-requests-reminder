const nock = require('nock')
const sandbox = require('sinon').createSandbox();
const test = require('ava');

const pr = require('../src/pull-request-reminders');
/*
  getAllPRs,
  postMessage,
  formatSlackMessage,
  _getPRs,
 */
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

  const stub = sandbox.stub(pr, '_getPRs');

  await pr.getAllPRs(defaultOwner, repos);
  t.is(stub.callCount, repos.length);
});

test.serial('getAllPRs should call _getPRs n times, but no repeats', async t => {
  const repos = ['one', 'two', 'one'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs');

  await pr.getAllPRs(defaultOwner, repos);
  t.is(stub.callCount, repos.length - 1);
});

test.serial('getAllPRs should use the given or default owner', async t => {
  const repos = ['one', 'otherOwner/two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs');

  await pr.getAllPRs(defaultOwner, repos);
  t.true(stub.firstCall.calledWithExactly(defaultOwner, repos[0]));
  t.true(stub.secondCall.calledWithExactly('otherOwner', 'two'));
});

test.serial('getAllPRs calls with undefineds if repo name has more than one /', async t => {
  const repos = ['other/Owner/two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs');

  const result = await pr.getAllPRs(defaultOwner, repos);
  t.true(stub.firstCall.calledWithExactly(undefined, undefined));
  t.deepEqual(result, []);
});

test.serial('getAllPRs should flatten the arrays', async t => {
  const repos = ['one', 'two'];
  const defaultOwner = 'OwnER';

  const stub = sandbox.stub(pr, '_getPRs');
  stub.returns(Promise.resolve([1]));

  const result = await pr.getAllPRs(defaultOwner, repos);
  t.deepEqual(result, [1,1]);
});

test.serial('_getPRs calls github correctly', async t => {

  const repo = 'one';
  const owner = 'OwnER';

  const call1 = nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls`)
    .reply('200', []);

  await pr._getPRs(owner, repo);
  t.true(call1.isDone());
});

test.serial('_getPRs rejects if github call fails', async t => {

  const repo = 'one';
  const owner = 'OwnER';

  const call1 = nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls`)
    .reply('400', []);

  await t.throwsAsync(pr._getPRs(owner, repo));
  t.true(call1.isDone());
});

test.serial('_getPRs returns [] if repo is undefined', async t => {

  const repo = undefined;
  const owner = 'OwnER';

  const result = await pr._getPRs(owner, repo);
  t.deepEqual(result, []);
});

test.serial('formatSlackMessage should return undefined if there is no prs', t => {
  const slackChannel = '#dummy';
  const prs = [];

  const result = pr.formatSlackMessage(slackChannel, prs);
  t.is(result, undefined)
});

test.serial('formatSlackMessage should a formatted slack message', t => {
  const slackChannel = '#dummy';
  const prs = [
    {
      title: 'title1',
      url: 'url1',
      repo: 'repo1',
      user: 'user1',
      created_at: Date.now()
    },
    {
      title: 'title2',
      url: 'url2',
      repo: 'repo2',
      user: 'user2',
      created_at: Date.now()
    },
  ];

  const result = pr.formatSlackMessage(slackChannel, prs);
  t.is(result.channel, slackChannel);
  t.is(result.text, '*This is a reminder that the following PRs are OPEN:*');
  t.is(result.attachments.length, prs.length);
  t.is(result.attachments[0].title, prs[0].title);
  t.is(result.attachments[1].title, prs[1].title);
});

test.serial('postMessage should return undefined if the message is undefined', async t => {
  const slackHook = 'http://example.org/slackHook';
  const message = undefined;

  const result = await pr.postMessage(slackHook, message);
  t.is(result, undefined);
});

test.serial('postMessage should call Slack correctly', async t => {

  const slackHook = 'http://example.org/slackHook';
  const message = 'a message';

  const call1 = nock('http://example.org')
    .post('/slackHook', JSON.stringify(message))
    .reply('200', []);

  const result = await pr.postMessage(slackHook, message);
  t.is(result, undefined);
  t.true(call1.isDone());
});

test.serial('postMessage should throw if Slack call fails', async t => {

  const slackHook = 'http://example.org/slackHook';
  const message = 'a message';

  const call1 = nock('http://example.org')
    .post('/slackHook', JSON.stringify(message))
    .reply('400', []);

  await t.throwsAsync(pr.postMessage(slackHook, message));
  t.true(call1.isDone());
})
