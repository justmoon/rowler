"use strict";

var fowler = require('../index');
var chai = require('chai');
var Promise = require('bluebird');

var expect = chai.expect;

var root = '__tests__';

fowler.open();

describe("Top Level", function(){

  before(function(){
    return Promise.all([
      fowler.remove('__ind'),
      fowler.remove(root),
      fowler.remove('animals'),
      fowler.remove('people'),
      fowler.remove('tests')
    ]);
  });

  after(function(){
    return fowler.transaction(function(tr){
      tr.remove('animals');
      tr.remove('people');
      tr.remove(root);
      tr.remove(['__ind', root]);
    });
  });

  it("Create", function(done){
    fowler.create('animals', {name: 'fox', legs: 4}).then(function(foxId){
      expect(foxId).to.be.a('string');
      fowler.get(['animals', foxId]).then(function(fox){
        expect(fox).to.be.a('object');
        expect(fox).to.have.property('name');
        expect(fox).to.have.property('legs');
        expect(fox.name).to.be.eql('fox')
        expect(fox.legs).to.be.eql(4)
        done();
      });
    });
  });

  it("Update document", function(done){
    fowler.create('animals', {name: 'tiger', legs: 4}).then(function(tigerId){
      expect(tigerId).to.be.a('string');

      fowler.put(['animals', tigerId], {legs: 3});

      fowler.get(['animals', tigerId]).then(function(tiger){
        expect(tiger).to.have.property('name');
        expect(tiger).to.have.property('legs');
        expect(tiger.name).to.be.eql('tiger')
        expect(tiger.legs).to.be.eql(4)
      });
      done();
    });
  });

  it("Remove document", function(done){
    fowler.create([root, 'animals'], {name: 'fox', legs: 4}).then(function(docId){

      fowler.remove([root, 'animals', docId]).then(function(){
        fowler.get([root, 'animals', docId]).then(function(doc){
          expect(doc).to.be.a('undefined');
          done();
        });
      });
    });
  });

  it("Find by filtering some property", function(done){
    fowler.create([root, 'people'], { name: "John", lastname: "Smith", balance: 50}).then(function(){
      fowler.create([root, 'people'], { name: "Lisa", balance: 30}).then(function(){
        fowler.find([root, 'people'], {name: "John"}, ['name']).then(function(result){
          expect(result).to.be.an('array');
          expect(result.length).to.be.eql(1);
          done();
        });
      })
    })
  });

  it("Retrieve individual property", function(done){
    fowler.create([root, 'people'], { _id: "John", lastname: "Smith", balance: 50}).then(function(){
      fowler.create([root, 'people'], { _id: "Lisa", balance: 30}).then(function(){
        fowler.get([root, 'people', 'Lisa', 'balance']).then(function(result){
          expect(result).to.be.a('number');
          expect(result).to.be.eql(30);
          done();
        });
      })
    })
  });

});
