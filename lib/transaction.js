"use strict";

var util = require('./util');
var indexes = require('./indexes');
var Promise = require('bluebird');
var _ = require('lodash');
var uuid = require('uuid4');

var Transaction = function(tr, db, index){
  this.tr = Promise.promisifyAll(tr);
  this.db = db;
  this.index = index;
}

Transaction.queryMethods = ['create', 'put', 'get', 'remove', 'find'];


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

/**
  Creates a document in the given keypath.

*/
Transaction.prototype.create = function(keyPath, obj)
{
  var self = this;

  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };
  obj = _.clone(obj);
  if ("undefined" === typeof obj[this.db.idProp]) {
    obj[this.db.idProp] = uuid();
  }
  var id = obj[this.db.idProp];

  this.put(keyPath.concat(id), obj);

  return id;
}

/**
  Updates a document in the given keypath.
*/
Transaction.prototype.put = function(keyPath, args)
{
  var self = this;

  if(_.isString(keyPath)){
    keyPath = [keyPath];
  };

  var tuples = makeTuples(keyPath, args);
  _.each(tuples, function(tuple){
    var value = _.last(tuple);
    var key = _.initial(tuple);
    var packedKey = self.db.subspace.pack(key);

    var packedValue = util.packValue(self.db.valueSpace, value);

    self.tr.put(packedKey, packedValue);

    //
    // Check if we need to update the index
    //
    var indexKeyPath = _.initial(keyPath);
    indexKeyPath = indexKeyPath.concat(_.last(key, key.length - keyPath.length))
    if (indexes.checkIndex(self.index, indexKeyPath)) {
      indexes.writeIndex(self.db,
                         self.tr,
                         indexKeyPath,
                         _.last(keyPath),
                         value);
    }
  });
};

/**
  Returns a promise with the object at the given keypath (if any)
*/
Transaction.prototype.get = function(keyPath, fields, opts)
{
  var self = this;
  if (_.isString(keyPath)) {
    keyPath = [keyPath];
  }

  var key = self.db.subspace.pack(keyPath);
  var range = self.db.subspace.range(keyPath);

  // Instead of using range.begin, we start the range with the key itself
  // in case this key refers to a field instead of an object.
  var iter = self.tr.scanAsync(key, range.end, opts ? opts.limit : 0);

  self.tr.flush();

  return iter.then(function(rows) {
    var result;
    rows = rows[0];
    if (rows.length === 0) {
      return undefined;
    }
    var len = rows.length;
    for (var i = 0; i < len; i++) {
      var kv = rows[i];
      var keyBuffer = kv.key.toBuffer();
      var valueBuffer = kv.value.bytes.toBuffer();
      // If this is the key itself it means it is a field, not an object
      if (keyBuffer.length === key.length) {
        return util.unpackValue(self.db.valueSpace, valueBuffer);
      }
      var tuple = self.db.subspace.unpack(keyBuffer);
      result = result ? result : _.isNumber(_.last(tuple)) ? [] : {};
      tuple.push(util.unpackValue(self.db.valueSpace, valueBuffer));
      fromTuple(result, tuple.slice(keyPath.length));
    }
    return result;
  });
};

Transaction.prototype.remove = function(keyPath) {
  var self = this;
  if (_.isString(keyPath)) {
    keyPath = [keyPath];
  }
  var range = self.db.subspace.range(keyPath);

  self.tr.deleteRangeAsync(range.begin, range.end, 0);
};

Transaction.prototype.find = function find(keyPath, where, fields, options){
  //
  // Check if we can use some indexes to accelerate this query.
  //
  keyPath = _.isArray(keyPath) ? keyPath : [keyPath];
  var self = this;
  var tuples = makeTuples(keyPath, where);

  var promises;

  _.each(tuples, function(tuple){
    if(indexes.checkIndex(self.index, _.initial(tuple))){
      promises = promises || [];
      var defer = Promise.defer();
      self.operations.push(function(tr){
        defer.resolve(indexes.readIndex(self.db, tr, tuple));
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
        return self.get(keyPath.concat(id));
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

module.exports = Transaction;
