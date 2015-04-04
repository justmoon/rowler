# Rowler - NodeJS Document and Query Layer for CockroachDB

A NodeJS Layer for [CockroachDB](https://github.com/cockroachdb/cockroach) that provides documents and queries
with similar capabilities to MongoDB but providing support for
multidocument transactions.

Transaction support is an incredile powerful feature that simplifies
server logic and helps avoiding difficult to solve race conditions.

Fowl provides a low level API based on keypaths for describing documents and its
properties following CRUD semantics.

Fowl aims to be a low level document layer that can be used by others to provide
higher level features such as schemas, models, validation, etc.

All asynchronous operations return A+ compliant promises (provided by bluebirdjs).

## Contribute

Do you like rowler and want to bring it up to the next level? Do not hesitate to
clone the project and start contributing to it! :)

## Install

```
npm install rowler
```

## Test

```
npm test
```

## Features
- Clean API based on promises
- Complete transaction support for all available operations.
- Supports: create, get, update, remove, and find.
- Access of documents and subdocuments seamless due to a keypath based design.

## Roadmap
- namespaces
- Advanced queries (implement all mongodb query operators)
- Joins
- Profile and optimize

## Documentation

* [open](#open)
* [create](#create)
* [put](#put)
* [get](#get)
* [remove](#remove)
* [find](#remove)
* [transaction](#transaction)
* [addIndex](#addindex)
* [query](#query)

## Example


```
// Open a CockroachDB database
rowler.open();

// Create a document (if _id not specify a GUID will be generated)
var john = rowler.create('people', {
  _id: 'john',
  name: 'John',
  lastname: 'Smith',
  balance: 100
});

var lisa = rowler.create('people', {
  _id: 'lisa',
  name: 'Lisa',
  lastname: 'Jones',
  balance: 80
});

// Use transactions to transfer money from one account to another
rowler.transaction(function(tr){
  Promise.all([
    tx.get(['people', 'john']),
    tx.get(['people', 'lisa'])
  ]).spread(function (john, lisa) {
    john.balance -= 10;
    lisa.balance += 10;

    tr.put(['people', 'john'], john);
    tr.put(['people', 'lisa'], lisa);
}).then(function(){
  // We need to wait for the commit to complete since we are finding the
  // same keypaths.

  rowler.find('people', {balance: 90}, ['lastname']).then(function(docs){
    // docs = [{lastname: 'Jones'}, {lastname: 'Smith'}]
  })
})
```

In order to accelerate queries you should use indexes on the most common
fields in a document. Just add indexes specifying a base key path and the
fields to index:

```
rowler.addIndex('people',  ['name', 'balance']);
```

It is possible to perform more advanced queries using the Query object:

```
var query = rowler.query('people');
query
  .eql('lastname', 'Andersson')
  .gt('balance', 15)
  .lte('balance', 45)
  .exec(tr).then(function(results){
    // results -> array of documents matching the query.
  })
```

## About atomicity

All CRUD functions are atomic. Meaning that updating or getting a document is
fully atomic and you either update or get a full document or nothing at all.

The transaction object provides this same CRUD operations as atomic operations
spawning multiple documents.


## About Key Paths

Key paths are used in rowler to represent the location of some document or
subdocument. It is just an array of strings (or numbers) that maps to a
key or key range inside CockroachDB.
Key paths are more flexible than bucket based collections, as used for example
in mongoDB, since it allows you to specify a document or subdocument in a
generic way.

For example:

```
// Specify a document for some user in bucket 'people'
['people', '60abd640-2d98-11e3-a7d8-bd61eca52c5c']

// Specify a location of all the songs in a playlist
['playlist', '60af31a0-2d98-11e3-a7d8-bd61eca52c5c', 'songs']

```

All methods accepting a key path as parameter also accept a string that will just
be converted to an array:

```
'people' -> ['people']
```

## About  the _id property

As in MongoDB, we generate a unique *_id* property as a primary key for all the
created documents.

This property can be overrided if required by providing it explicitly in the
document object.

It is also possible skip the use of the *_id* property by just using the put
method directly and never calling create.

## Methods

<a name="open"/>
### open([clusterFile, dbName])

Opens a CockroachDB database. This function is just a wrapper on top of
`new Roach`
You need to call this method before you can start using the rest of the API.

__Arguments__

```javascript
    clusterFile {String} Optional path to a cluster file.
    dbName {String} Optional database name.
```

---------------------------------------

<a name="create"/>
### create(keyPath, doc)

Creates a new document in the given key path. The document must be a plain
object without any circular dependencies.
Returns a promise that will resolve to the document *_id* property.

__Arguments__

```javascript
    keyPath {Array|String} Keypath with the target location for the document.
    doc {Object} A plain object representing the document to store.
    returns {Promise} A promise that resolves to the document _id property.
```

---------------------------------------

<a name="put"/>
### put(keyPath, doc)

Updates a document. Similar to *create* but will not generate any _id property
automatically.

__Arguments__

```javascript
    keyPath {Array|String} Keypath with the target location for the document.
    doc {Object} A plain object representing the document to store.
    returns {Promise} A promise that resolves after the document has been updated.
```

---------------------------------------

<a name="get"/>
### get(keyPath)

Retrieves the document at the given key path.

__Arguments__

```javascript
    keyPath {Array|String} Keypath with the target location for the document.
    returns {Promise} A promise that resolves with the retrieved document.
```

---------------------------------------

<a name="remove"/>
### remove(keyPath)

Removes the document/subdocument at the given key path.

__Arguments__

```javascript
  keyPath {Array|String} Keypath with the target location for the document to remove.
  returns {Promise} A promise that resolves after the removal.  
```

---------------------------------------

<a name="find"/>
### find(keyPath, filter, [fields])

Finds documents in the given keypath that meets certain criteria.

__Arguments__

```javascript
  keyPath {Array|String} Keypath with the target location of the documents to find
  filter {Object} An object mapping properties to their values.
  fields {Array} An options array of property names that should be returned.
  returns {Promise} A promise that resolves with the found documents.
```

---------------------------------------

<a name="transaction"/>
### transaction(transactionBody)

Creates a new transaction. A transaction is an object that provides methods
to access the database as an atomic operation.

When calling this method, a new transaction object will be created and passed to
the provided callback function. Once that callback returns, the transaction will
automatically commit. The callback may return a Promise to delay the commit.

If the callback throws an exception (or rejects its Promise), `roachjs`'s retry logic
will apply. Transactions may also be retried due to committing with unknown
result which means developers should ensure transactions are idempotent.

__Arguments__

```javascript
  transactionBody(transaction) {Function} This method should contain all
    transaction operations and may return a Promise in which case the commit
    will take place when that Promise is resolved.
  returns {Promise} A promise that resolves after the transaction has executed.
```

---------------------------------------

#### transaction##create()

A transactional equivalent to [rowler##create](#create)

#### transaction##put()

A transactional equivalent to [rowler##put](#put)

#### transaction##get()

A transactional equivalent to [rowler##get](#get)

#### transaction##remove()

A transactional equivalent to [rowler##remove](#remove)

#### transaction##find()

A transactional equivalent to [rowler##find](#find)

<a name="addIndex"/>
### addIndex(keyPath, fields)

Adds an index for the given key path and fields. After calling this method,
everytime the key paths with the given fields are updated, an index is also
updated so that queries on such fields can be performed much faster.

__Arguments__

```javascript
  keyPath {Array|String} base key path for the index.
  fields {String|Array} A field or array of fields to index.
  returns {Promise} A promise that resolves after the index has been added.
```

---------------------------------------

<a name="query"/>
### query(keyPath, fields, opts)

Creates a query object that can be used to retrieve documents that matches
the given criteria. The returned query object provides several operators
to perform different kind of queries. The query object will use indexes to accelerate
queries if possible. Note that the order of the operators can affect performance,
it is always better to use indexed properties first.

__Arguments__

```javascript
  keyPath {Array|String} base key path for the query.
  fields {String|Array} A field or array of fields to return on the matched documents.
  opts {Options} Available options are "limit", "skip" and "sort".
  returns {Query} A query object with several operators to match the documents.
```

#### query##eql(property, value)
Matches documents where the given property is equal to the given value.

#### query##gt(property, value)
Matches documents where the given property is greather than the given value.

#### query##gte(property, value)
Matches documents where the given property is greater or equal than the given value.

#### query##lt(property, value)
Matches documents where the given property is less than the given value.

#### query##lte(property, value)
Matches documents where the given property is less or equal than the given value.

#### query##exec(transaction)
Executes the query. Returns a promise that resolves to the result of the query.


## License

(The MIT License)

Copyright (c) 2014 Stefan Thomas <justmoon@members.fsf.org>
Copyright (c) 2013 Manuel Astudillo <manuel@optimalbits.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
