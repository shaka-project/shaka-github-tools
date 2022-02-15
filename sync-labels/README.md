# Shaka GitHub Labels

These are YAML config files to maintain the labels used in our GitHub
repositories.  The `configs/common/` folder contains labels common across
repos, and each `.yaml` file in the other folders is named for the repository
it belongs to.  For example, `configs/google/shaka-player.yaml` is the set of
labels unique to the `google/shaka-player` repo.

Common labels are imported into each of the repo-specific config files with
YAML objects that such as this:

```yaml
- import: common/common.yaml
- import: common/browsers.yaml
```

The `alias` or `aliases` field will indicate old names that should be migrated
to the new one listed in the `name` field:

```yaml
- name: "type: announcement"
  aliases:
    - type:announcement
    - announcement
    - survey
  description: An announcement from the team; generally pinned to the top
  color: C2E0C6

- name: "type: bug"
  alias: bug
  description: Something isn't working correctly
  color: fc2929
```


## Label Structure

Every label will consist of two parts: a heading and a value, separated by a
colon and a space.  For example, "bug" is a type of issue, and will be labeled
with "type: bug".


## Label Headings

Some label headings will be common across projects, while some projects will
have unique headings based on the project.  For example, every project will have
a "type" heading, but only JavaScript projects will have a "browser" heading.

 * type: the type of issue, such as "bug" or "enhancement"
 * status: the issue's status, such as "working as intended" or "duplicate"
 * component: what project component the issue deals with (always
   project-specific)
 * flag: flags that can be attached to an issue, such as "seeking PR", "easy" or
   "bot ignore"
 * priority: P0 - P4, as defined by Google for its internal bug tracker
 * platform: what platforms are affected
 * browser: what browsers are affected (web-based projects only, see
   `common/browsers.yaml`)
