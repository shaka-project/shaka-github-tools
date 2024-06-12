# Set Commit Status

A reusable action that sets the commit status.  This is used to set PR status
from workflows with non-PR triggers (such as manually-triggered workflows).

To use this in a step, write something like:

```yaml
      - name: Report final commit status
        # Will run on success or failure, but not if the workflow is cancelled
        # or if we were asked to ignore the test status.
        if: ${{ (success() || failure()) && inputs.skip_commit_status == false }}
        uses: shaka-project/shaka-github-tools/set-commit-status@main
        with:
          context: Example Check / ${{ matrix.some_parameter }}
          job_name: Optional Job Name for Deep Linking from Status
          state: ${{ job.status }}
          token: ${{ secrets.GITHUB_TOKEN }}
```
