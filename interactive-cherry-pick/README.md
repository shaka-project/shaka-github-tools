# Interactive Cherry-Pick Tool

This is parallel to interactive rebasing in git, but for cherry-picks from a
main branch to a stable release branch.


## Installation

sudo ln -s $(pwd)/interactive-cherry-pick.sh /usr/local/bin/interactive-cherry-pick


## Usage

In this example, `v3.3.x` is a release branch, and `v3.3.1-main` is a tag on
the `main` branch corresponding to the most recent `v3.3.x` release.  We want
to cherry-pick from `main`, but only as far back as that tag.  Before it
presents you with a list of cherry-picks, the tool will fetch the latest
commits from the remote server `upstream`.

The first argument is the ref where we stop cherry-picking (`v3.3.1-main`),
the second argument is the remote name (`upstream`), and the third argument is
the name of the main branch (`main`).

If you don't have main branch release tags in the way that shaka-player does,
you can provide any ref (sha1) as a stopping point.

```sh
git checkout v3.3.x  # release branch
interactive-cherry-pick v3.3.1-main upstream main
```


## Defaults

If not specified, the remote defaults to "origin".

If not specified, the main branch defaults to "main".
