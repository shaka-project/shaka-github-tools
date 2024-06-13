# Compute SHA

A reusable action that computes a specific SHA from a PR number or symbolic
reference.  This is used to pin a hash for workflows with non-PR triggers
(such as manually-triggered workflows), because the meaning of a symbolic
reference can change between jobs or steps.

To use this, write something like:

```yaml
jobs:
  compute-sha:
    runs-on: ubuntu-latest
    outputs:
      SHA: ${{ steps.compute.outputs.SHA }}

    steps:
      - name: Compute SHA
        id: compute
        uses: shaka-project/shaka-github-tools/compute-sha@main
        with:
          ref: ${{ inputs.pr && format('refs/pull/{0}/head', inputs.pr) || 'refs/heads/main' }}
          # Optional: a nested workflow should take SHA from the outer workflow.
          sha: ${{ inputs.sha }}

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.compute-sha.outputs.SHA }}

      # ...
```
