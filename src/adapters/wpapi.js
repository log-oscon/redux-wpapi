import find from 'lodash/find';
import findKey from 'lodash/findKey';
import reduce from 'lodash/reduce';
import capitalize from 'lodash/capitalize';
import camelCase from 'lodash/camelCase';

/**
 * This adapter connects `node-wpapi` to `redux-wpapi`, abstracting any
 * specificity.
 *
 * @type {adapter}
 */
export default class WPAPIAdapter {
  /**
  * Regular Expression to identify a capture group in PCRE formats
  * `(?<name>regex)`, `(?'name'regex)` or `(?P<name>regex)` (see
  * regular-expressions.info/refext.html); RegExp is built as a string
  * to enable more detailed annotation.
  *
  * @type {RegExp}
  * @author kadamwhite
  * @link https://github.com/WP-API/node-wpapi/blob/0b4fbe8740fe4bf5b8c4e1a5c06127a9325d5d6d/lib/util/named-group-regexp.js
  */
  static namedGroupRegex = new RegExp([
    // Capture group start
    '\\(\\?',
    // Capture group name begins either `P<`, `<` or `'`
    '(?:P<|<|\')',
    // Everything up to the next `>`` or `'` (depending) will be the capture group name
    '([^>\']+)',
    // Capture group end
    '[>\']',
    // Get everything up to the end of the capture group: this is the RegExp used
    // when matching URLs to this route, which we can use for validation purposes.
    '([^\\)]*)',
    // Capture group end
    '\\)',
  ].join(''));

  /**
   * Aggregators' unique properties to be indexed
   */
  customCacheIndexes = {
    taxonomies: ['slug'],
  };

  /**
   * Sets up the adapter with the API settings
   *
   * @param {Object} settings
   */
  constructor(settings) {
    if (!settings.api) {
      throw new Error('[ReduxWPAPI WPAPI Adapter]: api client must be provided');
    }

    this.defaultTTL = settings.ttl;
    this.api = settings.api;
  }

  /**
   * Transforms the resource before indexing
   *
   * This is useful to remove unused attributes.
   *
   * @param  {Object} resource Each individual resource
   * @return {Object}          Resource transformed
   */
  transformResource(resource) {
    return resource;
  }

  /**
   * Extracts current page from a given request
   *
   * @param {Object} request Request provided by consumer through action `request` param
   * @return {Number} current page
   */
  getRequestedPage({ wpRequest }) {
    return wpRequest._params.page;
  }

  /**
   * Extracts pagination params from Response
   *
   * Pagination requires `totalPages` and `total`.
   *
   * @param {Object|Array} response Response resulted by `callAPI` operation
   * @return {Object}               Pagination composed by `total` and `totalPages`.
   */
  getPagination(response) {
    const { total, totalPages } = response._paging || {};
    return {
      total: parseInt(total || 0, 10),
      totalPages: parseInt(totalPages || 0, 10),
    };
  }

  /**
   * Extracts params from request for finding local cache.
   *
   * These params are going to be used to search resource within local cache. It will work only with
   * previously indexed in that aggregator.
   *
   * FIXME: provisional method while pending WP-API/node-wpapi#213
   *
   * @param {Object} request Request provided by consumer through action `request` param
   * @return {Object} params used to search resource within local cache.
   */
  getIndexes({ wpRequest }) {
    /* eslint-disable no-param-reassign */
    // Internal mutations inside reduce function
    let lastFragment = null;
    let unresolvedNesting = 1;
    const foundIndexers = reduce(wpRequest._path, (indexers, fragment, piece) => {
      const id = find(wpRequest._levels[piece], cmp => cmp.validate(fragment));

      if (!id) return indexers;
      const name = id.component.match(WPAPIAdapter.namedGroupRegex);

      if (name) {
        lastFragment = indexers[name[1]] = fragment;
        unresolvedNesting--;
      } else {
        unresolvedNesting++;
      }

      return indexers;
    }, { ...wpRequest._params });

    if (!foundIndexers.id && lastFragment && unresolvedNesting === 1) {
      foundIndexers.id = lastFragment;
    }

    return foundIndexers;
  }

  /**
   * Generates Cache ID
   *
   * This Cache ID should be the same for all requests that have the same query and differs only by
   * pagination arguments.
   *
   * @param {Object} request Request provided by consumer through action `request` param
   * @return {String}        A Cache ID to given request
   */
  generateCacheID({ wpRequest }) {
    /* eslint-disable no-param-reassign */
    // Internal mutations are reversed before return
    const page = wpRequest._params.page;
    const _embed = wpRequest._params._embed;

    delete wpRequest._params.page;
    delete wpRequest._params._embed;

    const cacheID = wpRequest.toString();

    wpRequest._params.page = page;
    wpRequest._params._embed = _embed;

    return cacheID.replace(this.api._options.endpoint, '');
  }

  /**
   * Give name to a given link (relationship)
   *
   * Decides how embedded resources brought by a given link will be identified after denormalization
   *
   * @param {Object} link      Relationship object between resources
   * @param {String} link.name Relationship name between resources
   * @param {String} link.href Source of current link's resources
   * @return {String}          Property to which resources will be embedded after denormalization
   */
  embedLinkAs(link) {
    let linkRenamed = link.name.replace(/^https:\/\/api\.w\.org\//, '');

    switch (linkRenamed) {
      case 'featuredmedia': linkRenamed = 'featured_media'; break;
      case 'term':
        linkRenamed = link.href.replace(/\?.*$/, '').replace(/.*\/([^/]+)$/, '$1');
        break;
      default:
    }

    return linkRenamed;
  }

  /**
   * Converts a request into a URL
   *
   * This URL is needed in order to get its resources aggregator.
   *
   * @param  {Object} request Request provided by consumer through the action `request` param
   * @return {Object}         The Request URL
   */
  getUrl({ wpRequest }) {
    return wpRequest.toString();
  }

  /**
   * Get aggregator for URL
   *
   * Infers the aggregator identifier of a given URL to which a resulting resource will be
   * associated with. `additionalData` is available so the decision might also be based on the query
   * or on the own resource.
   *
   * An aggregator is a set containing resources indexed by its ids and by the
   * its custom indexers.
   *
   * @param  {String}      url            URL from which the aggregator will be infered
   * @param  {Object|null} additionalData Available data about the expected resource
   * @return {String|null} aggregatorID   String to which all URL direct resources will be
   *                                      associated with or null, if resources musn't be indexed
   */
  getAggregator(url) {
    let uri = url.replace(this.api._options.endpoint, '').replace(/\?.*$/, '');
    const namespace = findKey(this.api._ns, (factory, ns) => uri.indexOf(ns) === 0);

    // No unregistered route/namespace will going to be indexed by default.
    // FIXME: does this works with `customRoutes`?
    if (!namespace) return null;

    // Skips namespace, takes fragments and preserves only static parts
    uri = uri.replace(`${namespace}/`, '');
    const fragments = uri.split('/');
    const resource = camelCase(fragments[0]);

    if (!this.api[resource]) {
      throw new Error(`Unregistered route, expected '${resource}' to resolve to '${url}'`);
    }

    const query = this.api[resource]();
    let aggregator = resource;

    for (let piece = 1; piece < fragments.length; piece++) {
      const id = find(query._levels[piece], cmp => cmp.validate(fragments[piece]));

      if (!id) {
        return false;
      }

      if (!id.component.match(WPAPIAdapter.namedGroupRegex)) {
        aggregator += capitalize(id.component);
      }
    }

    // usersMe should be aggregated together with users
    if (aggregator === 'usersMe') return 'users';

    return aggregator;
  }

  /**
   * Define a time to live for request
   *
   * It allows adapter define the ttl per request basis
   *
   * @param  {Object} request Request provided by consumer through action `request` param
   * @return {Number}         The time to live of request's resources
   */
  getTTL(request) {
    return request.ttl === undefined || request.ttl === null ? this.defaultTTL : request.ttl;
  }

  /**
   * Retrieves request operation
   *
   * @param  {Object} request Request provided by consumer through action `request` param
   * @return {('get'|'create'|'update'|'delete')} The request operation
   */
  getOperation(request) {
    return request.operation;
  }

  /**
   * Builds the Request object
   *
   * Deals with consumer input through an action and produces the request to attend be later
   * fetched. The request must carry at least operation (get|create|update\delete) and required data
   * in order to call API later at `callAPI`.
   *
   * @param  {Object} payload                  The action payload
   * @param  {Object} payload.request          The lib consumer input for calling the api
   * @param  {Object} payload.additionalParams additional params in order to make request, generally
   *                                           meta data such as method or header to be handled by
   *                                           `callAPI`
   * @return {Object}                          The Request Object
   */
  buildRequest({ request: requestBuilder, additionalParams }) {
    const wpRequest = requestBuilder(this.api);
    const { operation = 'get', ttl, body } = additionalParams;

    return { wpRequest, operation, body, ttl };
  }

  /**
   * Sends API request
   *
   * It is expected to return a promise which resolves to a data consumable by both `getBody` and
   * `getPagination`. In case of rejection, a reason is expected under message property from Error.
   *
   * @param  {Object}  request Provided by consumer through the action `request` param
   * @return {Promise}         The future result of the operation
   */
  sendRequest({ wpRequest, operation, body }) {
    // Embeds any directly embeddable resource linked to current resource(s)
    return wpRequest.embed()[operation](body);
  }
}
