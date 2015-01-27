"use strict";

var fdb = require('fdb').apiVersion(200);
var _ = require('lodash');
var Promise = require('bluebird');

var indexes = require('./lib/indexes');
var Transaction = require('./lib/transaction');
var Query = require('./lib/query');

//
// Globals
//
var db;
var indexMeta = {};

function transaction(fn){
  var _this = this;

  if ("function" !== typeof fn) {
    throw new Error("Invalid use of transaction(): First argument must be a function containing the transaction body.");
  }

  //
  // We use superior bluebird promises instead of fdb built-in ones.
  //
  return Promise.resolve(db.doTransaction(function(tr, cb){
    tr = new Transaction(tr, fdb, db, indexMeta);
    tr.do(fn).nodeify(cb);
  }));
}

function query(keyPath, fields, opts){
  return new Query(keyPath, fields, opts)
}

exports.open = function(clusterFile, dbName)
{
  db = fdb.open(clusterFile, dbName);

  transaction(function(tr){
    return indexes.readMeta(tr).then(function(meta){
      indexMeta = meta || {};
    });
  });
}

exports.options = fdb.options;
exports.transaction = transaction;
exports.query = query;

/**
  Add a index
*/
exports.addIndex = function(keyPath, fields)
{
  fields = _.isArray(fields) ? fields : [fields];
  return transaction(function(tr){
    for(var i=0; i<fields.length; i++){
      indexes.makeIndex(tr, keyPath, fields[i]);
      indexMeta[keyPath.join('/')] = true;
    }
  });
}

/**
  Rebuilds a index.
*/
exports.rebuildIndex = function(keyPath, fields)
{
  // TO IMPLEMENT
}

/**
  Single operations bluebird no transactions needed.
*/
exports.create = function(keyPath, args){
  return transaction(function(tr){
    return tr.create(keyPath, args);
  });
}

exports.put = function(keyPath, args){
  return transaction(function(tr){
    return tr.put(keyPath, args);
  });
}

exports.get = function(keyPath){
  return transaction(function(tr){
    return tr.get(keyPath);
  });
}

exports.remove = function(keyPath){
  return transaction(function(tr){
    return tr.remove(keyPath);
  });
}

exports.find = function(keyPath, where, fields, options){
  return transaction(function(tr){
    return tr.find(keyPath, where, fields, options);
  });
}
