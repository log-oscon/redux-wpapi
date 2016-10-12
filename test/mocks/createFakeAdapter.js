export default (actionTarget, override) => {
  class Adapter {
    getAggregator() { return actionTarget.meta.url.replace(/^.*?\/([^/]*?)(\?.*)?$/, '$1'); }
    getOperation() { return actionTarget.meta.operation; }
    generateCacheID() { return actionTarget.payload.cacheID; }
    getRequestedPage() { return actionTarget.payload.page; }

    getUrl() { return actionTarget.meta.url; }
    getIndexes() { return {}; }
    buildRequest() { return {}; }
    sendRequest() { return Promise.resolve(actionTarget.payload.response); }
  }

  Object.assign(Adapter.prototype, override);
  return new Adapter();
};

