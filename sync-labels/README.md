# Shaka GitHub Labels

These are YAML config files to maintain the labels used in our GitHub
repositories.  The `configs/common/` folder contains labels common across
repos, and each `.yaml` file in the other folders is named for the repository
it belongs to.  For example, `configs/shaka-project/shaka-player.yaml` is the
set of labels unique to the `shaka-project/shaka-player` repo.

Common labels are imported into each of the repo-specific config files with
YAML objects that such as this:

```yaml
- import: common/common.yaml
- import: common/browsers.yaml
```

The `alias` or `aliases` field will indicate old names that should be migrated
to the new one listed in the `name` field:

```yaml
- name: "flag: good first issue"
  aliases:
    - easy?
    - good first issue
  description: This might be a relatively easy issue; good for new contributors
  color: fef2c0

- name: "status: archived"
  alias: archived
  description: Archived and locked; will not be updated
  color: ededed
```


## Label Structure

Every label will consist of two parts: a heading and a value, separated by a
colon and a space.  For example, "archived" is a status, and will be labeled
with "status: archived".


## Label Headings

Some label headings will be common across projects, while some projects will
have unique headings based on the project.  For example, every project will have
a "status" heading, but only JavaScript projects will have a "browser" heading.

 * status: the issue's status, such as "working as intended" or "duplicate"
 * component: what project component the issue deals with (always
   project-specific)
 * flag: flags that can be attached to an issue, such as "seeking PR", "easy" or
   "bot ignore"
 * platform: what platforms are affected
 * browser: what browsers are affected (web-based projects only, see
   `common/browsers.yaml`)

The issue **type** (Bug, Feature, Docs, CI, Question, etc.) and **priority**
(Urgent, High, Medium, Low) were formerly labels but are now GitHub-native
issue fields, not managed here.
