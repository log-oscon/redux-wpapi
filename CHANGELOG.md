# Changelog

The following highlights the changes that have been rolled with each new release.

Some guidelines in reading this document:

* The `[new release]` section corresponds to all the changes that have been merged into master, but have not yet been packaged and released.
* Every other release as it's section hose title is the tag of the release.
* The changes on each release are a list of Pull Requests (PRs) which were merged into master. For every PR we have the short summary followed by a link to the actual merged PR page. Inside the PR are the detailed changes.
* Being that these are the early days of the repository, we have some code changes that were added directly and without much detail, for these we have a link to the commit instead of the PR.

## [new release]

* Fix FAILURE handling (#3)

## 0.1.2

* Fix module identification name in code (#2)
* Correct README.md (#1)
* Fix documentation render function (8bbb83b)

## 0.1.1

* Include current page in the merge of selectQuery (ca2c03c)

## 0.1.0

First version of redux-wpapi, already functional, but poorly documented.

Includes the reducer tests for the actions:

* `REDUX_WP_API_REQUEST` (get, create, update and delete)
* `REDUX_WP_API_SUCCESS` (get)
