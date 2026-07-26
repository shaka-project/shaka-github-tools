/*! @license
 * Shaka Player Update Issues Tool
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Mocks for the classes in issues.js
 */

function randomInt() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
let nextIssueNumber = 1;

class MockGitHubObject {
  constructor(subclassDefaults, params) {
    const defaults = {
      id: randomInt(),
      ageInDays: 0,
      closedDays: 0,

      ...subclassDefaults,
    };

    const mergedParams = {
      ...defaults,
      ...params,
    };

    for (const k in mergedParams) {
      this[k] = mergedParams[k];
    }
  }

  toString() {
    return JSON.stringify(this, null, '  ');
  }
}

class MockComment extends MockGitHubObject {
  constructor(params) {
    const defaults = {
      author: 'SomeUser',
      body: 'Howdy!',
      authorAssociation: 'NONE',
      fromTeam: false,
    };

    super(defaults, params);
  }
}

class MockIssue extends MockGitHubObject {
  constructor(params) {
    const defaults = {
      number: nextIssueNumber++,
      author: 'SomeUser',
      labels: [],
      type: null,
      closed: false,
      locked: false,
      comments: [],
      isPR: false,
      merged: false,
    };

    super(defaults, params);

    this.getLabelAgeInDays =
        jasmine.createSpy('getLabelAgeInDays')
            .and.returnValue(params.labelAgeInDays || 0);
    this.addLabel = jasmine.createSpy('addLabel').and.callFake((name) => {
      console.log(`Adding label ${name}`);
      this.labels.push(name);
    });
    this.removeLabel = jasmine.createSpy('removeLabel').and.callFake((name) => {
      console.log(`Removing label ${name}`);
      this.labels = this.labels.filter(l => l != name);
    });
    this.lock = jasmine.createSpy('lock').and.callFake(() => {
      console.log('Locking');
      this.locked = true;
    });
    this.unlock = jasmine.createSpy('unlock').and.callFake(() => {
      console.log('Unlocking');
      this.locked = false;
    });
    this.close = jasmine.createSpy('close').and.callFake(() => {
      console.log('Closing');
      this.closed = true;
    });
    this.reopen = jasmine.createSpy('reopen').and.callFake(() => {
      console.log('Reopening');
      this.closed = false;
    });
    this.postComment = jasmine.createSpy('postComment').and.callFake((body) => {
      console.log(`Posting comment: ${body}`);
      this.comments.push(new MockComment({body}));
    });
    this.loadComments = jasmine.createSpy('loadComments');
    this.name =
        (this.isPR ? 'PR #' : 'issue #') + this.number;
  }

  hasLabel(name) {
    return this.labels.includes(name);
  }

  hasAnyLabel(names) {
    return this.labels.some(l => names.includes(l));
  }
}

module.exports = {
  MockComment,
  MockIssue,
};
