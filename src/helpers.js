import { stringify } from 'qs';
import omit from 'lodash/omit';
import mapValues from 'lodash/mapValues';
import isPlainObject from 'lodash/isPlainObject';
import isArray from 'lodash/isArray';

export const stringifyQuery = (query) => stringify(omit(query));

export function mapDeep(iteratable, callback, name = null) {
  if (isArray(iteratable)) {
    return iteratable.map(toIterate => mapDeep(toIterate, callback, name));
  }

  if (isPlainObject(iteratable)) {
    return mapValues(iteratable, toIterate => mapDeep(toIterate, callback));
  }

  return callback(iteratable, name);
}
