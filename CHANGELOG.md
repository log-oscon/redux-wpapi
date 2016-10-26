# Changelog

The following highlights the changes that have been rolled with each new release.

Some guidelines in reading this document:

* The `[new release]` section corresponds to all the changes that have been merged into master, but have not yet been packaged and released.
* Every other release has it's section whose title is the tag of the release.
* The changes on each release are a list of Pull Requests (PRs) which were merged into master. For every PR we have the short summary followed by a link to the actual merged PR page. Inside the PR are the detailed changes.
* Being that these are the early days of the repository, we have some code changes that were added directly and without much detail, for these we have a link to the commit instead of the PR.
* Annotations starting with **[BC]** indicates breaking change.

## [1.3.1]
* Fix: Ensures pagination shape and presence in response. ([#25](https://github.com/log-oscon/redux-wpapi/pull/25))
* Fix TTL behavior: It now can be overriden by the consumer when dispatching `callAPI` ([#24](https://github.com/log-oscon/redux-wpapi/pull/24))

## 1.3.0
* ([#22](https://github.com/log-oscon/redux-wpapi/pull/22))
    * Adapter's `getAggregator` is now applied per resource and has `additionalData` in order decide, which might be either the query of the request or the resource itself.
    * `getAggregator` setting is now available, so consumer might also decide per resource. As its third param, the `suggestedAggregator` is supplied contain the adapter's `getAggregator` return.

## 1.2.1
* ([#21](https://github.com/log-oscon/redux-wpapi/pull/21))
    * Mark embedded resource as `partial` until they are fetched individually (closes [#20](https://github.com/log-oscon/redux-wpapi/issues/20))
    * Fix indexation: type no longer matters in `getLocalResourceID`

## 1.2.0
* Fix [#15](https://github.com/log-oscon/redux-wpapi/issues/15) - Support for register dashed-routes as camelCase ([#16](https://github.com/log-oscon/redux-wpapi/pull/16))
* TTL (Time-to-live) now can be overriden by each request. ([#17](https://github.com/log-oscon/redux-wpapi/pull/17))
* [#13](https://github.com/log-oscon/redux-wpapi/pull/13)
  * **[BC]** - `selectQuery` renamed to `selectRequest` and now also accepts `{ cacheID, page }` for selecting Requests
  * **[BC]** - Ommits `localResources`, now that a denormalization methods exists.
  * Exposes `selectRequestRaw`, so a request might be selected without denormalization step
  * Fix [#12](https://github.com/log-oscon/redux-wpapi/issues/12) – Promise returned from middleware dispatch was overlaping responses with same name
  * Fix [#14](https://github.com/log-oscon/redux-wpapi/issues/14) - lastCacheUpdate should be used as Symbol for preventing collisions, now been tested
* Fix [#18](https://github.com/log-oscon/redux-wpapi/issues/18) - Allow indexation of resources without indexers (such as id or custom indexers) [#19](https://github.com/log-oscon/redux-wpapi/pull/19)

## 1.1.0

* Expose a denormalization mechanism so consumer can transform local ids into resources denormalized ([#11](https://github.com/log-oscon/redux-wpapi/pull/11))
* Fix the Promise return from middleware dispatch, which should always resolve to `selectQuery` result ([#9](https://github.com/log-oscon/redux-wpapi/pull/9))

## 1.0.1

* Fix selector, which was referring to `entity` instead `resource`

## 1.0.0

* Introduce Adapters, an abstraction of API specifics so ReduxWPAPI can communicate with any other API client ([#8](https://github.com/log-oscon/redux-wpapi/pull/8))
  * **[BC]** Rename `entity` to `resource` for better REST compliance
  * **[BC]** Rename Request Statuses for better Promise compliance
* Add integration with Travis and adds NPM and Travis badges
* Implement reducer tests ([#6](https://github.com/log-oscon/redux-wpapi/pull/6))
* Draft on Contributions and the introduction of this `CHANGELOG.md` file ([#5](https://github.com/log-oscon/redux-wpapi/pull/5))
* Fix FAILURE handling ([#3](https://github.com/log-oscon/redux-wpapi/pull/3))

## 0.1.2

* Fix module identification name in code ([#2](https://github.com/log-oscon/redux-wpapi/pull/2))
* Correct README.md ([#1](https://github.com/log-oscon/redux-wpapi/pull/1))
* Fix documentation render function ([b0bb5f4](https://github.com/log-oscon/redux-wpapi/commit/b0bb5f417d6943c981346cf74b912efa67a7c9b6))

## 0.1.1

* Include current page in the merge of selectQuery ([ca2c03c](https://github.com/log-oscon/redux-wpapi/commit/ca2c03cd4e337a58ef61e9e154223ff95acbd0de))

## 0.1.0

First version of redux-wpapi, already functional, but poorly documented.

Includes the reducer tests for the actions:

* `REDUX_WP_API_REQUEST` (get, create, update and delete)
* `REDUX_WP_API_SUCCESS` (get)
