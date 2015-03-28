'use strict';

module.exports = Database;

var Roach = require('roachjs');
var _ = require('lodash');
var Promise = require('bluebird');

var indexes = require('./indexes');
var Transaction = require('./transaction');
var Subspace = require('./subspace');

function Database(opts) {
  this.db = null;
  this.opts = opts || {};
  this.indexMeta = {};

  // Determine subspace setting
  if (this.opts.subspace instanceof Subspace) {
    this.subspace = this.opts.subspace;
  } else if (typeof this.opts.subspace === 'string') {
    this.subspace = new Subspace([this.opts.subspace]);
  } else if (Array.isArray(this.opts.subspace)) {
    this.subspace = new Subspace(this.opts.subspace);
  } else {
    this.subspace = new Subspace();
  }

  this.valueSpace = new Subspace();

  this.idProp = this.opts.idProp || '_id';
}

Database.prototype.open = function open(opts) {
  var self = this;

  this.db = new Roach(opts || {});
  this.db.runTransactionAsync =
    Promise.promisify(this.db.runTransaction, this.db);

  this.transaction(function(tr) {
    return indexes.readMeta(tr).then(function(meta) {
      self.indexMeta = meta || {};
    });
  });
};

Database.prototype.transaction = function transaction(fn) {
  var self = this;

  if (typeof fn !== 'function') {
    throw new Error('Invalid use of transaction(): First argument must be a ' +
                    'function containing the transaction body.');
  }

  var result;
  return this.db.runTransactionAsync({}, function(tr, commit, abort) {
    tr = new Transaction(tr, self, self.indexMeta);
    tr.do(fn).then(function(res) {
      result = res;
      return res;
    }).then(commit, abort);
  }).then(function () {
    return result;
  });
};

/**
 * Add an index
 */
Database.prototype.addIndex = function addIndex(keyPath, fields) {
  var self = this;

  fields = _.isArray(fields) ? fields : [fields];
  return this.transaction(function(tr) {
    for (var i = 0; i < fields.length; i++) {
      indexes.makeIndex(tr, keyPath, fields[i]);
      self.indexMeta[keyPath.join('/')] = true;
    }
  });
};

/**
 * Rebuilds a index.
 */
Database.prototype.rebuildIndex = function(keyPath, fields) {
  // TO IMPLEMENT
};

/**
 * Shorthand for single operations.
 */
Transaction.queryMethods.forEach(function (method) {
  Database.prototype[method] = function(keyPath, args) {
    return this.transaction(function(tr) {
      return tr[method](keyPath, args);
    });
  };
});
