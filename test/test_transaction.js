'use strict';

var Promise = require('bluebird');
var fowler = require('../index');
var chai = require('chai');

var expect = chai.expect;

var root = '__tests__';

describe('Transactions', function() {
  before(function() {
    fowler.open({
      subspace: new fowler.Subspace([], new Buffer(root, 'utf8'))
    });

    return fowler.remove();
  });

  after(function(){
    return fowler.remove();
  });

  describe("Creation", function(){
    it("Create document", function(){
      var foxId;
      return fowler.transaction(function(tr) {
        foxId = tr.create('animals', {name: 'fox', legs: 4});

        expect(foxId).to.be.a('string');
      }).then(function(res) {
        return fowler.get(['animals', foxId]);
      }).then(function(fox) {
        expect(fox).to.be.an('object');
        expect(fox).to.have.property('name');
        expect(fox).to.have.property('legs');
        expect(fox.name).to.be.eql('fox');
        expect(fox.legs).to.be.eql(4);
      });
    });

    it("A document should support sub-objects", function(){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'objects',
          subobject: {foo: "bar", bar: "foo"}});

        return tr.get([root, 'objects']).then(function(doc){
          expect(doc.subobject.foo).to.be.equal("bar");
          expect(doc.subobject.bar).to.be.equal("foo");
        });
      });
    });

    it("A document should support arrays", function(){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'array',
          cars: ['lotus', 'ferrari', 'red bull', 'mercedes', 'renault']});

        return tr.get([root, 'array', 'cars']).then(function(cars){
          expect(cars).to.have.length(5);
          expect(cars[0]).to.be.equal('lotus');
          expect(cars[1]).to.be.equal('ferrari');
          expect(cars[2]).to.be.equal('red bull');
          expect(cars[3]).to.be.equal('mercedes');
          expect(cars[4]).to.be.equal('renault');
        });
      });
    });

    it("A document should support integers", function(){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'numbers',
          balance: 50000});

        return tr.get([root, 'numbers']).then(function(doc){
          expect(doc.balance).to.be.equal(50000);
        });
      });
    });

    it("A document should support decimals", function(){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'numbers',
          balance: Math.PI});

        return tr.get([root, 'numbers']).then(function(doc){
          expect(doc.balance).to.be.equal(Math.PI);
        });
      });
    });


    it("A document should support booleans", function(){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'booleans',
          isValid: true
        });

        return tr.get([root, 'booleans']).then(function(doc){
          expect(doc.isValid).to.be.equal(true);
        });
      });
    });

    it("A document should support dates", function(){
      var date = Date();
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'dates',
          start: date
        });

        return tr.get([root, 'dates']).then(function(doc){
          expect(doc.start).to.be.equal(date);
        });
      });
    });

    it("A document should support dates", function(done){
      return fowler.transaction(function(tr){
        tr.create(root, {
          _id: 'null',
          value: null,
        });

        return tr.get([root, 'null']).then(function(doc){
          expect(doc.value).to.be.equal(null);
          done();
        });
      });
    });
  });

  describe("Update", function(){
    it("Update document", function(){
      return fowler.transaction(function(tr){
        var tigerId = tr.create('animals', {name: 'tiger', legs: 4});

        expect(tigerId).to.be.a('string');

        tr.put(['animals', tigerId], {legs: 3});

        return tr.get(['animals', tigerId]).then(function(tiger){
          expect(tiger).to.have.property('name');
          expect(tiger).to.have.property('legs');
          expect(tiger.name).to.be.eql('tiger')
          expect(tiger.legs).to.be.eql(3)
        });
      });
    });

    it.skip("two documents in the same transaction", function(){
      return fowler.transaction(function(tr){
        tr.create([root, 'people'], {_id: 1, name: "John", balance: 50});
        tr.create([root, 'people'], {_id: 2, name: "Lisa", balance: 30});

        return tr.get([root, 'people', 1], ['balance']).then(function(john){
          john.balance -= 10;
          tr.put([root, 'people', 1], {balance: john.balance});

          return tr.get([root, 'people', 1], {balance: john.balance}).then(function(john){
            expect(john.balance).to.be.equal(40);
          })
        }).then(function () {
          return tr.get([root, 'people', 2], ['balance']).then(function(lisa){
            lisa.balance += 10;
            tr.put([root, 'people', 2], {balance: lisa.balance});

            return tr.get([root, 'people', 2], {balance: lisa.balance}).then(function(lisa){
              expect(lisa.balance).to.be.equal(40);
            })
          });
        });
      }).then(function(){
        return Promise.join(
          fowler.get([root, 'people', 1]).then(function(john){
            expect(john.balance).to.be.equal(40);
          }),
          fowler.get([root, 'people', 2]).then(function(lisa){
            expect(lisa.balance).to.be.equal(40);
          })
        );
      });
    });
  });

  describe("Removal", function(){
    it("Remove document", function(){
      return fowler.transaction(function(tr){
        var docId = tr.create([root, 'animals'], {name: 'fox', legs: 4});

        tr.remove([root, 'animals', docId]);

        return tr.get([root, 'animals', docId]).then(function(doc){
          expect(doc).to.be.a('undefined');
        });
      });
    });
  });

  describe("Conflicts", function(){

  })

});
