"use strict";

var util = require('./util');
var indexes = require('./indexes');
var Promise = require('bluebird');
var _ = require('lodash');
var uuid = require('node-uuid');

var Transaction = function(tr, fdb, db, index){
  this.tr = tr;
  this.fdb = fdb;
  this.db = db;
  this.index = index;
  this.operations = [];
  this.committed = false;
}

/**
  Creates a document in the given keypath.

*/
Transaction.prototype.create = function(keyPath, args)
{
  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };
  var id = args._id ? args._id : uuid.v1();
  return this.put(keyPath.concat(id), _.extend({_id: id}, args)).then(function(){
    return id;
  });
}

/**
  Updates a document in the given keypath.
*/
Transaction.prototype.put = function(keyPath, args)
{
  var _this = this;

  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };

  var defer = Promise.defer();

  var tuples = makeTuples(keyPath, args);
  _.each(tuples, function(tuple){
    var value = _.last(tuple);
    var key = _.initial(tuple);
    var packedKey = _this.fdb.tuple.pack(key);
    var packedValue = util.packValue(_this.fdb, value);

    _this.tr.set(packedKey, packedValue);

    //
    // Check if we need to update the index
    //
    var indexKeyPath = _.initial(keyPath);
    indexKeyPath = indexKeyPath.concat(_.last(key, key.length - keyPath.length))
    if(indexes.checkIndex(_this.index, indexKeyPath)){
      indexes.writeIndex(_this.fdb,
                         _this.tr,
                         indexKeyPath,
                         _.last(keyPath),
                         value);
    }
  });
  defer.resolve();

  return defer.promise;
}

/**
  Returns a promise with the object at the given keypath (if any)
*/
Transaction.prototype.get = function(keyPath, fields, opts)
{
  var _this = this;
  var fdb = this.fdb;
  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };

  return new Promise(function(resolve, reject){
    var range = fdb.tuple.range(keyPath);

    var iter = _this.tr.getRange(range.begin, range.end, {
      limit: opts ? opts.limit : undefined,
      streamingMode: fdb.streamingMode.want_all
    });

    var result;

    iter.forEachBatch(function(arr, cb){
      var len = arr.length;
      for(var i=0; i<len; i++){
        var kv = arr[i];
        var tuple = fdb.tuple.unpack(kv.key);
        result = result ? result : _.isNumber(_.last(tuple)) ? [] : {};
        tuple.push(util.unpackValue(fdb, kv.value));
        fromTuple(result, tuple.slice(keyPath.length));
      }
      cb();
    }, function(err) {
      if(err){
        reject(err);
      }else{
        resolve(_.isEmpty(result) ? undefined: result);
      }
    })
  });
}

Transaction.prototype.remove = function(keyPath)
{
  var _this = this;
  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };

  var range = _this.fdb.tuple.range(keyPath);
  _this.tr.clearRange(range.begin, range.end);
  return Promise.resolve();
}

Transaction.prototype.find = function find(keyPath, where, fields, options){
  //
  // Check if we can use some indexes to accelerate this query.
  //
  keyPath = _.isArray(keyPath) ? keyPath : [keyPath];
  var _this = this;
  var tuples = makeTuples(keyPath, where);

  var promises;

  _.each(tuples, function(tuple){
    if(indexes.checkIndex(_this.index, _.initial(tuple))){
      promises = promises || [];
      var defer = Promise.defer();
      _this.operations.push(function(tr){
        defer.resolve(indexes.readIndex(_this.fdb, tr, tuple));
        return defer.promise;
      });
      promises.push(defer.promise);
    }
  });

  if(promises){
    return Promise.all(promises).then(function(docs){
      // Merge all objects
      docs = _.extend.apply(_, docs);

      // Get all the objects
      var ids = Object.keys(docs);
      return Promise.all(_.map(ids, function(id){
        return _this.get(keyPath.concat(id));
      })).then(function(docs){
        docs = _.filter(docs, where);

        // Filter them & _.pick
        return fields ? _.map(docs, function(doc){
          return _.pick(doc, fields);
        }) : docs;
      });
    });
  }else{
    return this.get(keyPath).then(function(docs){
      docs = _.filter(docs, where);
      // Filter them & _.pick
      return fields ? _.map(docs, function(doc){
        return _.pick(doc, fields);
      }) : docs;
    });
  }
}

Transaction.prototype.do = function(fn){
  var _this = this;

  return Promise.resolve(fn(this)).then(function(result){
    _this.committed = true;
    return result;
  });
}

/**
  Creates an array of tuples from a given object.
*/

function makeTuples(prefix, args){
  var result = [];
  traverseToTuple(result, prefix, args)
  return result;
}

function traverseToTuple(result, arr, args){
  if(!_.isObject(args)){
    // Pack primitive
    arr.push(args);
    result.push(arr);
  }else{
    _.each(args, function(value, key){
      traverseToTuple(result, arr.concat(key), value);
    });
  };
}

/**
  Creates an object from an array of tuples
*/
function makeObject(tuples){
  var result = {};

  _.each(tuples, function(tuple){
    fromTuple(result, tuple);
  });

  return result;
}

function fromTuple(obj, tuple){
  var i, len = tuple.length-2;

  for(i=0; i<len; i++){
    if (_.isUndefined(obj[tuple[i]])){
      if(_.isNumber(tuple[i+1])){
        obj[tuple[i]] = [];
      }else{
        obj[tuple[i]] = {};
      }
    }
    obj = obj[tuple[i]];
  }
  obj[tuple[i]] = tuple[i+1];
}

module.exports = Transaction;
