'use strict';

const mongoose = require('mongoose');
const { util } = require('node-simple-utilities');
const { v4: uuidv4 } = require('uuid');

let SCHEMAS = {};
const GLOBAL_MODELS = {};

class CollectionModel {
    constructor(modelName, config) {
        this.modelName = modelName;
        this.connections = {};

        if (typeof config === 'object') {
            this.config = config;
        } else {
            this.Model = CollectionModel.getGlobalModel(this.modelName);
            this.ModelSequence = CollectionModel.getGlobalModel('sequence');
            if (!this.Model) {
                throw new Error(`Model ${this.modelName} not found`);
            }
            if (!this.ModelSequence) {
                throw new Error(`Model sequence not found`);
            }
        }
        this.searchFields = ['title'];
        this.searchFieldsNum = ['id'];
        this.searchFieldsArray = [];
        this.defaultSort = 'updatedDate';

        this.document = {};
        this.documentList = {};
        this.dataObject = {};
        this.dataObjectList = [];
    }

    static addSchemas(schemas) {
        SCHEMAS = schemas;
    }

    static getGlobalModel(modelName) {
        return GLOBAL_MODELS[modelName];
    }

    static async connectGlobal(config) {
        // eslint-disable-next-line no-return-assign
        Object.keys(SCHEMAS).forEach((model) => {
            GLOBAL_MODELS[model] = mongoose.model(model, SCHEMAS[model]);
        });
        try {
            const result = await mongoose.connect(config.mongo.url, {
                useNewUrlParser: true,
                useFindAndModify: false,
            });
            console.log(`Global Mongoose connected to MongoDB: ${config.mongo.url}`);
            return result;
        } catch (err) {
            console.error('Global Mongoose could not connect to MongoDB', err);
            return Promise.reject(err);
        }
    }

    static async closeAll() {
        await mongoose.connection.close();
    }

    async connectModel(modelName) {
        try {
            const connection = await mongoose.createConnection(this.config.mongo.url, {
                useNewUrlParser: true,
                useFindAndModify: false,
            });
            this.connections[modelName] = connection;
            this[modelName] = connection.model(modelName, SCHEMAS[modelName]);
            // console.log(`\tC. modelName, this[modelName]: ${modelName}, ${this[modelName]}`);
            // console.log(mongoose.model(modelName, SCHEMAS[modelName]));
            return this[modelName];
        } catch (err) {
            console.error('\tMongoose could not connect to MongoDB', err);
            return Promise.reject(err);
        }
    }

    async close(modelName) {
        this.connections[modelName].close();
    }

    async connect() {
        this.Model = await this.connectModel(this.modelName);
        this.ModelSequence = await this.connectModel('sequence');
    }

    async closeAll() {
        await this.close(this.modelName);
        await this.close('sequence');
    }

    async dropCollection(confirm = false, iAmSure) {
        if (confirm && iAmSure === 'yes-i-am-sure') {
            await this.Model.collection.drop();
        }
    }

    get(key) {
        return this.dataObject[key];
    }

    set(key, value) {
        if (value) {
            this.dataObject[key] = value;
            this.document[key] = value;
            return true;
        }
        return false;
    }

    del(key) {
        delete this.dataObject[key];
        delete this.document[key];
    }

    getObject() {
        return this.dataObject;
    }

    getObjects() {
        return this.dataObjects;
    }

    getApiFields() {
        const keys = Object.keys(this.Model.schema.paths);
        const apiFields = [];
        for (let i = 0, l = keys.length; i < l; i += 1) {
            const key = keys[i];
            const field = this.Model.schema.paths[key].options;
            // console.log('key', key, this.Model.schema.paths[key].options);
            if (field.api) {
                apiFields.push(key);
            }
        }
        return apiFields;
    }

    getDefaultFields() {
        const keys = Object.keys(this.Model.schema.paths);
        const defaultFields = {};
        for (let i = 0, l = keys.length; i < l; i += 1) {
            const key = keys[i];
            const field = this.Model.schema.paths[key].options;
            // console.log('key', key, this.Model.schema.paths[key].options);
            if (field.api) {
                defaultFields[key] = 1;
            }
        }
        return defaultFields;
    }

    getApiFieldsDoc() {
        const keys = Object.keys(this.Model.schema.paths);
        const apiFields = {};
        for (let i = 0, l = keys.length; i < l; i += 1) {
            const key = keys[i];
            const field = this.Model.schema.paths[key];
            // console.log('key', key, this.Model.schema.paths[key]);
            if (field.options.api) {
                apiFields[key] = `${field.instance}${field.caster ? ` of ${field.caster.instance}` : ''}`
                    + `${field.options.apiDoc ? `. ${field.options.apiDoc}` : ''}`;
            }
        }
        return apiFields;
    }

    asApiObject($dataObject, opts = {}) {
        const dataObject = $dataObject || this.dataObject;
        const keys = Object.keys(this.Model.schema.paths);
        const apiResult = {};
        for (let i = 0, l = keys.length; i < l; i += 1) {
            const key = keys[i];
            const field = this.Model.schema.paths[key].options;
            // console.log('key', key, this.Model.schema.paths[key].options);
            if (field.api) {
                apiResult[key] = dataObject[key];
            }
        }
        if (Array.isArray(opts.fields)) {
            for (let i = 0, l = opts.fields.length; i < l; i += 1) {
                const key = opts.fields[i];
                apiResult[key] = dataObject[key];
            }
        }
        return apiResult;
    }

    asApiObjects($dataObjects, opts = {}) {
        const dataObjects = $dataObjects || this.dataObjectList;
        const apiResult = [];
        for (let i = 0, l = dataObjects.length; i < l; i += 1) {
            const object = this.asApiObject(dataObjects[i], opts);
            apiResult.push(object);
        }
        return apiResult;
    }

    async count(query) {
        try {
            const total = await this.Model.countDocuments(query);
            return total;
        } catch (error) {
            console.error(`${this.modelName}.find: ${JSON.stringify(query, null, 4)}: ${error}`);
        }
    }

    async find(query = {}, fields, options = {}) {
        try {
            const { hrstart, runId } = util.startTimer();
            let searchQuery = {};
            if (query.search) {
                searchQuery = util.makeSearchObject(query.search, this.searchFields, this.searchFieldsNum,
                    this.searchFieldsArray, options);
                delete query.search;
            }
            const finalQuery = {
                ...query,
                ...searchQuery,
            };
            const finalFields = fields || this.getDefaultFields();
            const documents = await this.Model.find(finalQuery, finalFields, options)
                .lean()
                .sort(options.sort || this.defaultSort)
                .limit(options.limit || 1000);

            this.documentList = documents;
            this.dataObjectList = [];
            for (let i = 0, l = documents.length; i < l; i += 1) {
                const document = documents[i];
                if (document !== null) {
                    // const dataObject = document.toObject();
                    const dataObject = document;
                    // eslint-disable-next-line no-underscore-dangle
                    delete dataObject._id;
                    this.dataObjectList.push(dataObject);
                }
            }
            util.logFunctionTimer({
                file: 'collectionModel.js',
                class: this.modelName,
                function: 'find',
                params: query,
                hrstart,
                runId,
            });
            return this.dataObjectList;
        } catch (error) {
            console.error(`${this.modelName}.find: ${JSON.stringify(query, null, 4)}: ${error}`);
        }
    }

    async distinct(field, query = {}, options = {}) {
        try {
            const { hrstart, runId } = util.startTimer();
            const documents = await this.Model.distinct(field, query, options)
                .lean();

            util.logFunctionTimer({
                file: 'collectionModel.js',
                class: this.modelName,
                function: 'distinct',
                field,
                params: query,
                hrstart,
                runId,
            });
            return documents;
        } catch (error) {
            console.error(`${this.modelName}.distinct: ${field} ${JSON.stringify(query, null, 4)}: ${error}`);
        }
    }

    async findOne(query, fields, options) {
        try {
            const { hrstart, runId } = util.startTimer();
            // console.log(this.modelName, 'query', query, util.cleanObject(query), fields, options);
            const document = await this.Model.findOne(util.cleanObject(query), fields, options);
            // console.log(this.modelName, 'document', document);
            if (document === null) {
                return null;
            }
            this.document = document;
            this.dataObject = document.toObject();
            // eslint-disable-next-line no-underscore-dangle
            delete this.dataObject._id;
            util.logFunctionTimer({
                file: 'collectionModel.js',
                class: this.modelName,
                function: 'findOne',
                params: query,
                hrstart,
                runId,
            });
            return this.dataObject;
        } catch (error) {
            console.error(`${this.modelName}.findOne(${JSON.stringify(query, null, 4)}).error: ${error}`);
        }
    }

    async search(searchTerm, fields, options) {
        const { hrstart, runId } = util.startTimer();
        const query = util.makeSearchObject(searchTerm, this.searchFields, this.searchFieldsNum,
            this.searchFieldsArray, options);
        delete options.query;
        const list = await this.find(query, fields, options);
        const total = await this.count(query);
        util.logFunctionTimer({
            file: 'collectionModel.js',
            class: this.modelName,
            function: 'search',
            params: query,
            hrstart,
            runId,
        });
        return { list, total };
    }

    async aggregate(pipeline) {
        try {
            const { hrstart, runId } = util.startTimer();
            const documents = await this.Model.aggregate(pipeline);
            util.logFunctionTimer({
                file: 'collectionModel.js',
                class: this.modelName,
                function: 'aggregate',
                params: pipeline,
                hrstart,
                runId,
            });
            return documents;
        } catch (error) {
            console.error(`${this.modelName}.find: ${JSON.stringify(pipeline, null, 4)}: ${error}`);
        }
    }

    async save($dataObject, $opts = {}) {
        return new Promise(async (resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            const dataObject = { ...$dataObject };
            let debug;
            if ($opts.debug) {
                debug = $opts.debug;
                delete $opts.debug;
            }
            // If dataObject is still empty, bail out
            if (typeof dataObject === 'undefined') {
                return reject(new Error('No data to save!'));
            }
            if (!dataObject.id) {
                dataObject.id = await this.getNextSequence();
                dataObject.uuidv4 = uuidv4();
            }
            // Set update time:
            dataObject.updatedDate = new Date();

            const query = util.cleanObject({
                id: dataObject.id,
                ...$opts.query,
            });
            delete $opts.query;

            const opts = {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
                lean: true,
                ...$opts,
            };
            if (debug) {
                console.log('collectionModel.dataObject:', dataObject);
                console.log('collectionModel.query:', query);
            }
            this.Model.findOneAndUpdate(query, dataObject, opts, (err, document) => {
                if (debug) {
                    console.log('collectionModel.findOneAndUpdate.err:', err);
                    console.log('collectionModel.findOneAndUpdate.document:', document);
                }

                if (err) {
                    return reject(err);
                }
                if (typeof document === 'object') {
                    this.dataObject = document;
                }
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'save',
                    params: query,
                    hrstart,
                    runId,
                });
                return resolve(this.dataObject);
            });
        });
    }

    async update(obj, query) {
        return new Promise((resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            this.Model.findOne(query || { id: obj.id }, (err, document) => {
                if (err) {
                    return reject(err);
                }
                if (!document) {
                    return reject(new Error(`Updated failed; document ${JSON.stringify(query
                        || obj.id, null, 4)} not found`));
                }
                document.set(obj);
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'update',
                    params: query,
                    hrstart,
                    runId,
                });
                return resolve(document.save());
            });
        });
    }

    async rawUpdate(query, data, options = { upsert: true }) {
        return new Promise((resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            this.Model.collection.updateMany(query, data, options, (err, object) => {
                if (err) {
                    return reject(err);
                }
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'rawUpdate',
                    params: query,
                    hrstart,
                    runId,
                });
                return resolve(object);
            });
        });
    }

    async insertMany(data, options = {}) {
        return new Promise((resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            this.Model.collection.insertMany(data, options, (err, object) => {
                if (err) {
                    return reject(err);
                }
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'insertMany',
                    hrstart,
                    runId,
                });
                return resolve(object);
            });
        });
    }

    async getNextSequence() {
        return new Promise((resolve, reject) => {
            const opts = {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
                rawResult: true,
                useFindAndModify: false,
            };
            this.ModelSequence.findOneAndUpdate({ name: this.modelName }, { $inc: { seq: 1 } }, opts, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result.value.seq + 1);
            });
        });
    }

    async delete(query) {
        return new Promise((resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            this.Model.deleteOne(query, (err, result) => {
                if (err) {
                    reject(err);
                }
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'delete',
                    params: query,
                    hrstart,
                    runId,
                });
                return resolve(result);
            });
        });
    }

    async deleteMany(query) {
        return new Promise((resolve, reject) => {
            const { hrstart, runId } = util.startTimer();
            this.Model.deleteMany(query, (err, result) => {
                if (err) {
                    reject(err);
                }
                util.logFunctionTimer({
                    file: 'collectionModel.js',
                    class: this.modelName,
                    function: 'deleteMany',
                    params: query,
                    hrstart,
                    runId,
                });
                return resolve(result);
            });
        });
    }
}

module.exports = CollectionModel;
