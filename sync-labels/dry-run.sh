#!/bin/bash

# Shaka Sync Labels Tool
# Copyright 2022 Google LLC
# SPDX-License-Identifier: Apache-2.0

# Do a dry-run of syncing all repos, and log the results.  Specify a file
# containing a GitHub personal access token, which does not need any special
# permissions.
TOKEN_FILE="$1"

# TODO: revert to micnncim and new release after landing
#       https://github.com/micnncim/action-label-syncer/pull/68
go install github.com/joeyparrish/action-label-syncer/cmd/action-label-syncer@latest

export INPUT_TOKEN=$(cat "$TOKEN_FILE")
export INPUT_DRY_RUN=true
export INPUT_PRUNE=true

cd configs
for INPUT_MANIFEST in google/*.yaml joeyparrish/*.yaml; do
  echo "$INPUT_MANIFEST"
  echo "====="
  export INPUT_REPOSITORY=$(dirname $INPUT_MANIFEST)/$(basename -s .yaml $INPUT_MANIFEST)
  export INPUT_MANIFEST
  ~/go/bin/action-label-syncer |& tee $INPUT_REPOSITORY.log
  echo
done
