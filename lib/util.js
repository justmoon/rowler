"use strinct";
var _ = require('lodash');

// based on:
// https://github.com/leaflevellabs/node-foundationdblayers/blob/master/lib/utils.js
function packValue(subspace, val)
{
  // string
  if(_.isString(val))
    return subspace.pack([0, new Buffer(val)]);
  // integer
  else if(_.isNumber(val) && val === Math.floor(val))
    return subspace.pack([1, val]);
  // decimal
  else if(_.isNumber(val) && val !== Math.floor(val))
    return subspace.pack([2, new Buffer(val.toString())]);
  // bool
  else if(_.isBoolean(val))
    return subspace.pack([3, val ? 1 : 0]);
  // dates
  else if(_.isDate(val)){
    return subspace.pack([4, +val]);
  }
  else if(val === null || val === undefined)
    return subspace.pack([5, ""]);
  else
    throw Error("the packValue function only accepts string, number, boolean, date");
}

function unpackValue(subspace, val)
{
  if(!val)
    return null;

  var unpackedval = subspace.unpack(val);
  var type = unpackedval[0];
  var val = unpackedval[1];

  switch(type){
    // string
    case 0:
      return val.toString();
    // number
    case 1:
      return val;
    // decimal
    case 2:
      return parseFloat(val.toString());
    // boolean
    case 3:
      return val === 1;
    // date
    case 4:
      return new Date(val)
    // null
    case 5:
      return null;
    default:
      throw Error("the type (" + type + ") of the passed val is unknown");
  }
}

exports.packValue = packValue;
exports.unpackValue = unpackValue;
