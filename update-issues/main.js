/*! @license
 * Shaka Player Update Issues Tool
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview A workflow tool to maintain GitHub issues.
 */

const core = require('@actions/core');
const { Issue, Milestone } = require('./issues.js');

const TYPE_ACCESSIBILITY = 'type: accessibility';
const TYPE_ANNOUNCEMENT = 'type: announcement';
const TYPE_BUG = 'type: bug';
const TYPE_CI = 'type: CI';
const TYPE_CODE_HEALTH = 'type: code health';
const TYPE_DOCS = 'type: docs';
const TYPE_ENHANCEMENT = 'type: enhancement';
const TYPE_PERFORMANCE = 'type: performance';
const TYPE_PROCESS = 'type: process';
const TYPE_QUESTION = 'type: question';

const PRIORITY_P0 = 'priority: P0';
const PRIORITY_P1 = 'priority: P1';
const PRIORITY_P2 = 'priority: P2';
const PRIORITY_P3 = 'priority: P3';
const PRIORITY_P4 = 'priority: P4';

const STATUS_ARCHIVED = 'status: archived';
const STATUS_WAITING = 'status: waiting on response';

const FLAG_IGNORE = 'flag: bot ignore';

// Issues of these types default to the next milestone.  See also
// BACKLOG_PRIORITIES below, which can override the type.
const LABELS_FOR_NEXT_MILESTONE = [
  TYPE_ACCESSIBILITY,
  TYPE_BUG,
  TYPE_DOCS,
];

// Issues of these types default to the backlog.
const LABELS_FOR_BACKLOG = [
  TYPE_CI,
  TYPE_CODE_HEALTH,
  TYPE_ENHANCEMENT,
  TYPE_PERFORMANCE,
];

// An issue with one of these priorities will default to the backlog, even if
// it has one of the types in LABELS_FOR_NEXT_MILESTONE.
const BACKLOG_PRIORITIES = [
  PRIORITY_P3,
  PRIORITY_P4,
];

const PING_QUESTION_TEXT =
    'Does this answer all your questions? ' +
    'If so, would you please close the issue?';

const CLOSE_STALE_TEXT =
    'Closing due to inactivity. If this is still an issue for you or if you ' +
    'have further questions, the OP can ask shaka-bot to reopen it by ' +
    'including `@shaka-bot reopen` in a comment.';

const PING_INACTIVE_QUESTION_DAYS = 4;
const CLOSE_AFTER_WAITING_DAYS = 7;
const ARCHIVE_AFTER_CLOSED_DAYS = 60;


async function archiveOldIssues(issue) {
  // If the issue has been closed for a while, archive it.
  // Exclude locked issues, so that this doesn't conflict with unarchiveIssues
  // below.
  if (!issue.locked && issue.closed &&
      issue.closedDays >= ARCHIVE_AFTER_CLOSED_DAYS) {
    await issue.addLabel(STATUS_ARCHIVED);
    await issue.lock();
  }
}

async function unarchiveIssues(issue) {
  // If the archive label is removed from an archived issue, unarchive it.
  if (issue.locked && !issue.hasLabel(STATUS_ARCHIVED)) {
    await issue.unlock();
    await issue.reopen();
  }
}

async function reopenIssues(issue) {
  // If the original author wants an issue reopened, reopen it.
  if (issue.closed && !issue.hasLabel(STATUS_ARCHIVED)) {
    // Important: only load comments if prior filters pass!
    // If we loaded them on every issue, we could exceed our query quota!
    await issue.loadComments();

    for (const comment of issue.comments) {
      body = comment.body.toLowerCase();
      if (comment.author == issue.author &&
          comment.ageInDays <= issue.closedDays &&
          body.includes('@shaka-bot') &&
          (body.includes('reopen') || body.includes('re-open'))) {
        core.notice(`Found reopen request for issue #${issue.number}`);
        await issue.reopen();
        break;
      }
    }
  }
}

async function manageWaitingIssues(issue) {
  // Filter for waiting issues.
  if (!issue.closed && issue.hasLabel(STATUS_WAITING)) {
    const labelAgeInDays = await issue.getLabelAgeInDays(STATUS_WAITING);

    // If an issue has been replied to, remove the waiting tag.
    // Important: only load comments if prior filters pass!
    // If we loaded them on every issue, we could exceed our query quota!
    await issue.loadComments();

    const latestNonTeamComment = issue.comments.find(c => !c.fromTeam);
    if (latestNonTeamComment &&
        latestNonTeamComment.ageInDays < labelAgeInDays) {
      await issue.removeLabel(STATUS_WAITING);
      return;
    }

    // If an issue has been in a waiting state for too long, close it as stale.
    if (labelAgeInDays >= CLOSE_AFTER_WAITING_DAYS) {
      await issue.postComment(CLOSE_STALE_TEXT);
      await issue.close();
    }
  }
}

async function cleanUpIssueTags(issue) {
  // If an issue with the waiting tag was closed, remove the tag.
  if (issue.closed && issue.hasLabel(STATUS_WAITING)) {
    await issue.removeLabel(STATUS_WAITING);
  }
}

async function pingQuestions(issue) {
  // If a question hasn't been responded to recently, ping it.
  if (!issue.closed &&
      issue.hasLabel(TYPE_QUESTION) &&
      !issue.hasLabel(STATUS_WAITING)) {
    // Important: only load comments if prior filters pass!
    // If we loaded them on every issue, we could exceed our query quota!
    await issue.loadComments();

    // Most recent ones are first.
    const lastComment = issue.comments[0];
    if (lastComment &&
        lastComment.fromTeam &&
        // If the last comment was from the team, but not from the OP (in case
        // the OP was a member of the team).
        lastComment.author != issue.author &&
        lastComment.ageInDays >= PING_INACTIVE_QUESTION_DAYS) {
      await issue.postComment(`@${issue.author} ${PING_QUESTION_TEXT}`);
      await issue.addLabel(STATUS_WAITING);
    }
  }
}

async function maintainMilestones(issue, nextMilestone, backlog) {
  // Set or remove milestones based on type labels.
  if (!issue.closed) {
    if (issue.hasAnyLabel(LABELS_FOR_NEXT_MILESTONE)) {
      if (!issue.milestone) {
        // Some (low) priority flags will indicate that an issue should go to
        // the backlog, in spite of its type.
        if (issue.hasAnyLabel(BACKLOG_PRIORITIES)) {
          await issue.setMilestone(backlog);
        } else {
          await issue.setMilestone(nextMilestone);
        }
      }
    } else if (issue.hasAnyLabel(LABELS_FOR_BACKLOG)) {
      if (!issue.milestone) {
        await issue.setMilestone(backlog);
      }
    } else {
      if (issue.milestone) {
        await issue.removeMilestone();
      }
    }
  }
}


const ALL_ISSUE_TASKS = [
  reopenIssues,
  archiveOldIssues,
  unarchiveIssues,
  manageWaitingIssues,
  cleanUpIssueTags,
  pingQuestions,
  maintainMilestones,
];

async function processIssues(issues, nextMilestone, backlog) {
  let success = true;

  for (const issue of issues) {
    if (issue.hasLabel(FLAG_IGNORE)) {
      core.info(`Ignoring issue #${issue.number}`);
      continue;
    }

    core.info(`Processing issue #${issue.number}`);

    for (const task of ALL_ISSUE_TASKS) {
      try {
        await task(issue, nextMilestone, backlog);
      } catch (error) {
        // Make this show up in the Actions UI without needing to search the
        // logs.
        core.error(
            `Failed to process issue #${issue.number} in task ${task.name}: ` +
            `${error}\n${error.stack}`);
        success = false;
      }
    }
  }

  return success;
}

async function main() {
  const milestones = await Milestone.getAll();
  const issues = await Issue.getAll();

  const backlog = milestones.find(m => m.isBacklog());
  if (!backlog) {
    core.error('No backlog milestone found!');
    process.exit(1);
  }

  milestones.sort(Milestone.compare);
  let nextMilestone = milestones[0];
  if (nextMilestone.version == null) {
    core.warning('No version milestone found!  Using backlog instead.');
    nextMilestone = backlog;
  }

  const success = await processIssues(issues, nextMilestone, backlog);
  if (!success) {
    process.exit(1);
  }
}

// If this file is the entrypoint, run main.  Otherwise, export certain pieces
// to the tests.
if (require.main == module) {
  main();
} else {
  module.exports = {
    processIssues,
    TYPE_ACCESSIBILITY,
    TYPE_ANNOUNCEMENT,
    TYPE_BUG,
    TYPE_CODE_HEALTH,
    TYPE_DOCS,
    TYPE_ENHANCEMENT,
    TYPE_PROCESS,
    TYPE_QUESTION,
    PRIORITY_P0,
    PRIORITY_P1,
    PRIORITY_P2,
    PRIORITY_P3,
    PRIORITY_P4,
    STATUS_ARCHIVED,
    STATUS_WAITING,
    FLAG_IGNORE,
  };
}
