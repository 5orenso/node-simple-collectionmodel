'use strict';

const mongoose = require('mongoose');
const { util } = require('node-simple-utilities');

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

    asApiObject($dataObject) {
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
        return apiResult;
    }

    asApiObjects($dataObjects) {
        const dataObjects = $dataObjects || this.dataObjectList;
        const apiResult = [];
        for (let i = 0, l = dataObjects.length; i < l; i += 1) {
            const object = this.asApiObject(dataObjects[i]);
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
            const documents = await this.Model.find(finalQuery, fields, options)
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
            return this.dataObjectList;
        } catch (error) {
            console.error(`${this.modelName}.find: ${JSON.stringify(query, null, 4)}: ${error}`);
        }
    }

    async findOne(query, fields, options) {
        try {
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
            return this.dataObject;
        } catch (error) {
            console.error(`${this.modelName}.findOne(${JSON.stringify(query, null, 4)}).error: ${error}`);
        }
    }

    async search(searchTerm, fields, options) {
        const query = util.makeSearchObject(searchTerm, this.searchFields, this.searchFieldsNum,
            this.searchFieldsArray, options);
        delete options.query;
        const list = await this.find(query, fields, options);
        const total = await this.count(query);
        return { list, total };
    }

    async aggregate(pipeline) {
        try {
            const documents = await this.Model.aggregate(pipeline);
            return documents;
        } catch (error) {
            console.error(`${this.modelName}.find: ${JSON.stringify(pipeline, null, 4)}: ${error}`);
        }
    }

    async save($dataObject) {
        return new Promise(async (resolve, reject) => {
            const dataObject = { ...$dataObject };
            // If dataObject is still empty, bail out
            if (typeof dataObject === 'undefined') {
                return reject(new Error('No data to save!'));
            }
            if (!dataObject.id) {
                dataObject.id = await this.getNextSequence();
            }
            // Set update time:
            dataObject.updatedDate = new Date();

            const opts = {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
                lean: true,
            };
            const query = util.cleanObject({ id: dataObject.id });
            // console.log('collectionModel.dataObject:', dataObject);
            // console.log('collectionModel.query:', query);
            this.Model.findOneAndUpdate(query, dataObject, opts, (err, document) => {
                // console.log('collectionModel.findOneAndUpdate.err:', err);
                // console.log('collectionModel.findOneAndUpdate.document:', document);

                if (err) {
                    return reject(err);
                }
                if (typeof document === 'object') {
                    this.dataObject = document;
                }
                return resolve(this.dataObject);
            });
        });
    }

    async update(obj, query) {
        return new Promise((resolve, reject) => {
            this.Model.findOne(query || { id: obj.id }, (err, document) => {
                if (err) {
                    return reject(err);
                }
                if (!document) {
                    return reject(new Error(`Updated failed; document ${JSON.stringify(query
                        || obj.id, null, 4)} not found`));
                }
                document.set(obj);
                return resolve(document.save());
            });
        });
    }

    async rawUpdate(query, data, options = { upsert: true }) {
        return new Promise((resolve, reject) => {
            this.Model.collection.updateMany(query, data, options, (err, object) => {
                if (err) {
                    return reject(err);
                }
                return resolve(object);
            });
        });
    }

    async insertMany(data, options = {}) {
        return new Promise((resolve, reject) => {
            this.Model.collection.insertMany(data, options, (err, object) => {
                if (err) {
                    return reject(err);
                }
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
            this.Model.deleteOne(query, (err, result) => {
                if (err) {
                    reject(err);
                }
                return resolve(result);
            });
        });
    }

    async deleteMany(query) {
        return new Promise((resolve, reject) => {
            this.Model.deleteMany(query, (err, result) => {
                if (err) {
                    reject(err);
                }
                return resolve(result);
            });
        });
    }
}

module.exports = CollectionModel;
