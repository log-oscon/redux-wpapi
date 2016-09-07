const collectionResponse = [
  {
    id: 2,
    slug: 'dumb2',
    dumbAttr: 'dumb2',
    _links: {
      self: [{ href: 'http://dumb.url/wp-json/namespace/any/2' }],
      collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
      parent: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/namespace/any/1',
      }],
      author: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/wp/v2/users/1',
      }],
    },
    _embedded: {
      author: [{
        id: 1,
        name: 'admin',
        link: 'http://km.nos.dev/author/admin/',
        slug: 'admin',
        _links: {
          self: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users/1' }],
          collection: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users' }],
        },
      }],
      parent: [{
        id: 1,
        slug: 'dumb1',
        dumbAttr: 'dumb1',
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
      }],
    },
  },
  {
    id: 1,
    slug: 'dumb1',
    dumbAttr: 'dumb1',
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

collectionResponse._paging = {
  total: 2,
  totalPages: 1,
};

export default collectionResponse;
