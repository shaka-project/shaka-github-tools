/*! @license
 * Shaka Player Update Issues Tool
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview A set of classes to represent GitHub issues & comments.
 */

const core = require('@actions/core');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');
const { retry } = require("@octokit/plugin-retry");

const Octokit = GitHub.plugin(retry);
const octokit = new Octokit(getOctokitOptions(process.env.GITHUB_TOKEN));
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

// Values of "author_association" that indicate a team member:
const TEAM_ASSOCIATIONS = [
  'OWNER',
  'MEMBER',
  'COLLABORATOR',
];

const ACTIONS_BOT = 'github-actions[bot]';

/**
 * Compare two Numbers.  Can be used as a callback to Array.prototype.sort to
 * sort by number (ascending).
 *
 * @param {Number} a
 * @param {Number} b
 * @return {number}
 */
function compareNumbers(a, b) {
  // Sort NaNs to the end.
  if (isNaN(a) && isNaN(b)) {
    return 0;
  } else if (isNaN(a)) {
    return 1;
  } else if (isNaN(b)) {
    return -1;
  }

  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * Convert a Date to an age in days (by comparing with the current time).
 *
 * @param {!Date} d
 * @return {number} Time passed since d, in days.
 */
function dateToAgeInDays(d) {
  // getTime() and now() both return milliseconds, which we diff and then
  // convert to days.
  return (Date.now() - d.getTime()) / (86400 * 1000);
}

/**
 * A base class for objects returned by the GitHub API.
 */
class GitHubObject {
  /** @param {!Object} obj */
  constructor(obj) {
    /** @type {number} */
    this.id = obj.id;
    /** @type {number} */
    this.number = obj.number;
    /** @type {number} */
    this.ageInDays = NaN;
    /** @type {number} */
    this.closedDays = NaN;

    if (obj.created_at != null) {
      this.ageInDays = dateToAgeInDays(new Date(obj.created_at));
    }

    if (obj.closed_at != null) {
      this.closedDays = dateToAgeInDays(new Date(obj.closed_at));
    }
  }

  /** @return {string} */
  toString() {
    return JSON.stringify(this, null, '  ');
  }

  /**
   * @param {Function} listMethod A method from the octokit API, which will be
   *   passed to octokit.paginate.
   * @param {function(new:T, !Object)} SubClass
   * @param {!Object} parameters
   * @return {!Promise<!Array<!T>>}
   * @template T
   */
  static async getAll(listMethod, SubClass, parameters) {
    const query = { owner, repo, ...parameters };
    return (await octokit.paginate(listMethod, query))
        .map(obj => new SubClass(obj));
  }
}

class Comment extends GitHubObject {
  /** @param {!Object} obj */
  constructor(obj) {
    super(obj);
    /** @type {string} */
    this.author = obj.user.login;
    /** @type {string} */
    this.body = obj.body;
    /** @type {string} */
    this.authorAssociation = obj.author_association;
    /** @type {boolean} */
    this.fromTeam =
        TEAM_ASSOCIATIONS.includes(obj.author_association) ||
        this.author == ACTIONS_BOT;
  }

  /**
   * @param {number} issueNumber
   * @return {!Promise<!Array<!Comment>>}
   */
  static async getAll(issueNumber) {
    return GitHubObject.getAll(octokit.rest.issues.listComments, Comment, {
      issue_number: issueNumber,
    });
  }

  /**
   * Compare two Comments.  Can be used as a callback to Array.prototype.sort
   * to sort by creation time (descending, newest comments first).
   *
   * @param {!Comment} a
   * @param {!Comment} b
   * @return {number}
   */
  static compare(a, b) {
    // Put most recent comments first.
    return compareNumbers(a.ageInDays, b.ageInDays);
  }
}

class Event extends GitHubObject {
  /** @param {!Object} obj */
  constructor(obj) {
    super(obj);

    /** @type {string} */
    this.event = obj.event;

    if (obj.event == 'labeled') {
      /** @type {string} */
      this.label = obj.label.name;
    }
  }

  /**
   * @param {number} issueNumber
   * @return {!Promise<!Array<!Event>>}
   */
  static async getAll(issueNumber) {
    return GitHubObject.getAll(octokit.rest.issues.listEvents, Event, {
      issue_number: issueNumber,
    });
  }

  /**
   * Compare two Events.  Can be used as a callback to Array.prototype.sort
   * to sort by creation time (descending, newest events first).
   *
   * @param {!Event} a
   * @param {!Event} b
   * @return {number}
   */
  static compare(a, b) {
    // Put most recent events first.
    return compareNumbers(a.ageInDays, b.ageInDays);
  }
}

// Also could be a PR.  Both are returned by the GitHub issue API.
// PRs have issue.isPR == true.
class Issue extends GitHubObject {
  /** @param {!Object} obj */
  constructor(obj) {
    super(obj);
    /** @type {string} */
    this.author = obj.user.login;
    /** @type {!Array<string>} */
    this.labels = obj.labels.map(l => l.name);
    /**
     * The native issue type (e.g. "Bug"), or null if none is set.  Provided by
     * the REST issues API.
     * @type {?string}
     */
    this.type = obj.type ? obj.type.name : null;
    /** @type {boolean} */
    this.closed = obj.state == 'closed';
    /** @type {boolean} */
    this.locked = obj.locked;
    /** @type {boolean} */
    this.isPR = !!obj.pull_request;
    /** @type {boolean} */
    this.merged = obj.merged_at != null;
    /** @type {string} */
    this.name =
        (this.isPR ? 'PR #' : 'issue #') + this.number;
  }

  /**
   * @param {string} name
   * @return {boolean}
   */
  hasLabel(name) {
    return this.labels.includes(name);
  }

  /**
   * @param {!Array<string>} names
   * @return {boolean}
   */
  hasAnyLabel(names) {
    return this.labels.some(l => names.includes(l));
  }

  /**
   * @param {string} name
   * @return {!Promise<number}
   */
  async getLabelAgeInDays(name) {
    const events = await Event.getAll(this.number);
    // Put the most recent events first.
    events.sort(Event.compare);

    for (const event of events) {
      if (event.label == name) {
        return event.ageInDays;
      }
    }

    throw new Error(`Unable to find age of label "${name}"!`);
  }

  /**
   * @param {string} name
   * @return {!Promise}
   */
  async addLabel(name) {
    if (this.hasLabel(name)) {
      return;
    }

    core.notice(`Adding label "${name}" to issue #${this.number}`);
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: this.number,
      labels: [name],
    });
    this.labels.push(name);
  }

  /**
   * @param {string} name
   * @return {!Promise}
   */
  async removeLabel(name) {
    if (!this.hasLabel(name)) {
      return;
    }

    core.notice(`Removing label "${name}" from issue #${this.number}`);
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: this.number,
      name,
    });
    this.labels = this.labels.filter(l => l != name);
  }

  /** @return {!Promise} */
  async lock() {
    if (this.locked) {
      return;
    }

    core.notice(`Locking issue #${this.number}`);
    await octokit.rest.issues.lock({
      owner,
      repo,
      issue_number: this.number,
      lock_reason: 'resolved',
    });
    this.locked = true;
  }

  /** @return {!Promise} */
  async unlock() {
    if (!this.locked) {
      return;
    }

    core.notice(`Unlocking issue #${this.number}`);
    await octokit.rest.issues.unlock({
      owner,
      repo,
      issue_number: this.number,
    });
    this.locked = false;
  }

  /** @return {!Promise} */
  async close() {
    if (this.closed) {
      return;
    }

    core.notice(`Closing issue #${this.number}`);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: this.number,
      state: 'closed',
    });
    this.closed = true;
  }

  /** @return {!Promise} */
  async reopen() {
    if (!this.closed) {
      return;
    }

    core.notice(`Reopening issue #${this.number}`);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: this.number,
      state: 'open',
    });
    this.closed = false;
  }

  /**
   * @param {string} body
   * @return {!Promise}
   */
  async postComment(body) {
    core.notice(`Posting to issue #${this.number}: "${body}"`);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: this.number,
      body,
    });

    if (this.comments) {
      this.comments.push(new Comment({
        created_at: (new Date()).toJSON(),
        user: {login: 'shaka-bot'},
        body,
      }));
    }
  }

  /**
   * Important: Don't load comments by default!  Only some issues need
   * comments checked, and we don't want to exceed our query quota by loading
   * all comments for all issues.
   *
   * @return {!Promise}
   */
  async loadComments() {
    if (this.comments) {
      return;
    }

    this.comments = await Comment.getAll(this.number);
    // Puts most recent comments first.
    this.comments.sort(Comment.compare);
  }

  /** @return {!Promise<!Array<!Issue>>} */
  static async getAll() {
    const all = await GitHubObject.getAll(
        octokit.rest.issues.listForRepo, Issue, {
          state: 'all',
        });
    return all;
  }
}

module.exports = {
  Issue,
};
