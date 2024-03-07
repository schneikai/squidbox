import axios from 'axios';

import { FILE_UPLOADER_API_URL } from '@/secrets';

// Get URL on server
// Options:
//   on404: "reject" | "resolve"
export function get(url, params, options = {}) {
  return new Promise(function (resolve, reject) {
    axios
      .get(expandUrl(url), { params })
      .then(function (response) {
        resolve(response);
      })
      .catch(function (error) {
        if (error.response.status === 404 && options.on404 === 'resolve') {
          // Return empty data if asset not found instead of raising an error
          resolve({ ...error.response, data: undefined });
        } else {
          reject(error);
        }
      });
  });
}

export function post(url, data, options = {}) {
  return axios.post(expandUrl(url), data, options);
}

export function put(url, data, options = {}) {
  return axios.put(expandUrl(url), data, options);
}

export function destroy(url) {
  return axios.delete(expandUrl(url));
}

function expandUrl(url) {
  if (!url.startsWith('/')) return url;
  return `${FILE_UPLOADER_API_URL}${url}`;
}
