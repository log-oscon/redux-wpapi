import find from 'lodash/find';
import nthArg from 'lodash/nthArg';
import findKey from 'lodash/findKey';
import reduce from 'lodash/reduce';
import capitalize from 'lodash/capitalize';

/**
 * This adapter connects `node-wpapi` to `redux-wpapi`, abstracting any specific.
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
   * aggregators' unique properties to be indexed.
   */
  customcacheindexes = {
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

    this.api = settings.api;
  }

  /**
   * Transform the resource before indexing, useful to remove unused attributes
   *
   * @param {Object} resource Each individual resource
   */
  transformResource = nthArg(0)

  /**
   * Extracts current page from a given request.
   *
   * @param {Object} request Request provided by consumer through `wp` action creator requestBuilder
   * @return {Number} current page.
   */
  getRequestedPage(request) {
    return request._params.page;
  }

  /**
   * Extracts pagination params from Response, such as `totalPages` and `total`.
   *
   * @param {Object|Array} response Response resulted by `callAPI` operation
   * @return {Object} pagination params such as `total` and `totalPages`.
   */
  getPagination(response) {
    const { total, totalPages } = response._paging || {};
    return {
      total: parseInt(total || 1, 10),
      totalPages: parseInt(totalPages || 1, 10),
    };
  }

  /**
   * Extracts params from request which are going to be used to search resource within local cache.
   * It will work only with previously indexed in that aggregator.
   *
   * FIXME provisional method while pending WP-API/node-wpapi#213
   *
   * @param {Object} request Request provided by consumer through `wp` action creator requestBuilder
   * @return {Object} params used to search resource within local cache.
   */
  getIndexes(request) {
    /* eslint-disable no-param-reassign */
    // Internal mutations inside reduce function
    let lastFragment = null;
    let unresolvedNesting = 1;
    const foundIndexers = reduce(request._path, (indexers, fragment, piece) => {
      const id = find(request._levels[piece], cmp => cmp.validate(fragment));

      if (!id) return indexers;
      const name = id.component.match(WPAPIAdapter.namedGroupRegex);

      if (name) {
        lastFragment = indexers[name[1]] = fragment;
        unresolvedNesting--;
      } else {
        unresolvedNesting++;
      }

      return indexers;
    }, { ...request._params });

    if (!foundIndexers.id && lastFragment && unresolvedNesting === 1) {
      foundIndexers.id = lastFragment;
    }

    return foundIndexers;
  }

  /**
   * Generates Cache ID to a given Request. This Cache ID should be the same to all requests that
   * have the same query and differs only by pagination arguments.
   *
   * @param {Object} request Request provided by consumer through `wp` action creator requestBuilder
   * @return {String} A Cache ID to given request.
   */
  generateCacheID(request) {
    /* eslint-disable no-param-reassign */
    // Internal mutations are reversed before return
    const page = request._params.page;
    const _embed = request._params._embed;

    delete request._params.page;
    delete request._params._embed;

    const uid = request._renderURI();

    request._params.page = page;
    request._params._embed = _embed;

    return uid.replace(this.api._options.endpoint, '');
  }

  /**
   * Decides how embedded resources brought by a given link will be identified after denormalization
   *
   * @param {Object} link - Relationship object between resources
   * @param {String} link.name - Relationship name between resources
   * @param {String} link.href - Source of current link's resources
   *
   * @return {String} property to which resources will be embedded after denormalization
   */
  embedLinkAs(link) {
    let linkRenamed = link.name.replace(/^https:\/\/api\.w\.org\//, '');

    switch (linkRenamed) {
      case 'featuredmedia': linkRenamed = 'featured_media'; break;
      case 'term':
        linkRenamed = link.href.replace(/\?.*$/, '').replace(/.*\/([^\/]+)$/, '$1');
        break;
      default:
    }

    return linkRenamed;
  }

  /**
   * Retrieves the URL of a given request, needed in order to get its aggregator.
   *
   * @param {Object} request Request provided by consumer through `wp` action creator requestBuilder
   */
  getUrl(request) {
    return request._renderURI();
  }

  /**
   * Infers the aggregator identifier of a given URL to which all resulting resources are going to
   * be associated with. An aggregator is a set containing resources indexed by its ids and by the
   * its custom indexers.
   *
   * @param {String} url URL from which the aggregator will be infered
   * @return {String|null} aggregatorID String to which all URL direct resources will be associated
                           with or null, if resources musn't be indexed.
   */
  getAggregator(url) {
    let uri = url.replace(this.api._options.endpoint, '').replace(/\?.*$/, '');
    const namespace = findKey(this.api._ns, (factory, ns) => uri.indexOf(ns) === 0);

    // No unregistered route/namespace will going to be indexed by default.
    // FIXME does this works with `customRoutes`?
    if (!namespace) return null;

    // Skips namespace, takes fragments and preserves only static parts
    uri = uri.replace(`${namespace}/`, '');
    const fragments = uri.split('/');
    const [resource] = fragments;
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
   * Deals with consumer input through action and produces the request to attend be later fetched.
   * The request must carry at least operation (get|create|update\delete) and required data in order
   * to call API later at `callAPI`.
   *
   * @param {Object} payload - the action payload
   * @param {Object} payload.request - the lib consumer input for calling the api
   * @param {Object} payload.aditionalParams - aditional params in order to make request, generally
   *                                           meta data such as method or header to be handled by
   *                                           `callAPI`.
   */
  buildRequest(payload) {
    const request = payload.requestBuilder(this.api);
    const { operation = 'post', ...body } = payload.aditionalParams;

    request.operation = operation;
    request._body = body;

    return request;
  }

  /**
   * Effectively calls the API given a request, operation and its params. It is expected to return
   * a promise which resolves to a data consumable by both `getBody` and `getPagination`. In case of
   * rejection, a reason is expected under `message` property from Error.
   *
   * @param {Object} request Request provided by consumer through `wp` action creator requestBuilder
   * @param {String} [operation="get"] Operation to apply remotely
   * @param {Object} [params] Params to apply remotely
   *
   * @return {Promise} The future result of the operation
   */
  callAPI(request) {
    // Embeds any directly embeddable resource linked to current resource(s)
    return request.embed()[request.operation](request._body);
  }
}
