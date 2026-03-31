"use strict";

const fs = require("fs");

function normalizeReadlinkError(err) {
  if (!err || typeof err !== "object") return err;
  if (err.code === "EISDIR") {
    const patched = new Error(err.message.replace(/^EISDIR/, "EINVAL"));
    patched.name = err.name;
    patched.code = "EINVAL";
    patched.errno = err.errno;
    patched.path = err.path;
    patched.syscall = err.syscall;
    return patched;
  }
  return err;
}

const originalReadlink = fs.readlink;
const originalReadlinkSync = fs.readlinkSync;
const originalReadlinkPromise = fs.promises.readlink.bind(fs.promises);

fs.readlink = function patchedReadlink(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return originalReadlink.call(fs, path, options, (err, linkString) => {
    if (err) {
      callback(normalizeReadlinkError(err));
      return;
    }
    callback(null, linkString);
  });
};

fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return originalReadlinkSync.call(fs, path, options);
  } catch (err) {
    throw normalizeReadlinkError(err);
  }
};

fs.promises.readlink = async function patchedReadlinkPromise(path, options) {
  try {
    return await originalReadlinkPromise(path, options);
  } catch (err) {
    throw normalizeReadlinkError(err);
  }
};
