'use strict';

var Roach = require('roachjs');
var Database = require('./lib/database');
var Query = require('./lib/query');
var Transaction = require('./lib/transaction');
var Subspace = require('./lib/subspace');

/**
 * Simplified database API.
 */
var defaultDb = null;

exports.open = function (opts) {
  defaultDb = new Database(opts);
  defaultDb.open();

  exports.transaction = defaultDb.transaction.bind(defaultDb);
  exports.addIndex = defaultDb.addIndex.bind(defaultDb);
};

/**
 * Shorthand for single operations.
 */
Transaction.queryMethods.forEach(function (method) {
  exports[method] = function(keyPath, args) {
    return defaultDb.transaction(function(tr) {
      return Promise.resolve(tr[method](keyPath, args));
    });
  };
});

/**
 * Query API
 */

function query(keyPath, fields, opts){
  return new Query(keyPath, fields, opts)
}

exports.query = query;

/**
 * Object-oriented API
 */

exports.Database = Database;
exports.Query = Query;
exports.Transaction = Transaction;
exports.Subspace = Subspace;
