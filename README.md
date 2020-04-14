# A Node.js collection model for mongoose stuff

[![Build Status](https://travis-ci.org/5orenso/node-simple-collectionmodel.svg?branch=master)](https://travis-ci.org/5orenso/node-simple-collectionmodel)
[![Coverage Status](https://coveralls.io/repos/github/5orenso/node-simple-collectionmodel/badge.svg?branch=master)](https://coveralls.io/github/5orenso/node-simple-collectionmodel?branch=master)
[![GitHub version](https://badge.fury.io/gh/5orenso%2Fnode-simple-collectionmodel.svg)](https://badge.fury.io/gh/5orenso%2Fnode-simple-collectionmodel)
[![npm version](https://badge.fury.io/js/node-simple-collectionmodel.svg)](https://badge.fury.io/js/node-simple-collectionmodel)

## TL;DR

### Installation

```bash
npm install node-simple-collectionmodel --save
```

### Usage Express Style

Add schemas for all collections you want to use.

Create a Mongoose init file `MongooseHelper`:

```javascript
'use strict';

const { CollectionModel } = require('node-simple-collectionmodel');

const loginUserSchema = require('./loginUserSchema');
const sequenceSchema = require('./sequenceSchema');

CollectionModel.addSchemas({
    loginUser: loginUserSchema,
    sequence: sequenceSchema,
});

module.exports = CollectionModel;
```

Then extend your collection classes.

```javascript
'use strict';

const { CollectionModel } = require('node-simple-collectionmodel');

class LoginUser extends CollectionModel {
    constructor(config) {
        super('loginUser', config);
        this.searchFields = ['email'];
        this.searchFieldsNum = ['id'];
        this.defaultSort = { email: -1 };
    }
}

module.exports = LoginUser;
```

Connection to the database globally inside server startup.

```javascript
const CollectionModel = require('./MongooseHelper');

CollectionModel.connectGlobal({
    config: {
        mongo: {
            url: 'mongodb://localhost:27017/mySuperDB?safe=true&auto_reconnect=true&poolSize=20','
        }
    }
});
```

Usage of collection class.

```javascript
const email = 'sorenso@gmail.com';
const loginUser = new LoginUser();
myUser = await loginUser.findOne({ email });
console.log(myUser);
```


## Helper modules in use:

__Jest__ A browser JavaScript testing toolkit. Jest is used by Facebook to test all JavaScript code including React applications. One of Jest's philosophies is to provide an integrated "zero-configuration" experience.

__ESLint__ ESLint is a code style linter for programmatically enforcing your style guide.

__Travis__
Travis CI is a hosted continuous integration service. It is integrated with GitHub and offers first class support for many languages.

__Coveralls.io__
Coveralls is a web service to help you track your code coverage over time, and ensure that all your new code is fully covered.

__Retire__
Scanner detecting the use of JavaScript libraries with known vulnerabilities.


### Howto to get started with contributions

```bash
$ git clone git@github.com:5orenso/node-simple-collectionmodel.git
$ cd node-simple-collectionmodel/
$ npm install
```

Start developing. Remember to start watching your files:
```bash
$ npm run test:watch
```


### HOWTO fix eslint issues
```bash
$ eslint --fix lib/utilities.js
```


### Howto contribute

```bash
$ git clone git@github.com:5orenso/node-simple-collectionmodel.git
```
Do your magic and create a pull request.


### Howto report issues
Use the [Issue tracker](https://github.com/5orenso/node-simple-collectionmodel/issues)


### Howto update CHANGELOG.md
```bash
$ bash ./changelog.sh
```


### Howto update NPM module

1. Bump version inside `package.json`
2. Push all changes to Github.
3. Push all changes to npmjs.com: `$ bash ./npm-release.sh`.


### Howto check for vulnerabilities in modules
```bash
# Install Node Security Platform CLI
$ npm install nsp --global  

# From inside your project directory
$ nsp check  
```


### Howto upgrade modules
```bash
$ sudo npm install -g npm-check-updates
$ ncu -u -a
$ npm install --no-optional
```


### Versioning
For transparency and insight into the release cycle, releases will be
numbered with the follow format:

`<major>.<minor>.<patch>`

And constructed with the following guidelines:

* Breaking backwards compatibility bumps the major
* New additions without breaking backwards compatibility bumps the minor
* Bug fixes and misc changes bump the patch

For more information on semantic versioning, please visit http://semver.org/.


## Contributions and feedback:

We ❤️ contributions and feedback.

If you want to contribute, please check out the [CONTRIBUTING.md](CONTRIBUTING.md) file.

If you have any question or suggestion create an issue.

Bug reports should always be done with a new issue.


## Other Resources

* [Node.js utilities](https://github.com/5orenso/node-simple-utilities)
* [Node.js Preact utilities](https://github.com/5orenso/preact-util)
* [Node.js Preact Mobx storemodel](https://github.com/5orenso/preact-storemodel)
* [Node.js boilerplate for Express](https://github.com/5orenso/node-express-boilerplate)
* [Node.js boilerplate for modules](https://github.com/5orenso/node-simple-boilerplate)
* [Node.js boilerplate for Preact](https://github.com/5orenso/preact-boilerplate)


## More about the author

- Twitter: [@sorenso](https://twitter.com/sorenso)
- Instagram: [@sorenso](https://instagram.com/sorenso)
- Facebook: [@sorenso](https://facebook.com/sorenso)
