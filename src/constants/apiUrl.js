// const apiUrl =
//   process.env.NODE_ENV === "development"
//     ? "http://localhost:3000/api" // development api
//     : "http://localhost:3000/api"; // production api

import Constants from "expo-constants";
const { manifest } = Constants;

const host =
  typeof manifest.packagerOpts === `object` && manifest.packagerOpts.dev
    ? manifest.debuggerHost.split(`:`).shift().concat(`:3000`)
    : `api.example.com`;

const apiUrl = `http://${host}/api/v1`;

export { apiUrl };
