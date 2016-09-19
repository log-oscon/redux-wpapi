export default class AdapterMockForReducer {
  // _paging extractor
  getPagination = ({ _paging }) => _paging;

  // no link renaming
  embedLinkAs = ({ name }) => name;

  // expects users or any for test reducers
  getAggregator(url) {
    return url.match(/users/) ? 'users' : 'any';
  }
}
