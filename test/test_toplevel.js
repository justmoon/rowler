"use strict";

var rowler = require('../index');
var chai = require('chai');
var Promise = require('bluebird');

var expect = chai.expect;

var root = '__tests__';

describe("Top Level", function(){

  before(function(){
    rowler.open({
      subspace: new rowler.Subspace([], new Buffer(root, 'utf8'))
    });

    return rowler.remove();
  });

  after(function(){
    return rowler.remove();
  });

  it("Create", function(){
    return rowler.create('animals', {name: 'fox', legs: 4}).then(function(foxId){
      expect(foxId).to.be.a('string');
      return rowler.get(['animals', foxId]).then(function(fox){
        expect(fox).to.be.a('object');
        expect(fox).to.have.property('name');
        expect(fox).to.have.property('legs');
        expect(fox.name).to.be.eql('fox')
        expect(fox.legs).to.be.eql(4)
      });
    });
  });

  it("Update document", function() {
    var tigerId;
    return rowler.create('animals', {name: 'tiger', legs: 4}).then(function(id){
      tigerId = id;
      expect(tigerId).to.be.a('string');

      return rowler.put(['animals', tigerId], {legs: 3});
    }).then(function() {
      return rowler.get(['animals', tigerId]);
    }).then(function(tiger){
      expect(tiger).to.have.property('name');
      expect(tiger).to.have.property('legs');
      expect(tiger.name).to.be.eql('tiger')
      expect(tiger.legs).to.be.eql(3)
    });
  });

  it("Remove document", function() {
    return rowler.create([root, 'animals'], {name: 'fox', legs: 4}).then(function(docId){

      return rowler.remove([root, 'animals', docId]).then(function(){
        return rowler.get([root, 'animals', docId]).then(function(doc){
          expect(doc).to.be.a('undefined');
        });
      });
    });
  });

  it("Find by filtering some property", function() {
    return rowler.create([root, 'people'], { name: "John", lastname: "Smith", balance: 50}).then(function(){
      return rowler.create([root, 'people'], { name: "Lisa", balance: 30}).then(function(){
        return rowler.find([root, 'people'], {name: "John"}, ['name']).then(function(result){
          expect(result).to.be.an('array');
          expect(result.length).to.be.eql(1);
        });
      })
    })
  });

  it("Retrieve individual property", function() {
    return rowler.create([root, 'people'], { _id: "John", lastname: "Smith", balance: 50}).then(function(){
      return rowler.create([root, 'people'], { _id: "Lisa", balance: 30}).then(function(){
        return rowler.get([root, 'people', 'Lisa', 'balance']).then(function(result){
          expect(result).to.be.a('number');
          expect(result).to.be.eql(30);
        });
      })
    })
  });

});
