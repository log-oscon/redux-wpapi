const queryBySlugResponse = [
  {
    id: 1,
    slug: 'dumb1-modified',
    dumbAttr: 'dumb1 - modified',
    _links: {
      self: [{ href: 'http://dumb.url/wp-json/namespace/any/1' }],
      collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
      parent: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/namespace/any/1',
      }],
      author: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/wp/v2/users/2',
      }],
    },
    _embedded: {
      author: [{
        id: 2,
        name: 'edygar',
        link: 'http://km.nos.dev/author/edygar/',
        slug: 'edygar',
        _links: {
          self: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users/2' }],
          collection: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users' }],
        },
      }],
    },
  },
];

queryBySlugResponse._paging = {
  total: 1,
  totalPages: 2,
};

export default queryBySlugResponse;

