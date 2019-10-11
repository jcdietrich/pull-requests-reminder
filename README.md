# pull-requests-reminder
Send a reminder to slack for open pull requests using a timed AWS lambda function

To use:
* clone the repo
* npm install
* `serverless deploy` with the following options:
  * `--slack-channel <SLACK CHANNEL>` (note: the channel will be in the format `\#channelName`)
  * `--slack-token <SLACK OAUTH ACCESS TOKEN>`
  * `--default-owner <DEFAULT GITHUB REPO OWNER>` the default user or org used for repos where a owner is not specified.
  * `--repos <COMMA SEPARATED REPO LIST>` repo list, specify the owner/repo unless owner is the default one
  * `--git-pat <GIT PERSONAL ACCESS TOKEN>`
  * `--schedule <RATE OR CRON SCHEDULE>` See [Amazon's documentation on schedule expressions]
  * `--ignore-words <COMMA SEPARATED LIST OF IGNORE WORDS>` 
  * `--ignore-labels <COMMA SEPARATED LIST OF IGNORE LABELS>`

(https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html) (Note: this will need to be passed in quotes)
