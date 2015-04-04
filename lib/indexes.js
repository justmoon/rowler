"use strict";

var roach = require('roachjs');
var util = require('./util');
var _ = require('lodash');
var Promise = require('bluebird');
var KeySelector = require('./keySelector');

var PREFIX = '__ind';

function makeIndex(tr, keyPath, value){
  return tr.put([PREFIX, '__meta'].concat(keyPath), value);
}

function readMeta(tr){
  return tr.get([PREFIX, '__meta']);
}

function writeIndex(db, tr, keyPath, id, value){
  var key = [PREFIX].concat(keyPath, [value, id]);
  var packedKey = db.subspace.pack(key)

  tr.set(packedKey, util.packValue(db.valueSpace, value));
}


function _fetchIndex(db, iter){
  var defer = Promise.defer();
  var result = {};
  iter.forEach(function(kv, cb) {
    var keyPath = db.subspace.unpack(kv.key);
    var id = _.last(keyPath);
    var obj = {};
    obj[db.idProp] = id;
    obj[keyPath[keyPath.length-3]] = util.unpackValue(db.valueSpace, kv.value);
    result[id] = obj;
    cb();
  }, function(err) {
    if(err){
      defer.reject(err);
    }else{
      defer.resolve(result);
    }
  });

  return defer.promise;
}

function checkIndex(index, keyPath){
  for(var i=0; i<keyPath.length-1; i++){
    index = index[keyPath[i]];
    if(_.isUndefined(index)){
      return false;
    }
  }
  return index === keyPath[i];
}
/**
  Reads the index for the given keyPath, field and value.
  Returns a object with all ids populated with the index field
  for the given keypath matching the condition field === value
*/
function readIndex(db, tr, keyPath){
  var key = [PREFIX].concat(keyPath);

  var range = db.subspace.range(key);
  var iter = tr.getRange(range.begin, range.end);

  return _fetchIndex(db, iter);
}

//
// Index read for inequalities
//
function readIndexGreater(db, tr, keyPath){
  var key = [PREFIX].concat(keyPath);

  var begin = KeySelector.firstGreaterThan(db.subspace.pack(key)).next();
  var range = db.subspace.range(_.initial(key));

  var iter = tr.getRange(begin, range.end);

  return _fetchIndex(db, iter);
}

function readIndexGreaterOrEqual(db, tr, keyPath){
  var key = [PREFIX].concat(keyPath);

  var begin = KeySelector.firstGreaterThan(db.subspace.pack(key));
  var range = db.subspace.range(_.initial(key));

  var iter = tr.getRange(begin, range.end);

  return _fetchIndex(db, iter);
}

function readIndexLess(db, tr, keyPath){
  var key = [PREFIX].concat(keyPath);

  var begin = KeySelector.firstGreaterThan(db.subspace.pack(_.initial(key)))
  var end = KeySelector.lastLessOrEqual(db.subspace.pack(key));

  var iter = tr.getRange(begin, end);

  return _fetchIndex(db, iter);
}

function readIndexLessOrEqual(db, tr, keyPath){
  var key = [PREFIX].concat(keyPath);

  var begin = KeySelector.firstGreaterThan(db.subspace.pack(_.initial(key)))
  var end = KeySelector.lastLessOrEqual(db.subspace.pack(key)).next();

  var iter = tr.getRange(begin, end);

  return _fetchIndex(db, iter);
}

exports.checkIndex = checkIndex;
exports.makeIndex = makeIndex;
exports.readMeta = readMeta;
exports.writeIndex = writeIndex;
exports.readIndex = readIndex;
exports.readIndexGreater = readIndexGreater;
exports.readIndexGreaterOrEqual = readIndexGreaterOrEqual;
exports.readIndexLess = readIndexLess;
exports.readIndexLessOrEqual = readIndexLessOrEqual;
