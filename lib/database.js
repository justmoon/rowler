'use strict';

module.exports = Database;

var fdb = require('fdb').apiVersion(200);
var _ = require('lodash');
var Promise = require('bluebird');

var indexes = require('./indexes');
var Transaction = require('./transaction');

function Database(opts) {
  this.db = null;
  this.opts = opts || {};
  this.indexMeta = {};
  this.subspace = this.opts.subspace || new fdb.Subspace();
  this.idProp = this.opts.idProp || '_id';
}

Database.prototype.transaction = function transaction(fn){
  var _this = this;

  if ("function" !== typeof fn) {
    throw new Error("Invalid use of transaction(): First argument must be a function containing the transaction body.");
  }

  //
  // We use superior bluebird promises instead of fdb built-in ones.
  //
  return this.db.doTransactionAsync(function(tr, cb){
    tr = new Transaction(tr, fdb, _this, _this.indexMeta);
    tr.do(fn).nodeify(cb);
  });
}

Database.prototype.open = function open(clusterFile, dbName)
{
  var _this = this;

  this.db = fdb.open(clusterFile, dbName);
  this.db.doTransactionAsync = Promise.promisify(this.db.doTransaction, this.db);

  this.transaction(function(tr){
    return indexes.readMeta(tr).then(function(meta){
      _this.indexMeta = meta || {};
    });
  });
}

/**
 * Add an index
 */
Database.prototype.addIndex = function addIndex(keyPath, fields)
{
  var _this = this;

  fields = _.isArray(fields) ? fields : [fields];
  return this.transaction(function(tr){
    for(var i=0; i<fields.length; i++){
      indexes.makeIndex(tr, keyPath, fields[i]);
      _this.indexMeta[keyPath.join('/')] = true;
    }
  });
}

/**
 * Rebuilds a index.
 */
Database.prototype.rebuildIndex = function(keyPath, fields)
{
  // TO IMPLEMENT
};

/**
 * Shorthand for single operations.
 */
Transaction.queryMethods.forEach(function (method) {
  Database.prototype[method] = function(keyPath, args){
    return this.transaction(function(tr){
      return tr[method](keyPath, args);
    });
  }
});
