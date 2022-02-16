#!/bin/bash

# Shaka Interactive Cherry-Pick Tool
# Copyright 2022 Google LLC
# SPDX-License-Identifier: Apache-2.0

limit_tag="$1"

if [[ "$limit_tag" == "" ]]; then
  echo "Usage: $0 <LIMIT_TAG> [<UPSTREAM_REMOTE> [<MAIN_BRANCH>]]"
  exit 1
fi

upstream_remote="${2:-origin}"
main_branch="$upstream_remote/${3:-master}"
local_target_branch=$(git branch --show-current)

# Read one key as input.
prompt="Cherry-pick from $main_branch into local $local_target_branch, starting with $limit_tag"
read -n 1 -p "$prompt (y/n)? " yn

# Add a newline to the terminal after the user presses a key.
echo

# If it's "y", continue.  Otherwise, quit.
case $yn in
  [yY]) true ;;
  *) exit ;;
esac

set -e

# The root of the project.
root_dir=$(git rev-parse --show-cdup)

# This file name (git-rebase-todo) will trigger syntax highlighting in editors.
cp_list="${root_dir:-.}/.git/shaka-cherry-picks/git-rebase-todo"

# Use the user's preferred visual editor, then fall back to the user's
# preferred terminal editor, then fall back to nano.
editor="${VISUAL:-${EDITOR:-nano}}"

# Update the remote.
git fetch "$upstream_remote"

# Check that the limit tag makes sense.
if ! git merge-base --is-ancestor "$limit_tag" "$main_branch"; then
  echo "$limit_tag does not appear to be an ancestor of $main_branch!"
  exit 1
fi

# Make a list of potential commits to cherry-pick.  Those with leading plus
# signs are ones that may not be present in the target branch.
mkdir -p "$(dirname "$cp_list")"
git cherry -v \
    "$local_target_branch" \
    "$main_branch" \
    "$limit_tag" \
    | grep '^+' > "$cp_list"

# Remove the leading plus signs and trim the sha1s in the file to 8 characters,
# to match what "git rebase -i" outputs.
sed -i.backup -e 's/^+ \(\S\S\S\S\S\S\S\S\)\S*/\1/' "$cp_list"

# Append instructions, the way "git rebase -i" does.
cat >> "$cp_list" <<EOF

# Commits since $limit_tag,
# missing from $local_target_branch,
# but found in $main_branch.
#
# Delete the lines you don't want to cherry-pick, and keep the ones you do.
# Close your editor to begin the process.  To abort now, delete the entire file.
#
# These lines can be re-ordered; they are processed from top to bottom.
#
# Some of these may be unnecessary, or may have merge conflicts, or may already
# be present and could not be recognized by this tool.
#
# If a cherry-pick fails, you can fix the conflicts, stage the changed files,
# and type "git cherry-pick --continue".
#
# If the conflicts can't be fixed, you can skip the current commit by typing
# "git cherry-pick --skip".
#
# To abort the entire sequence of cherry-picks, use "git cherry-pick --abort".
# This is normally not necessary.
#
# A skipped commit can be attempted again by re-running the tool.
#
EOF

# Open the list in an editor.
"$editor" "$cp_list"

# Extract the sha1s from the file and process those commits.
cat "$cp_list" | sed -e 's/#.*//' | cut -f 1 -d ' ' | git cherry-pick --stdin
