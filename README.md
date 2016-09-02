# redux-wpapi
A [node-wpapi](https://github.com/WP-API/node-wpapi) integration for a Redux based Application.

## How it Works
This library exposes [node-wpapi](https://github.com/WP-API/node-wpapi)  instance through the actionCreator [wp](#wp-Action-Creator). The resulting
action is interpreted in [the middleware](#the-middleware), doing so by resolving the request and controlling the reducer through actions.

## Installation
```sh
npm install --save redux-wpapi
```
Then, to enable ReduxWPAPI, use [`applyMiddleware()`](http://redux.js.org/docs/api/applyMiddleware.html) and [`combineReducers()`](http://redux.js.org/docs/api/combineReducers.html):

```js
import reducers from './reducers';
import ReduxWPAPI from 'redux-wpapi';

const { reducer: wp, middleware } = new ReduxWPAPI({ /* … */ });
const store = createStore(
  // the reducer must be placed at the root of the state as `wp`
  // so the selector knows where state lives in
  { ...reducers, wp },
  applyMiddleware(middleware)
);

```

## Usage
```js
import React from 'react';
import { wp, selectQuery, ResponseStatus } from 'redux-wpapi';
import { connect } from 'react-redux';

export class HomePage extends React.Component {
  componentWillMount() {
    this.props.wp(
      // The name where the request state will be placed
      'HomePagePosts',
      // A callback where wpapi instance is injected
      api =>
        api.posts()
        .page(this.props.page)
        .perPage(this.props.perPage)
    );
  }

  render() {
    const { status, data: posts } = this.props.request;

    if (!posts) {
      switch (status) {
          case ResponseStatus.WAITING: return <div>Loading…</div>;
          case ResponseStatus.ERROR: return <div>An error has occurred</div>;
      }
    }

    return (
      <div>
        {!posts.length ? <NoPostFound /> : <PostList posts={posts} />}
      </div>
    );
  }
}

export default connect({
  request: selectQuery('HomePagePosts'),
}, { wp })(HomePage);
```
